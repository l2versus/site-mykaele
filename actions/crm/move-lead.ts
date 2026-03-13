'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcPosition, needsRebalance, rebalancePositions } from '@/lib/fractional-index'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

const moveLeadSchema = z.object({
  leadId: z.string().min(1),
  fromStageId: z.string().min(1),
  toStageId: z.string().min(1),
  beforePosition: z.number().nullable(),
  afterPosition: z.number().nullable(),
})

interface MoveLeadResult {
  ok: boolean
  position?: number
  error?: string
}

export async function moveLead(input: z.input<typeof moveLeadSchema>): Promise<MoveLeadResult> {
  const parsed = moveLeadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos' }

  const { leadId, fromStageId, toStageId, beforePosition, afterPosition } = parsed.data

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return { ok: false, error: 'Não autorizado' }

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return { ok: false, error: 'Não autorizado' }

  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return { ok: false, error: 'Tenant não configurado' }

  const newPosition = calcPosition(beforePosition, afterPosition)

  // Transação: mover lead + atualizar cache dos estágios
  const lead = await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null },
      select: { id: true, stageId: true, expectedValue: true, status: true },
    })

    if (!existing) throw new Error('Lead não encontrado')

    // Determinar novo status baseado no tipo do estágio de destino
    const targetStage = await tx.stage.findUnique({
      where: { id: toStageId },
      select: { type: true },
    })

    if (!targetStage) throw new Error('Estágio não encontrado')

    const newStatus = targetStage.type === 'WON' ? 'WON' as const
      : targetStage.type === 'LOST' ? 'LOST' as const
      : existing.status

    const closedAt = (targetStage.type === 'WON' || targetStage.type === 'LOST')
      ? new Date()
      : undefined

    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        stageId: toStageId,
        position: newPosition,
        status: newStatus,
        closedAt,
        lastInteractionAt: new Date(),
      },
    })

    // Atualizar cache: decrementa origem, incrementa destino
    if (fromStageId !== toStageId) {
      const value = existing.expectedValue ?? 0

      await tx.stage.update({
        where: { id: fromStageId },
        data: {
          cachedLeadCount: { decrement: 1 },
          cachedTotalValue: { decrement: value },
          cacheUpdatedAt: new Date(),
        },
      })

      await tx.stage.update({
        where: { id: toStageId },
        data: {
          cachedLeadCount: { increment: 1 },
          cachedTotalValue: { increment: value },
          cacheUpdatedAt: new Date(),
        },
      })
    }

    return updated
  })

  // Verificar se precisa rebalancear posições no estágio de destino
  const stageLeads = await prisma.lead.findMany({
    where: { stageId: toStageId, deletedAt: null },
    select: { id: true, position: true },
    orderBy: { position: 'asc' },
  })

  if (needsRebalance(stageLeads.map(l => l.position))) {
    const rebalanced = rebalancePositions(stageLeads)
    await prisma.$transaction(
      rebalanced.map(({ id, position }) =>
        prisma.lead.update({ where: { id }, data: { position } })
      )
    )
  }

  // Log de auditoria (fire-and-forget)
  const action = toStageId !== fromStageId
    ? (lead.status === 'WON' ? CRM_ACTIONS.LEAD_WON : lead.status === 'LOST' ? CRM_ACTIONS.LEAD_LOST : CRM_ACTIONS.LEAD_MOVED)
    : CRM_ACTIONS.LEAD_MOVED

  createAuditLog({
    tenantId,
    userId: payload.userId,
    action,
    entityId: leadId,
    details: { fromStageId, toStageId, position: newPosition },
  })

  // Log de atividade para relatórios
  const { logActivity } = await import('@/lib/activity-log')
  const actType = lead.status === 'WON' ? 'LEAD_WON' as const : lead.status === 'LOST' ? 'LEAD_LOST' as const : 'LEAD_STAGE_CHANGED' as const
  logActivity({ tenantId, type: actType, description: actType === 'LEAD_WON' ? 'Lead marcado como ganho' : actType === 'LEAD_LOST' ? 'Lead marcado como perdido' : 'Lead movido de estagio', leadId, userId: payload.userId, metadata: { fromStageId, toStageId, status: lead.status } })

  // Disparar automações por gatilho (non-blocking)
  if (fromStageId !== toStageId) {
    const { fireAutomations } = await import('@/lib/automation-engine')
    void fireAutomations('LEAD_STAGE_CHANGED', {
      tenantId,
      leadId,
      metadata: {
        fromStageId,
        toStageId,
        newStatus: lead.status,
        stageType: lead.status === 'WON' ? 'WON' : lead.status === 'LOST' ? 'LOST' : 'OPEN',
      },
    })
  }

  return { ok: true, position: newPosition }
}
