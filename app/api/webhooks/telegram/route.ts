// app/api/webhooks/telegram/route.ts — Webhook do Telegram Bot API
// ROTA PÚBLICA: adicionada ao PUBLIC_PATHS no middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name: string; last_name?: string; username?: string }
  chat: { id: number; type: string; first_name?: string; last_name?: string; username?: string }
  date: number
  text?: string
  photo?: Array<{ file_id: string; width: number; height: number }>
  document?: { file_id: string; file_name?: string; mime_type?: string }
  audio?: { file_id: string; duration: number; mime_type?: string }
  video?: { file_id: string; duration: number; mime_type?: string }
  voice?: { file_id: string; duration: number; mime_type?: string }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export async function POST(req: NextRequest) {
  try {
    // Verificar secret token do Telegram (se configurado)
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET
    if (secretToken) {
      const headerToken = req.headers.get('x-telegram-bot-api-secret-token')
      if (headerToken !== secretToken) {
        return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
      }
    }

    const update: TelegramUpdate = await req.json()
    const msg = update.message
    if (!msg) return NextResponse.json({ ok: true })

    // Ignorar mensagens de grupo (só processa chats privados)
    if (msg.chat.type !== 'private') return NextResponse.json({ ok: true })

    const chatId = String(msg.chat.id)
    const externalId = `tg-${msg.message_id}-${chatId}`

    // Deduplicação
    const existing = await prisma.message.findUnique({ where: { waMessageId: externalId } })
    if (existing) return NextResponse.json({ ok: true })

    // Encontrar canal Telegram (qualquer instância ativa do tipo telegram)
    const channel = await prisma.crmChannel.findFirst({
      where: { type: 'telegram', isActive: true },
    })
    if (!channel) return NextResponse.json({ ok: true })

    const tenantId = channel.tenantId

    // Extrair conteúdo
    let type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' = 'TEXT'
    let content = msg.text ?? ''
    let mediaMimeType: string | null = null
    let mediaUrl: string | null = null

    if (msg.photo?.length) {
      type = 'IMAGE'
      content = content || '[Foto]'
      mediaMimeType = 'image/jpeg'
      mediaUrl = `tg-file:${msg.photo[msg.photo.length - 1].file_id}`
    } else if (msg.document) {
      type = 'DOCUMENT'
      content = msg.document.file_name ?? '[Documento]'
      mediaMimeType = msg.document.mime_type ?? null
      mediaUrl = `tg-file:${msg.document.file_id}`
    } else if (msg.audio) {
      type = 'AUDIO'
      content = '[Áudio]'
      mediaMimeType = msg.audio.mime_type ?? 'audio/mpeg'
      mediaUrl = `tg-file:${msg.audio.file_id}`
    } else if (msg.video) {
      type = 'VIDEO'
      content = '[Vídeo]'
      mediaMimeType = msg.video.mime_type ?? 'video/mp4'
      mediaUrl = `tg-file:${msg.video.file_id}`
    } else if (msg.voice) {
      type = 'AUDIO'
      content = '[Áudio]'
      mediaMimeType = msg.voice.mime_type ?? 'audio/ogg'
      mediaUrl = `tg-file:${msg.voice.file_id}`
    }

    const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || `Telegram ${chatId.slice(-6)}`
    const remoteJid = `${chatId}@telegram`

    await prisma.$transaction(async (tx) => {
      let conversation = await tx.conversation.findUnique({
        where: { tenantId_remoteJid: { tenantId, remoteJid } },
      })

      if (!conversation) {
        const pipeline = await tx.pipeline.findFirst({
          where: { tenantId, isDefault: true },
          include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
        })
        if (!pipeline || pipeline.stages.length === 0) return

        const firstStage = pipeline.stages[0]
        const lastLead = await tx.lead.findFirst({
          where: { tenantId, stageId: firstStage.id, deletedAt: null },
          orderBy: { position: 'desc' },
        })

        const lead = await tx.lead.create({
          data: {
            tenantId,
            pipelineId: pipeline.id,
            stageId: firstStage.id,
            name: senderName,
            phone: '',
            source: 'telegram',
            status: 'WARM',
            position: lastLead ? lastLead.position + 1.0 : 1.0,
          },
        })

        await tx.stage.update({
          where: { id: firstStage.id },
          data: { cachedLeadCount: { increment: 1 }, cacheUpdatedAt: new Date() },
        })

        conversation = await tx.conversation.create({
          data: {
            tenantId,
            leadId: lead.id,
            channelId: channel.id,
            remoteJid,
            lastMessageAt: new Date(),
            unreadCount: 1,
          },
        })
      } else {
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
            isClosed: false,
          },
        })
      }

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          tenantId,
          waMessageId: externalId,
          fromMe: false,
          type,
          content,
          mediaMimeType,
          mediaUrl,
          channel: 'telegram',
          status: 'RECEIVED',
        },
      })

      await tx.lead.update({
        where: { id: conversation.leadId },
        data: { lastInteractionAt: new Date() },
      })
    })

    // SSE
    try {
      const { redis, isRedisReady } = await import('@/lib/redis')
      if (isRedisReady()) {
        redis.publish('crm:events', JSON.stringify({
          type: 'new-message',
          tenantId: channel.tenantId,
          data: { fromMe: false, content: content.slice(0, 100), messageType: type, channel: 'telegram' },
        })).catch(() => {})
      }
    } catch {
      // ok
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telegram-webhook] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: true }) // Telegram espera 200 sempre
  }
}
