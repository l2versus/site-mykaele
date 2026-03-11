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

    const tenantId = req.nextUrl.searchParams.get('tenantId')
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
    }

    const conversations = await prisma.conversation.findMany({
      where: { tenantId, isClosed: false },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        remoteJid: true,
        unreadCount: true,
        lastMessageAt: true,
        assignedToUserId: true,
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            aiScore: true,
            expectedValue: true,
            tags: true,
          },
        },
      },
      take: 50,
    })

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[conversations] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
