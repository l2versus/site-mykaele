// app/api/admin/crm/leads/move/route.ts — Mover lead entre estágios
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { leadId, fromStageId, toStageId, position, tenantId } = await req.json()

    if (!leadId || !fromStageId || !toStageId || position == null || !tenantId) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Verificar estágio de destino
    const destStage = await prisma.stage.findUnique({
      where: { id: toStageId },
    })
    if (!destStage) {
      return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    }

    // Determinar novo status baseado no tipo do estágio
    let newStatus = lead.status
    if (destStage.type === 'WON') newStatus = 'WON'
    else if (destStage.type === 'LOST') newStatus = 'LOST'
    else if (lead.status === 'WON' || lead.status === 'LOST') newStatus = 'WARM'

    const isSameStage = fromStageId === toStageId

    await prisma.$transaction([
      // Atualizar lead
      prisma.lead.update({
        where: { id: leadId },
        data: {
          stageId: toStageId,
          position,
          status: newStatus,
          closedAt: destStage.type === 'WON' || destStage.type === 'LOST' ? new Date() : null,
        },
      }),

      // Decrementar estágio de origem (se mudou de estágio)
      ...(isSameStage ? [] : [
        prisma.stage.update({
          where: { id: fromStageId },
          data: {
            cachedLeadCount: { decrement: 1 },
            cachedTotalValue: { decrement: lead.expectedValue ?? 0 },
            cacheUpdatedAt: new Date(),
          },
        }),
        // Incrementar estágio de destino
        prisma.stage.update({
          where: { id: toStageId },
          data: {
            cachedLeadCount: { increment: 1 },
            cachedTotalValue: { increment: lead.expectedValue ?? 0 },
            cacheUpdatedAt: new Date(),
          },
        }),
      ]),

      // Registrar atividade
      prisma.leadActivity.create({
        data: {
          leadId,
          type: 'STAGE_CHANGE',
          payload: { from: fromStageId, to: toStageId, position },
          createdBy: payload.userId,
        },
      }),
    ])

    const action = destStage.type === 'WON' ? CRM_ACTIONS.LEAD_WON
      : destStage.type === 'LOST' ? CRM_ACTIONS.LEAD_LOST
      : CRM_ACTIONS.LEAD_MOVED

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action,
      entityId: leadId,
      details: { fromStageId, toStageId, newStatus },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[leads/move] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
