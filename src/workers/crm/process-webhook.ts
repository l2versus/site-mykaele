// src/workers/crm/process-webhook.ts — Processa webhooks da Evolution API
// Cria Lead, Conversation e Message com IDs reais
import type { Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import IORedis from 'ioredis'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379')

const CRM_CHANNEL = 'crm:events'

interface WebhookPayload {
  event: string
  instance: string
  data: {
    key?: { id: string; fromMe: boolean; remoteJid: string }
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
      imageMessage?: { mimetype: string; url: string; caption?: string }
      audioMessage?: { mimetype: string; url: string }
      videoMessage?: { mimetype: string; url: string; caption?: string }
      documentMessage?: { mimetype: string; url: string; fileName?: string }
    }
    messageTimestamp?: number
    pushName?: string
    status?: string
  }
  receivedAt: string
}

type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT'

function extractContent(message: WebhookPayload['data']['message']): {
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

  const text = message.conversation
    ?? message.extendedTextMessage?.text
    ?? ''
  return { type: 'TEXT', content: text, mediaMimeType: null, mediaUrl: null }
}

export async function processWebhook(job: Job<WebhookPayload>): Promise<void> {
  const { event, instance, data } = job.data

  if (event === 'connection.update') {
    // Atualizar status da conexão no canal
    const channel = await prisma.crmChannel.findFirst({
      where: { instanceId: instance },
    })
    if (channel) {
      await redis.publish(CRM_CHANNEL, JSON.stringify({
        type: 'connection-update',
        tenantId: channel.tenantId,
        data: { channelId: channel.id, status: data.status },
      }))
    }
    return
  }

  if (event !== 'messages.upsert') return

  const key = data.key
  if (!key?.id || !key.remoteJid) return

  // Ignorar mensagens de grupo e status
  if (key.remoteJid.endsWith('@g.us') || key.remoteJid === 'status@broadcast') return

  // Encontrar canal pela instância
  const channel = await prisma.crmChannel.findFirst({
    where: { instanceId: instance, isActive: true },
  })
  if (!channel) {
    console.error(`[webhook] Canal não encontrado para instância: ${instance}`)
    return
  }

  const tenantId = channel.tenantId

  // Deduplicação: checar se mensagem já existe
  const existingMsg = await prisma.message.findUnique({
    where: { waMessageId: key.id },
  })
  if (existingMsg) return

  // Buscar ou criar conversa + lead em transação
  const { type, content, mediaMimeType, mediaUrl } = extractContent(data.message)
  const pushName = data.pushName ?? 'Contato'
  const phone = key.remoteJid.replace('@s.whatsapp.net', '')

  const result = await prisma.$transaction(async (tx) => {
    // Buscar conversa existente
    let conversation = await tx.conversation.findUnique({
      where: { tenantId_remoteJid: { tenantId, remoteJid: key.remoteJid } },
      include: { lead: true },
    })

    if (!conversation) {
      // Buscar pipeline padrão
      const pipeline = await tx.pipeline.findFirst({
        where: { tenantId, isDefault: true },
        include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
      })
      if (!pipeline || pipeline.stages.length === 0) {
        throw new Error(`Pipeline padrão não encontrado para tenant: ${tenantId}`)
      }

      const firstStage = pipeline.stages[0]

      // Buscar lead existente pelo telefone
      let lead = await tx.lead.findFirst({
        where: { tenantId, phone, deletedAt: null },
      })

      if (!lead) {
        // Último lead na coluna para calcular posição
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

        // Atualizar cache do estágio
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
        include: { lead: true },
      })
    } else {
      // Atualizar conversa existente
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: key.fromMe
            ? conversation.unreadCount
            : { increment: 1 },
          isClosed: false,
        },
      })
    }

    // Criar mensagem
    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        waMessageId: key.id,
        fromMe: key.fromMe,
        type,
        content,
        mediaMimeType,
        mediaUrl,
        status: key.fromMe ? 'SENT' : 'RECEIVED',
      },
    })

    // Atualizar lastInteractionAt do lead
    await tx.lead.update({
      where: { id: conversation.leadId },
      data: { lastInteractionAt: new Date() },
    })

    return { conversation, message, lead: conversation.lead, isNew: !conversation.lead }
  })

  // Publicar evento SSE
  await redis.publish(CRM_CHANNEL, JSON.stringify({
    type: 'new-message',
    tenantId,
    data: {
      conversationId: result.conversation.id,
      leadId: result.lead.id,
      messageId: result.message.id,
      fromMe: key.fromMe,
      content: content.slice(0, 100),
      messageType: type,
    },
  }))
}
