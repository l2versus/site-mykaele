// app/api/admin/crm/stages/[id]/route.ts — Update + Delete individual stage
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

// PUT — Atualizar estágio (nome, cor, tipo)
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
    const { name, color, type } = body as {
      name?: string
      color?: string
      type?: 'OPEN' | 'WON' | 'LOST'
    }

    // Verificar se o estágio existe
    const existing = await prisma.stage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (color !== undefined) updateData.color = color
    if (type !== undefined) updateData.type = type

    const stage = await prisma.stage.update({
      where: { id },
      data: updateData,
    })

    createAuditLog({
      tenantId: existing.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.STAGE_UPDATED,
      entityId: stage.id,
      details: { changes: updateData },
    })

    return NextResponse.json({ stage })
  } catch (err) {
    console.error('[stages/:id] PUT error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — Deletar estágio (com trava de segurança)
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await context.params

    // Verificar se o estágio existe
    const existing = await prisma.stage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    }

    // TRAVA DE SEGURANÇA: verificar se há leads ativos neste estágio
    const activeLeadCount = await prisma.lead.count({
      where: {
        stageId: id,
        deletedAt: null,
      },
    })

    if (activeLeadCount > 0) {
      return NextResponse.json({
        error: `Este estágio possui ${activeLeadCount} lead${activeLeadCount > 1 ? 's' : ''} ativo${activeLeadCount > 1 ? 's' : ''}. Mova ou exclua os leads antes de deletar o estágio.`,
        code: 'STAGE_HAS_LEADS',
        leadCount: activeLeadCount,
      }, { status: 409 })
    }

    // Deletar o estágio
    await prisma.stage.delete({ where: { id } })

    // Reordenar estágios restantes
    const remainingStages = await prisma.stage.findMany({
      where: { pipelineId: existing.pipelineId },
      orderBy: { order: 'asc' },
      select: { id: true },
    })

    if (remainingStages.length > 0) {
      await prisma.$transaction(
        remainingStages.map((s, idx) => prisma.stage.update({
          where: { id: s.id },
          data: { order: idx },
        }))
      )
    }

    createAuditLog({
      tenantId: existing.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.STAGE_DELETED,
      entityId: id,
      details: { name: existing.name, type: existing.type },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[stages/:id] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
