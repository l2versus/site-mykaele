// src/workers/crm/process-webhook.ts — Processa webhooks da Evolution API
// Cria Lead, Conversation e Message com IDs reais
import type { Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import IORedis from 'ioredis'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
pool.on('error', (err) => console.error('[worker/webhook] Pool error:', err.message))

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 10) return null
    return Math.min(times * 500, 15_000)
  },
})
redis.on('error', (err) => console.error('[worker/webhook] Redis error:', err.message))

const CRM_CHANNEL = 'crm:events'

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
  messageTimestamp?: number
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

  const text = message.conversation
    ?? message.extendedTextMessage?.text
    ?? ''
  return { type: 'TEXT', content: text, mediaMimeType: null, mediaUrl: null }
}

export interface WebhookResult {
  tenantId: string
  leadId: string
  conversationId: string
  messageId: string
  isNewLead: boolean
}

export async function processWebhook(job: Job<WebhookPayload>): Promise<WebhookResult | null> {
  const { event: rawEvent, instance } = job.data

  // Normalizar evento (defesa extra — rota já normaliza antes de enfileirar)
  const event = rawEvent.toLowerCase().replace(/_/g, '.')

  // Normalizar data (defesa extra — rota já extrai primeiro item do array)
  const data: WebhookMessageData = Array.isArray(job.data.data) ? job.data.data[0] : job.data.data
  if (!data) return null

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
    return null
  }

  if (event !== 'messages.upsert') return null

  const key = data.key
  if (!key?.id || !key.remoteJid) return null

  // Ignorar mensagens de grupo e status
  if (key.remoteJid.endsWith('@g.us') || key.remoteJid === 'status@broadcast') return null

  // Encontrar canal pela instância
  const channel = await prisma.crmChannel.findFirst({
    where: { instanceId: instance, isActive: true },
  })
  if (!channel) {
    console.error(`[webhook] Canal não encontrado para instância: ${instance}`)
    return null
  }

  const tenantId = channel.tenantId

  // Deduplicação: checar se mensagem já existe
  const existingMsg = await prisma.message.findUnique({
    where: { waMessageId: key.id },
  })
  if (existingMsg) return null

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

    let isNewLead = false

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
        isNewLead = true

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
        channel: channel.type || 'whatsapp',
        status: key.fromMe ? 'SENT' : 'RECEIVED',
      },
    })

    // Atualizar lastInteractionAt do lead
    await tx.lead.update({
      where: { id: conversation.leadId },
      data: { lastInteractionAt: new Date() },
    })

    return { conversation, message, lead: conversation.lead, isNewLead }
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
      channel: channel.type || 'whatsapp',
    },
  }))

  return {
    tenantId,
    leadId: result.lead.id,
    conversationId: result.conversation.id,
    messageId: result.message.id,
    isNewLead: result.isNewLead,
  }
}
