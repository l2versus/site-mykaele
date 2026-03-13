// src/lib/automation-engine.ts — Motor de automações por gatilho
// Dispara automações automaticamente quando eventos ocorrem no CRM.
// Usado pelo webhook-processor (mensagem recebida, lead criado) e
// pela server action move-lead (lead mudou de estágio).
//
// Se Redis estiver disponível, enfileira via BullMQ.
// Se não, executa inline via executeAutomationInline().

import { prisma } from '@/lib/prisma'
import { automationQueue } from '@/lib/queues'
import { isRedisReady } from '@/lib/redis'

type TriggerType =
  | 'NEW_MESSAGE_RECEIVED'
  | 'LEAD_STAGE_CHANGED'
  | 'LEAD_CREATED'
  | 'CONTACT_IDLE'
  | 'APPOINTMENT_BOOKED'
  | 'APPOINTMENT_COMPLETED'

interface TriggerContext {
  /** ID do lead afetado */
  leadId: string
  /** ID do tenant */
  tenantId: string
  /** Metadados opcionais do evento */
  metadata?: Record<string, unknown>
}

/**
 * Dispara todas as automações ativas que correspondem ao gatilho.
 * Non-blocking: erros são logados mas não propagados.
 */
export async function fireAutomations(
  trigger: TriggerType,
  ctx: TriggerContext,
): Promise<void> {
  const { leadId, tenantId, metadata } = ctx

  try {
    // Buscar automações ativas que correspondem ao gatilho
    const automations = await prisma.crmAutomation.findMany({
      where: {
        tenantId,
        trigger,
        isActive: true,
      },
      select: { id: true, name: true, flowJson: true },
    })

    if (automations.length === 0) return

    for (const automation of automations) {
      // Verificar condições pré-filtro no flowJson (ex: stageType = WON)
      const flow = automation.flowJson as Record<string, unknown>
      if (!matchesPreConditions(flow, metadata)) continue

      const jobData = {
        type: 'execute-automation' as const,
        automationId: automation.id,
        tenantId,
        leadId,
        context: {
          scheduledBy: 'automation-engine',
          trigger,
          metadata,
        },
      }

      if (isRedisReady()) {
        // Enfileirar no BullMQ
        const jobId = `auto:${automation.id}:${leadId}:${Date.now()}`
        await automationQueue.add('execute-automation', jobData, { jobId })
      } else {
        // Fallback síncrono — executa inline
        void executeInline(automation.id, tenantId, leadId, flow, metadata).catch(err => {
          console.error(`[automation-engine] Erro inline ${automation.name}:`, err instanceof Error ? err.message : err)
        })
      }
    }
  } catch (err) {
    // Non-blocking — não deve quebrar o fluxo chamador
    console.error('[automation-engine] Erro ao disparar automações:', err instanceof Error ? err.message : err)
  }
}

/**
 * Verifica condições de pré-filtro no flowJson.
 * Ex: trigger LEAD_STAGE_CHANGED com condição stageType=WON
 */
function matchesPreConditions(
  flow: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): boolean {
  if (!metadata) return true

  // Verificar condições de gatilho (triggerConditions)
  const triggerConditions = flow.triggerConditions as
    | Array<{ field: string; op: string; value: string }>
    | undefined

  if (!triggerConditions || triggerConditions.length === 0) return true

  return triggerConditions.every(cond => {
    const value = metadata[cond.field]
    if (value === undefined) return false

    switch (cond.op) {
      case 'eq': return String(value) === cond.value
      case 'neq': return String(value) !== cond.value
      case 'contains': return String(value).toLowerCase().includes(cond.value.toLowerCase())
      default: return true
    }
  })
}

/**
 * Execução inline quando Redis está offline.
 * Versão simplificada que suporta ações básicas.
 */
async function executeInline(
  automationId: string,
  tenantId: string,
  leadId: string,
  flow: Record<string, unknown>,
  _metadata?: Record<string, unknown>,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  })
  if (!lead) return

  // Verificar condições no lead
  const conditions = flow.conditions as
    | Array<{ field: string; op: string; value: string }>
    | undefined

  if (conditions && conditions.length > 0) {
    const allMatch = conditions.every(cond => {
      const leadValue = (lead as Record<string, unknown>)[cond.field.replace('lead.', '')]
      switch (cond.op) {
        case 'eq': return String(leadValue) === cond.value
        case 'neq': return String(leadValue) !== cond.value
        case 'gt': return Number(leadValue) > Number(cond.value)
        case 'lt': return Number(leadValue) < Number(cond.value)
        case 'contains': return String(leadValue).toLowerCase().includes(cond.value.toLowerCase())
        default: return true
      }
    })
    if (!allMatch) return
  }

  // Suporta formato multi-ação e single action
  const actions = (flow.actions as Array<{ type: string; config: Record<string, unknown> }>) ?? []
  const singleAction = flow.action as string | undefined

  if (actions.length > 0) {
    for (const act of actions) {
      await executeInlineAction(act.type, act.config, lead, tenantId)
    }
  } else if (singleAction) {
    await executeInlineAction(singleAction, flow as Record<string, unknown>, lead, tenantId)
  }

  // Log de execução
  await prisma.crmAutomationLog.create({
    data: {
      tenantId,
      automationId,
      status: 'SUCCESS',
      payload: { leadId, executedInline: true },
    },
  }).catch(err => {
    console.error('[automation-engine] Falha ao gravar log:', (err as Error).message)
  })
}

async function executeInlineAction(
  actionType: string,
  config: Record<string, unknown>,
  lead: { id: string; name: string; phone: string; email: string | null; tags: string[]; stageId: string; expectedValue: number | null },
  tenantId: string,
): Promise<void> {
  switch (actionType) {
    case 'SEND_MESSAGE': {
      const message = config.message as string | undefined
      if (!message) break
      const conversation = await prisma.conversation.findFirst({
        where: { leadId: lead.id, tenantId },
        include: { channel: true },
      })
      if (conversation?.channel?.instanceId) {
        const { evolutionApi } = await import('@/lib/evolution-api')
        const text = interpolateVars(message, lead)
        await evolutionApi.sendText(conversation.channel.instanceId, conversation.remoteJid, text)
      }
      break
    }

    case 'SEND_EMAIL': {
      const subject = config.subject as string | undefined
      const body = config.body as string | undefined
      if (!lead.email || !subject || !body) break
      const { sendEmail } = await import('@/lib/email')
      await sendEmail({
        to: lead.email,
        subject: interpolateVars(subject, lead),
        html: `<div style="font-family: sans-serif; line-height: 1.6;">${interpolateVars(body, lead).replace(/\n/g, '<br>')}</div>`,
      })
      break
    }

    case 'SEND_WEBHOOK': {
      const url = config.webhookUrl as string | undefined
      if (!url) break
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'automation_triggered',
          lead: { id: lead.id, name: lead.name, phone: lead.phone, email: lead.email },
          tenantId,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10_000),
      })
      break
    }

    case 'MOVE_STAGE': {
      const targetStageId = config.stageId as string | undefined
      if (!targetStageId || targetStageId === lead.stageId) break
      await prisma.$transaction([
        prisma.stage.update({
          where: { id: lead.stageId },
          data: {
            cachedLeadCount: { decrement: 1 },
            cachedTotalValue: { decrement: lead.expectedValue ?? 0 },
            cacheUpdatedAt: new Date(),
          },
        }),
        prisma.lead.update({
          where: { id: lead.id },
          data: { stageId: targetStageId },
        }),
        prisma.stage.update({
          where: { id: targetStageId },
          data: {
            cachedLeadCount: { increment: 1 },
            cachedTotalValue: { increment: lead.expectedValue ?? 0 },
            cacheUpdatedAt: new Date(),
          },
        }),
      ])
      break
    }

    case 'ADD_TAG': {
      const tag = (config.tag as string) ?? (config.message as string)
      if (tag && !lead.tags.includes(tag)) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { tags: [...lead.tags, tag] },
        })
      }
      break
    }

    case 'NOTIFY_TEAM': {
      if (isRedisReady()) {
        const { redis } = await import('@/lib/queues')
        await redis.publish(`crm:${tenantId}:notifications`, JSON.stringify({
          type: 'AUTOMATION_NOTIFY',
          leadName: lead.name,
          message: (config.message as string) ?? 'Automação disparada',
          timestamp: new Date().toISOString(),
        }))
      }
      break
    }
  }
}

function interpolateVars(
  template: string,
  lead: { name: string; phone: string; email: string | null },
): string {
  return template
    .replace(/\{\{nome\}\}/gi, lead.name.split(' ')[0] || lead.name)
    .replace(/\{\{telefone\}\}/gi, lead.phone)
    .replace(/\{\{email\}\}/gi, lead.email ?? '')
}
