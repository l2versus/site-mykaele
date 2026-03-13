// app/api/webhooks/email/route.ts — Webhook do Resend (status + inbound)
// ROTA PÚBLICA: adicionada ao PUBLIC_PATHS no middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyResendWebhookSignature } from '@/lib/channels/email'

interface ResendEvent {
  type: string
  created_at: string
  data: {
    email_id?: string
    message_id?: string
    from?: string
    from_name?: string
    to?: string[]
    subject?: string
    text?: string
    html?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Verificar assinatura se secret configurado
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = req.headers.get('svix-signature') || ''
      const isValid = await verifyResendWebhookSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event: ResendEvent = JSON.parse(rawBody)

    // === STATUS UPDATES ===
    // Atualiza status de mensagens enviadas pelo CRM
    if (['email.delivered', 'email.bounced', 'email.complained', 'email.opened'].includes(event.type)) {
      const emailId = event.data.email_id || event.data.message_id
      if (emailId) {
        const externalId = `email-${emailId}`
        const statusMap: Record<string, string> = {
          'email.delivered': 'DELIVERED',
          'email.bounced': 'FAILED',
          'email.complained': 'FAILED',
          'email.opened': 'READ',
        }
        const newStatus = statusMap[event.type]
        if (newStatus) {
          await prisma.message.updateMany({
            where: { waMessageId: externalId },
            data: {
              status: newStatus,
              ...(newStatus === 'READ' ? { readAt: new Date() } : {}),
            },
          })
        }
      }

      return NextResponse.json({ ok: true })
    }

    // === INBOUND EMAIL ===
    // Novo email recebido → criar conversa/mensagem
    if (event.type === 'email.received') {
      const from = event.data.from
      const subject = event.data.subject || '(Sem assunto)'
      const text = event.data.text || event.data.html?.replace(/<[^>]*>/g, '').substring(0, 5000) || ''

      if (!from) return NextResponse.json({ ok: true })

      const emailId = event.data.email_id || event.data.message_id || String(Date.now())
      const externalId = `email-${emailId}`

      // Deduplicação
      const existing = await prisma.message.findUnique({ where: { waMessageId: externalId } })
      if (existing) return NextResponse.json({ ok: true })

      // Encontrar canal de email ativo
      const channel = await prisma.crmChannel.findFirst({
        where: { type: 'email', isActive: true },
      })
      if (!channel) return NextResponse.json({ ok: true })

      const tenantId = channel.tenantId
      const remoteJid = `${from}@email`
      const senderName = event.data.from_name || from.split('@')[0]
      const content = subject !== '(Sem assunto)' ? `${subject}\n\n${text}` : text

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
              email: from,
              source: 'email',
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
            type: 'TEXT',
            content: content.slice(0, 10000),
            channel: 'email',
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
            data: { fromMe: false, content: content.slice(0, 100), messageType: 'TEXT', channel: 'email' },
          })).catch(() => {})
        }
      } catch {
        // ok
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[email-webhook] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: true })
  }
}
