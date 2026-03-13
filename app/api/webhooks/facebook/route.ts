// app/api/webhooks/facebook/route.ts — Webhook do Facebook Messenger
// ROTA PÚBLICA: adicionada ao PUBLIC_PATHS no middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMetaWebhookSignature } from '@/lib/channels/instagram'

/**
 * GET — Verificação do webhook (Meta envia challenge)
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  // Usar o mesmo verify token do Instagram ou um separado
  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST — Recebe mensagens do Messenger
 */
export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text()

    // Verificar assinatura
    const appSecret = process.env.INSTAGRAM_APP_SECRET // Mesmo app Meta
    if (appSecret) {
      const signature = req.headers.get('x-hub-signature-256') ?? ''
      if (!signature || !verifyMetaWebhookSignature(signature, bodyText, appSecret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const body = JSON.parse(bodyText)

    // Meta envia { object: 'page', entry: [...] } para Messenger
    if (body.object !== 'page') {
      return NextResponse.json({ received: true })
    }

    const entries = body.entry as Array<{
      id: string
      time: number
      messaging?: Array<{
        sender: { id: string }
        recipient: { id: string }
        timestamp: number
        message?: {
          mid: string
          text?: string
          attachments?: Array<{
            type: string
            payload: { url?: string }
          }>
          is_echo?: boolean
          quick_reply?: { payload: string }
        }
      }>
    }>

    for (const entry of entries) {
      if (!entry.messaging?.length) continue

      for (const msg of entry.messaging) {
        if (!msg.message) continue

        const fromMe = msg.message.is_echo ?? false
        const externalId = msg.message.mid
        const senderId = msg.sender.id
        const pageId = msg.recipient.id

        // Deduplicação
        const existing = await prisma.message.findUnique({ where: { waMessageId: externalId } })
        if (existing) continue

        // Encontrar canal Facebook pelo pageId
        const channel = await prisma.crmChannel.findFirst({
          where: { type: 'facebook', instanceId: pageId, isActive: true },
        })
        if (!channel) continue

        const tenantId = channel.tenantId

        // Extrair conteúdo
        let type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' = 'TEXT'
        let content = msg.message.text ?? ''
        let mediaMimeType: string | null = null
        let mediaUrl: string | null = null

        if (msg.message.quick_reply) {
          content = msg.message.quick_reply.payload
        }

        if (msg.message.attachments?.length) {
          const att = msg.message.attachments[0]
          mediaUrl = att.payload?.url ?? null
          switch (att.type) {
            case 'image': type = 'IMAGE'; content = content || '[Imagem]'; mediaMimeType = 'image/jpeg'; break
            case 'video': type = 'VIDEO'; content = content || '[Vídeo]'; mediaMimeType = 'video/mp4'; break
            case 'audio': type = 'AUDIO'; content = content || '[Áudio]'; mediaMimeType = 'audio/mpeg'; break
            default: type = 'DOCUMENT'; content = content || '[Arquivo]'; break
          }
        }

        const remoteJid = `${senderId}@messenger`

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
                name: `Messenger ${senderId.slice(-6)}`,
                phone: '',
                source: 'facebook',
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
                unreadCount: fromMe ? 0 : 1,
              },
            })
          } else {
            await tx.conversation.update({
              where: { id: conversation.id },
              data: {
                lastMessageAt: new Date(),
                unreadCount: fromMe ? undefined : { increment: 1 },
                isClosed: false,
              },
            })
          }

          await tx.message.create({
            data: {
              conversationId: conversation.id,
              tenantId,
              waMessageId: externalId,
              fromMe,
              type,
              content,
              mediaMimeType,
              mediaUrl,
              channel: 'facebook',
              status: fromMe ? 'SENT' : 'RECEIVED',
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
              data: { fromMe, content: content.slice(0, 100), messageType: type, channel: 'facebook' },
            })).catch(() => {})
          }
        } catch {
          // ok
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[facebook-webhook] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
