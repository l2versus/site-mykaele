// app/api/admin/crm/bots/[id]/route.ts — GET, PUT, DELETE de fluxo de bot
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await context.params

    const bot = await prisma.crmBotFlow.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { status: 'active' },
          select: { id: true, leadId: true, currentNodeId: true, startedAt: true },
          take: 20,
        },
        _count: {
          select: { sessions: true },
        },
      },
    })

    if (!bot) {
      return NextResponse.json({ error: 'Bot não encontrado' }, { status: 404 })
    }

    return NextResponse.json(bot)
  } catch (err) {
    console.error('[bots] GET by id error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await req.json()

    const existing = await prisma.crmBotFlow.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bot não encontrado' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType
    if (body.triggerConfig !== undefined) updateData.triggerConfig = body.triggerConfig
    if (body.nodes !== undefined) updateData.nodes = body.nodes
    if (body.edges !== undefined) updateData.edges = body.edges
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    const bot = await prisma.crmBotFlow.update({
      where: { id },
      data: updateData,
    })

    createAuditLog({
      tenantId: existing.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.AUTOMATION_UPDATED,
      entityId: bot.id,
      details: { name: bot.name, changes: Object.keys(updateData), type: 'bot_flow' },
    })

    return NextResponse.json(bot)
  } catch (err) {
    console.error('[bots] PUT error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await context.params

    const existing = await prisma.crmBotFlow.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bot não encontrado' }, { status: 404 })
    }

    // Encerrar sessões ativas antes de deletar
    await prisma.crmBotSession.updateMany({
      where: { flowId: id, status: 'active' },
      data: { status: 'completed', completedAt: new Date() },
    })

    await prisma.crmBotFlow.delete({ where: { id } })

    createAuditLog({
      tenantId: existing.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.AUTOMATION_DELETED,
      entityId: id,
      details: { name: existing.name, type: 'bot_flow' },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[bots] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
