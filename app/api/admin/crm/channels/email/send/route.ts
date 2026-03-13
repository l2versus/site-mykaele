// app/api/admin/crm/channels/email/send/route.ts — Enviar email via CRM
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendCrmEmail } from '@/lib/channels/email'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'
import { redis, isRedisReady } from '@/lib/redis'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { conversationId, text, subject } = await req.json()
    if (!conversationId || !text) {
      return NextResponse.json({ error: 'conversationId e text são obrigatórios' }, { status: 400 })
    }

    let tenantId = process.env.DEFAULT_TENANT_ID ?? ''
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { channel: true, lead: { select: { name: true } } },
    })

    if (!conversation) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    if (conversation.channel.type !== 'email') {
      return NextResponse.json({ error: 'Esta conversa não é de email' }, { status: 400 })
    }

    const recipientEmail = conversation.remoteJid.replace('@email', '')
    const emailSubject = subject || `Re: ${conversation.lead.name} — Clínica Mykaele Procópio`

    const result = await sendCrmEmail(recipientEmail, emailSubject, text)

    const message = await prisma.message.create({
      data: {
        conversationId,
        tenantId,
        waMessageId: result.messageId,
        fromMe: true,
        type: 'TEXT',
        content: text,
        channel: 'email',
        status: 'SENT',
        sentByUserId: payload.userId,
      },
    })

    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
      prisma.lead.update({
        where: { id: conversation.leadId },
        data: { lastInteractionAt: new Date() },
      }),
    ])

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.MESSAGE_SENT,
      entityId: message.id,
      details: { conversationId, channel: 'email', to: recipientEmail },
    })

    if (isRedisReady()) {
      redis.publish('crm:events', JSON.stringify({
        type: 'new-message',
        tenantId,
        data: {
          conversationId,
          leadId: conversation.leadId,
          messageId: message.id,
          fromMe: true,
          content: text.slice(0, 100),
          messageType: 'TEXT',
          channel: 'email',
        },
      })).catch(() => {})
    }

    return NextResponse.json({ success: true, messageId: message.id })
  } catch (err) {
    console.error('[email-send] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
  }
}
