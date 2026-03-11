// app/api/admin/crm/conversations/messages/route.ts — Mensagens de uma conversa + envio
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'
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
      include: { channel: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    let waMessageId = `local-${randomBytes(8).toString('hex')}`

    // Tentar enviar via Evolution API
    if (conversation.channel?.instanceId) {
      try {
        const result = await evolutionApi.sendText(
          conversation.channel.instanceId,
          conversation.remoteJid,
          content,
        )
        waMessageId = result.key.id
      } catch (err) {
        console.error('[send] Falha ao enviar via Evolution:', err instanceof Error ? err.message : err)
        // Continuar — salvar mensagem como pendente
      }
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
        status: waMessageId.startsWith('local-') ? 'PENDING' : 'SENT',
        sentByUserId: payload.userId,
      },
    })

    // Atualizar lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    })

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.MESSAGE_SENT,
      entityId: message.id,
      details: { conversationId, contentPreview: content.slice(0, 100) },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    console.error('[messages] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
