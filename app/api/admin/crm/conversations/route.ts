// app/api/admin/crm/conversations/route.ts — Lista de conversas
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    let tenantId = req.nextUrl.searchParams.get('tenantId')
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
    }

    // Resolver slug → cuid
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    const search = req.nextUrl.searchParams.get('search')?.toLowerCase()
    const channelFilter = req.nextUrl.searchParams.get('channel') // whatsapp, instagram, facebook, telegram, email

    const channelWhere = channelFilter
      ? { channel: { type: channelFilter } }
      : {}

    const conversations = await prisma.conversation.findMany({
      where: { tenantId, isClosed: false, ...channelWhere },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        remoteJid: true,
        unreadCount: true,
        lastMessageAt: true,
        assignedToUserId: true,
        channel: {
          select: { type: true, name: true },
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            aiScore: true,
            expectedValue: true,
            tags: true,
            source: true,
            stageId: true,
            churnRisk: true,
            bestContactDays: true,
            bestContactHours: true,
            lastInteractionAt: true,
            createdAt: true,
            stage: { select: { name: true, color: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, fromMe: true, type: true, createdAt: true, channel: true },
        },
      },
      take: 100,
    })

    // Enriquecer com última mensagem e filtrar por busca
    let result = conversations.map(c => ({
      ...c,
      channelType: c.channel?.type ?? 'whatsapp',
      lastMessage: c.messages[0] ?? null,
      messages: undefined,
    }))

    if (search) {
      result = result.filter(c =>
        c.lead.name.toLowerCase().includes(search) ||
        c.lead.phone.includes(search)
      )
    }

    return NextResponse.json({ conversations: result })
  } catch (err) {
    console.error('[conversations] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
