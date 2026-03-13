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
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        stageId: true,
        expectedValue: true,
        aiScore: true,
        aiScoreLabel: true,
        churnRisk: true,
        bestContactDays: true,
        bestContactHours: true,
        bestContactBasis: true,
        tags: true,
        source: true,
        lastInteractionAt: true,
        createdAt: true,
        patientId: true,
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

    const allowedFields = ['name', 'phone', 'tags', 'status', 'expectedValue', 'email', 'source']
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

export async function DELETE(
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

    const lead = await prisma.lead.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, stageId: true, expectedValue: true, tenantId: true, name: true },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Soft-delete + atualizar cache do estágio em transação
    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.stage.update({
        where: { id: lead.stageId },
        data: {
          cachedLeadCount: { decrement: 1 },
          cachedTotalValue: { decrement: lead.expectedValue ?? 0 },
          cacheUpdatedAt: new Date(),
        },
      }),
    ])

    createAuditLog({
      tenantId: lead.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.LEAD_DELETED,
      entityId: lead.id,
      details: { name: lead.name },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[lead detail] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
