// app/api/admin/crm/leads/[id]/route.ts — Lead detail + update
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Query lead com estágio, conversas e atividades
    const lead = await prisma.lead.findUnique({
      where: { id, deletedAt: null },
      include: {
        stage: { select: { id: true, name: true, color: true, type: true } },
        conversations: {
          where: { isClosed: false },
          take: 1,
          orderBy: { lastMessageAt: 'desc' },
          select: {
            id: true,
            lastMessageAt: true,
            unreadCount: true,
            messages: {
              take: 30,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                fromMe: true,
                type: true,
                content: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        activities: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            payload: true,
            createdBy: true,
            createdAt: true,
          },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ lead })
  } catch (err) {
    console.error('[lead detail] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const allowedFields = ['tags', 'status', 'expectedValue', 'email', 'source']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    const lead = await prisma.lead.update({
      where: { id, deletedAt: null },
      data,
    })

    createAuditLog({
      tenantId: lead.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.LEAD_MOVED,
      entityId: lead.id,
      details: { updatedFields: Object.keys(data) },
    })

    return NextResponse.json({ lead })
  } catch (err) {
    console.error('[lead detail] PATCH error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
