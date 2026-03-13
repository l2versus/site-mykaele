// app/api/admin/crm/conversations/messages/route.ts — Mensagens de uma conversa + envio (multi-canal)
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getChannelProvider } from '@/lib/channels'
import type { ChannelType } from '@/lib/channels/types'
import { decryptCredentials } from '@/lib/crypto'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'
import { redis, isRedisReady } from '@/lib/redis'
import { randomBytes } from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const conversationId = req.nextUrl.searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId é obrigatório' }, { status: 400 })
    }

    const cursor = req.nextUrl.searchParams.get('cursor')
    const limit = 50

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        fromMe: true,
        type: true,
        content: true,
        mediaMimeType: true,
        mediaUrl: true,
        isClinicalMedia: true,
        status: true,
        readAt: true,
        sentByUserId: true,
        createdAt: true,
      },
    })

    const hasMore = messages.length > limit
    if (hasMore) messages.pop()

    // Marcar como lidas
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    })

    return NextResponse.json({
      messages: messages.reverse(),
      hasMore,
      nextCursor: hasMore ? messages[0]?.id : null,
    })
  } catch (err) {
    console.error('[messages] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * Resolve o instanceId correto para o provedor do canal.
 * - WhatsApp: instanceId do CrmChannel (nome da instância Evolution API)
 * - Instagram/Facebook: accessToken descriptografado
 * - Telegram: botToken descriptografado
 * - Email: instanceId ou vazio (usa RESEND_API_KEY do env)
 */
function resolveProviderInstanceId(channel: { type: string; instanceId: string | null; credentials: unknown }): string {
  const channelType = channel.type as ChannelType

  if (channelType === 'whatsapp') {
    return channel.instanceId ?? ''
  }

  if (channelType === 'email') {
    return channel.instanceId ?? ''
  }

  // Instagram, Facebook, Telegram — credenciais criptografadas
  if (channel.credentials) {
    try {
      const creds = decryptCredentials(channel.credentials as string) as Record<string, string>
      if (channelType === 'telegram') return creds.botToken ?? ''
      return creds.accessToken ?? '' // Instagram e Facebook
    } catch {
      return ''
    }
  }

  return ''
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { conversationId, content, tenantId } = await req.json()

    if (!conversationId || !content || !tenantId) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { channel: true, lead: { select: { id: true } } },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const channelType = (conversation.channel?.type ?? 'whatsapp') as ChannelType
    let waMessageId = `local-${randomBytes(8).toString('hex')}`
    let status = 'PENDING'

    // Enviar via provedor do canal (multi-canal)
    const providerInstanceId = resolveProviderInstanceId(conversation.channel)

    if (providerInstanceId) {
      try {
        const provider = getChannelProvider(channelType)
        const result = await provider.sendMessage({
          instanceId: providerInstanceId,
          remoteId: conversation.remoteJid,
          text: content,
        })
        waMessageId = result.messageId
        status = result.status
      } catch (err) {
        console.error(`[send] Falha ao enviar via ${channelType}:`, err instanceof Error ? err.message : err)
      }
    } else {
      console.error(`[send] Canal ${channelType} sem instanceId/credenciais — mensagem salva como PENDING`)
    }

    // Salvar mensagem no banco
    const message = await prisma.message.create({
      data: {
        conversationId,
        tenantId,
        waMessageId,
        fromMe: true,
        type: 'TEXT',
        content,
        channel: channelType,
        status,
        sentByUserId: payload.userId,
      },
    })

    // Atualizar lastMessageAt na conversa e lead
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
      details: { conversationId, channel: channelType, contentPreview: content.slice(0, 100) },
    })

    // Publicar via SSE para atualização em tempo real
    if (isRedisReady()) {
      redis.publish('crm:events', JSON.stringify({
        type: 'new-message',
        tenantId,
        data: {
          conversationId,
          leadId: conversation.leadId,
          messageId: message.id,
          fromMe: true,
          content: content.slice(0, 100),
          messageType: 'TEXT',
          channel: channelType,
        },
      })).catch(() => {})
    }

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    console.error('[messages] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
