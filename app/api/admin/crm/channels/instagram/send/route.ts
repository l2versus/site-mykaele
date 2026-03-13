// app/api/admin/crm/channels/instagram/send/route.ts — Enviar DM pelo Instagram
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptCredentials } from '@/lib/crypto'
import { sendInstagramMessage } from '@/lib/channels/instagram'
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

    const { conversationId, text } = await req.json()
    if (!conversationId || !text) {
      return NextResponse.json({ error: 'conversationId e text são obrigatórios' }, { status: 400 })
    }

    let tenantId = process.env.DEFAULT_TENANT_ID ?? ''
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    // Buscar conversa com canal
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { channel: true },
    })

    if (!conversation) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    if (conversation.channel.type !== 'instagram') {
      return NextResponse.json({ error: 'Esta conversa não é do Instagram' }, { status: 400 })
    }

    // Descriptografar credenciais
    const creds = decryptCredentials(conversation.channel.credentials as string) as {
      accessToken: string
      igAccountId: string
    }

    // Extrair IGSID do remoteJid (formato: "senderId@instagram")
    const recipientId = conversation.remoteJid.replace('@instagram', '')

    // Enviar mensagem
    const result = await sendInstagramMessage(creds.accessToken, recipientId, text)

    // Salvar no banco
    const message = await prisma.message.create({
      data: {
        conversationId,
        tenantId,
        waMessageId: result.messageId,
        fromMe: true,
        type: 'TEXT',
        content: text,
        channel: 'instagram',
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
      details: { conversationId, channel: 'instagram' },
    })

    // SSE
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
          channel: 'instagram',
        },
      })).catch(() => {})
    }

    return NextResponse.json({ success: true, messageId: message.id })
  } catch (err) {
    console.error('[instagram-send] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 })
  }
}
