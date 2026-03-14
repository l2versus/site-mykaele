// src/lib/webhook-processor.ts — Processamento inline de webhooks (fallback sem Redis)
// Usado quando o Redis está offline e a fila BullMQ não está disponível.
// Garante que NENHUMA mensagem WhatsApp seja perdida.
import { prisma } from '@/lib/prisma'
import { tryAutoReply } from '@/lib/auto-reply'
import { tryBotReply } from '@/lib/bot-engine'
import { tryAiAgentReply } from '@/lib/ai-agent'
import { fireAutomations } from '@/lib/automation-engine'

interface WebhookMessageData {
  key?: { id: string; fromMe: boolean; remoteJid: string }
  message?: {
    conversation?: string
    extendedTextMessage?: { text: string }
    imageMessage?: { mimetype: string; url: string; caption?: string }
    audioMessage?: { mimetype: string; url: string }
    videoMessage?: { mimetype: string; url: string; caption?: string }
    documentMessage?: { mimetype: string; url: string; fileName?: string }
  }
  pushName?: string
  status?: string
}

interface WebhookPayload {
  event: string
  instance: string
  data: WebhookMessageData | WebhookMessageData[]
  receivedAt: string
}

type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT'

function extractContent(message: WebhookMessageData['message']): {
  type: MessageType
  content: string
  mediaMimeType: string | null
  mediaUrl: string | null
} {
  if (!message) return { type: 'TEXT', content: '', mediaMimeType: null, mediaUrl: null }

  if (message.imageMessage) {
    return {
      type: 'IMAGE',
      content: message.imageMessage.caption ?? '[Imagem]',
      mediaMimeType: message.imageMessage.mimetype,
      mediaUrl: message.imageMessage.url,
    }
  }
  if (message.audioMessage) {
    return {
      type: 'AUDIO',
      content: '[Áudio]',
      mediaMimeType: message.audioMessage.mimetype,
      mediaUrl: message.audioMessage.url,
    }
  }
  if (message.videoMessage) {
    return {
      type: 'VIDEO',
      content: message.videoMessage.caption ?? '[Vídeo]',
      mediaMimeType: message.videoMessage.mimetype,
      mediaUrl: message.videoMessage.url,
    }
  }
  if (message.documentMessage) {
    return {
      type: 'DOCUMENT',
      content: message.documentMessage.fileName ?? '[Documento]',
      mediaMimeType: message.documentMessage.mimetype,
      mediaUrl: message.documentMessage.url,
    }
  }

  const text = message.conversation ?? message.extendedTextMessage?.text ?? ''
  return { type: 'TEXT', content: text, mediaMimeType: null, mediaUrl: null }
}

/**
 * Processa webhook diretamente (sem fila BullMQ).
 * Fallback para quando Redis está offline.
 * Não faz: SSE, AI score, golden window — essas são enfileiradas quando Redis voltar.
 */
export async function processWebhookInline(payload: WebhookPayload): Promise<void> {
  const { event, instance } = payload

  // Normalizar evento (Evolution API v2 pode enviar MESSAGES_UPSERT)
  const normalizedEvent = event.toLowerCase().replace(/_/g, '.')

  // Só processa messages.upsert
  if (normalizedEvent !== 'messages.upsert') return

  // Evolution API v2 pode enviar data como array — normalizar
  const data = Array.isArray(payload.data) ? payload.data[0] : payload.data
  if (!data) return

  const key = data.key
  if (!key?.id || !key.remoteJid) return

  // Ignorar grupos e status
  if (key.remoteJid.endsWith('@g.us') || key.remoteJid === 'status@broadcast') return

  // Encontrar canal
  const channel = await prisma.crmChannel.findFirst({
    where: { instanceId: instance, isActive: true },
  })
  if (!channel) return

  const tenantId = channel.tenantId

  // Deduplicação
  const existing = await prisma.message.findUnique({
    where: { waMessageId: key.id },
  })
  if (existing) return

  const { type, content, mediaMimeType, mediaUrl } = extractContent(data.message)
  const pushName = data.pushName ?? 'Contato'
  const phone = key.remoteJid.replace('@s.whatsapp.net', '')

  // Contexto capturado dentro da transaction para auto-reply e automações
  const autoReplyCtx: { leadId: string; leadName: string; channelId: string }[] = []
  let isNewLead = false

  await prisma.$transaction(async (tx) => {
    let conversation = await tx.conversation.findUnique({
      where: { tenantId_remoteJid: { tenantId, remoteJid: key.remoteJid } },
    })

    if (!conversation) {
      const pipeline = await tx.pipeline.findFirst({
        where: { tenantId, isDefault: true },
        include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
      })
      if (!pipeline || pipeline.stages.length === 0) return

      const firstStage = pipeline.stages[0]

      let lead = await tx.lead.findFirst({
        where: { tenantId, phone, deletedAt: null },
      })

      if (!lead) {
        isNewLead = true
        const lastLead = await tx.lead.findFirst({
          where: { tenantId, stageId: firstStage.id, deletedAt: null },
          orderBy: { position: 'desc' },
        })

        lead = await tx.lead.create({
          data: {
            tenantId,
            pipelineId: pipeline.id,
            stageId: firstStage.id,
            name: pushName,
            phone,
            source: 'whatsapp',
            status: 'WARM',
            position: lastLead ? lastLead.position + 1.0 : 1.0,
          },
        })

        await tx.stage.update({
          where: { id: firstStage.id },
          data: {
            cachedLeadCount: { increment: 1 },
            cacheUpdatedAt: new Date(),
          },
        })
      }

      conversation = await tx.conversation.create({
        data: {
          tenantId,
          leadId: lead.id,
          channelId: channel.id,
          remoteJid: key.remoteJid,
          lastMessageAt: new Date(),
          unreadCount: key.fromMe ? 0 : 1,
        },
      })

      // Capturar contexto para auto-reply (lead + canal)
      autoReplyCtx.push({ leadId: lead.id, leadName: lead.name, channelId: channel.id })
    } else {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: key.fromMe
            ? undefined
            : { increment: 1 },
          isClosed: false,
        },
      })

      // Capturar contexto mesmo para conversas existentes (lead pode nunca ter recebido auto-reply)
      const lead = await tx.lead.findUnique({
        where: { id: conversation.leadId },
        select: { id: true, name: true },
      })
      if (lead) {
        autoReplyCtx.push({ leadId: lead.id, leadName: lead.name, channelId: conversation.channelId })
      }
    }

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        waMessageId: key.id,
        fromMe: key.fromMe,
        type,
        content,
        mediaMimeType,
        mediaUrl,
        channel: channel.type || 'whatsapp',
        status: key.fromMe ? 'SENT' : 'RECEIVED',
      },
    })

    await tx.lead.update({
      where: { id: conversation.leadId },
      data: { lastInteractionAt: new Date() },
    })
  })

  // Fire-and-forget: bot → auto-reply → automações (não bloqueia o webhook)
  const ctx = autoReplyCtx[0]
  if (ctx && !key.fromMe) {
    // Cadeia de prioridade: Bot Builder > Agente IA > Auto-Reply
    void (async () => {
      try {
        // 1. Tentar bot visual primeiro
        const botHandled = await tryBotReply({
          tenantId,
          leadId: ctx.leadId,
          leadName: ctx.leadName,
          channelId: ctx.channelId,
          remoteJid: key.remoteJid,
          messageContent: content,
          isNewLead,
        })
        if (botHandled) return

        // 2. Se bot não tratou, tentar agente IA (RAG + Gemini)
        const aiHandled = await tryAiAgentReply({
          tenantId,
          leadId: ctx.leadId,
          leadName: ctx.leadName,
          channelId: ctx.channelId,
          remoteJid: key.remoteJid,
          messageContent: content,
        })
        if (aiHandled) return

        // 3. Último fallback: auto-reply simples (uma vez por lead)
        await tryAutoReply({
          tenantId,
          leadId: ctx.leadId,
          leadName: ctx.leadName,
          channelId: ctx.channelId,
          remoteJid: key.remoteJid,
          fromMe: key.fromMe,
        })
      } catch (err) {
        console.error('[webhook] Erro no fluxo bot/ia/auto-reply:', err instanceof Error ? err.message : err)
      }
    })()

    // 3. Disparar automações por gatilho (non-blocking, independente do bot)
    void fireAutomations('NEW_MESSAGE_RECEIVED', {
      tenantId,
      leadId: ctx.leadId,
      metadata: { messageType: type, content },
    })

    if (isNewLead) {
      void fireAutomations('LEAD_CREATED', {
        tenantId,
        leadId: ctx.leadId,
        metadata: { source: 'whatsapp', phone },
      })
    }
  }
}
