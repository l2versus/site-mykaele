// src/workers/crm/execute-automation.ts — Executor de automações com logging em CrmAutomationLog
// Suporta três formatos de flowJson:
//   1. Simples (legado):     { action, message?, conditions?, stageId? }
//   2. Multi-ação (novo UI): { actions: [{type, config}], conditions?, triggerConditions? }
//   3. DAG (React Flow):     { nodes: AutomationNode[], edges?: [] }
import type { Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { automationQueue } from '../../lib/queues'
import { evolutionApi } from '../../lib/evolution-api'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
pool.on('error', (err) => console.error('[worker/execute-automation] Pool error:', err.message))
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ━━━ Types ━━━

interface AutomationNode {
  id: string
  type: 'trigger' | 'condition' | 'action' | 'wait' | 'end'
  data: Record<string, unknown>
  next?: string[]
}

interface ActionConfig {
  type: string
  config: Record<string, unknown>
}

interface SimpleFlow {
  action?: string
  actions?: ActionConfig[]
  message?: string
  conditions?: Array<{ field: string; op: string; value: string }>
  triggerConditions?: Array<{ field: string; op: string; value: string }>
  stageId?: string
  tag?: string
  subject?: string
  body?: string
  webhookUrl?: string
}

interface DagFlow {
  nodes: AutomationNode[]
}

export interface AutomationPayload {
  type: 'execute-automation'
  automationId: string
  tenantId: string
  leadId: string
  currentNodeId?: string
  context?: Record<string, unknown>
}

// ━━━ Logging Helper ━━━

async function logExecution(params: {
  tenantId: string
  automationId: string
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
  error?: string
  jobId?: string
  payload?: unknown
}): Promise<void> {
  try {
    await prisma.crmAutomationLog.create({
      data: {
        tenantId: params.tenantId,
        automationId: params.automationId,
        status: params.status,
        error: params.error,
        jobId: params.jobId,
        payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : undefined,
      },
    })
  } catch (err) {
    console.error('[execute-automation] Falha ao gravar log:', (err as Error).message)
  }
}

// ━━━ Main Entry Point ━━━

export async function executeAutomation(job: Job<AutomationPayload>): Promise<void> {
  const { automationId, tenantId, leadId, currentNodeId, context } = job.data

  // Buscar automação — sem filtro isActive para poder registrar SKIPPED
  const automation = await prisma.crmAutomation.findFirst({
    where: { id: automationId, tenantId },
  })

  if (!automation) {
    await logExecution({
      tenantId, automationId,
      status: 'FAILED',
      error: 'Automação não encontrada',
      jobId: job.id,
      payload: job.data,
    })
    return
  }

  // Se desativada, registrar SKIPPED e sair
  if (!automation.isActive) {
    await logExecution({
      tenantId, automationId,
      status: 'SKIPPED',
      error: 'Automação desativada (isActive: false)',
      jobId: job.id,
    })
    return
  }

  // Detectar formato do flowJson
  const flowRaw = automation.flowJson as Record<string, unknown>
  const flowJson = flowRaw as unknown as DagFlow | SimpleFlow
  const isDag = 'nodes' in flowRaw && Array.isArray(flowRaw.nodes)
  const isMultiAction = 'actions' in flowRaw && Array.isArray(flowRaw.actions)

  try {
    if (isDag) {
      await executeDagNode(job, automation, flowJson as DagFlow, leadId, tenantId, currentNodeId, context ?? {})
    } else if (isMultiAction) {
      await executeMultiActionFlow(job, automation, flowJson as SimpleFlow, leadId, tenantId)
    } else {
      await executeSimpleFlow(job, automation, flowJson as SimpleFlow, leadId, tenantId)
    }

    // Log SUCCESS apenas para nós de ação ou fluxos simples
    // DAG nodes de trigger/condition/wait não geram log de sucesso
    if (!isDag || (currentNodeId && (flowJson as DagFlow).nodes.find(n => n.id === currentNodeId)?.type === 'action')) {
      await logExecution({
        tenantId, automationId,
        status: 'SUCCESS',
        jobId: job.id,
        payload: { leadId, nodeId: currentNodeId },
      })
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await logExecution({
      tenantId, automationId,
      status: 'FAILED',
      error: errorMsg,
      jobId: job.id,
      payload: { leadId, nodeId: currentNodeId },
    })
    throw err // Re-throw para BullMQ retry + DLQ
  }
}

// ━━━ Simple Flow Executor (UI de regras) ━━━

async function executeSimpleFlow(
  job: Job,
  automation: { id: string; name: string },
  flow: SimpleFlow,
  leadId: string,
  tenantId: string,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  })
  if (!lead) throw new Error(`Lead ${leadId} não encontrado`)

  // Verificar condições (se houver)
  if (flow.conditions && flow.conditions.length > 0) {
    const allMatch = flow.conditions.every(cond => {
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
    if (!allMatch) return // Condições não atendidas — sai silenciosamente
  }

  switch (flow.action) {
    case 'SEND_MESSAGE': {
      if (!flow.message) break
      const conversation = await prisma.conversation.findFirst({
        where: { leadId, tenantId },
        include: { channel: true },
      })
      if (conversation?.channel?.instanceId) {
        const text = flow.message
          .replace('{{nome}}', lead.name)
          .replace('{{telefone}}', lead.phone)
          .replace('{{email}}', lead.email ?? '')
        await evolutionApi.sendText(
          conversation.channel.instanceId,
          conversation.remoteJid,
          text,
        )
      }
      break
    }

    case 'MOVE_STAGE': {
      const targetStageId = flow.stageId
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
          where: { id: leadId },
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
      const tag = flow.tag ?? flow.message
      if (tag && !lead.tags.includes(tag)) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { tags: [...lead.tags, tag] },
        })
      }
      break
    }

    case 'SEND_EMAIL': {
      if (!lead.email || !flow.subject || !flow.body) break
      const { sendEmail } = await import('../../lib/email')
      const subj = interpolateVars(flow.subject, lead)
      const htmlBody = `<div style="font-family:sans-serif;line-height:1.6">${interpolateVars(flow.body, lead).replace(/\n/g, '<br>')}</div>`
      await sendEmail({ to: lead.email, subject: subj, html: htmlBody })
      break
    }

    case 'SEND_WEBHOOK': {
      if (!flow.webhookUrl) break
      await fetch(flow.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'automation_triggered',
          automation: automation.name,
          lead: { id: leadId, name: lead.name, phone: lead.phone, email: lead.email, status: lead.status },
          tenantId,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10_000),
      })
      break
    }

    case 'NOTIFY_TEAM': {
      // Publica evento via Redis pub/sub para SSE
      const { redis } = await import('../../lib/queues')
      await redis.publish(`crm:${tenantId}:notifications`, JSON.stringify({
        type: 'AUTOMATION_NOTIFY',
        automationName: automation.name,
        leadName: lead.name,
        message: flow.message ?? `Automação "${automation.name}" disparada`,
        timestamp: new Date().toISOString(),
      }))
      break
    }
  }
}

// ━━━ Interpolação de variáveis ━━━

function interpolateVars(
  template: string,
  lead: { name: string; phone: string; email: string | null },
): string {
  return template
    .replace(/\{\{nome\}\}/gi, lead.name.split(' ')[0] || lead.name)
    .replace(/\{\{telefone\}\}/gi, lead.phone)
    .replace(/\{\{email\}\}/gi, lead.email ?? '')
}

// ━━━ Multi-Action Flow Executor (novo formato UI) ━━━

async function executeMultiActionFlow(
  job: Job,
  automation: { id: string; name: string },
  flow: SimpleFlow,
  leadId: string,
  tenantId: string,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  })
  if (!lead) throw new Error(`Lead ${leadId} não encontrado`)

  // Verificar condições no lead
  if (flow.conditions && flow.conditions.length > 0) {
    const allMatch = flow.conditions.every(cond => {
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

  // Executar cada ação na ordem
  const actions = flow.actions ?? []
  for (const act of actions) {
    await executeSingleAction(act.type, act.config, lead, tenantId, automation)
  }
}

async function executeSingleAction(
  actionType: string,
  config: Record<string, unknown>,
  lead: { id: string; name: string; phone: string; email: string | null; tags: string[]; stageId: string; expectedValue: number | null; status: string },
  tenantId: string,
  automation: { id: string; name: string },
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
        const text = interpolateVars(message, lead)
        await evolutionApi.sendText(conversation.channel.instanceId, conversation.remoteJid, text)
      }
      break
    }

    case 'SEND_EMAIL': {
      const subject = config.subject as string | undefined
      const body = config.body as string | undefined
      if (!lead.email || !subject || !body) break
      const { sendEmail } = await import('../../lib/email')
      await sendEmail({
        to: lead.email,
        subject: interpolateVars(subject, lead),
        html: `<div style="font-family:sans-serif;line-height:1.6">${interpolateVars(body, lead).replace(/\n/g, '<br>')}</div>`,
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
          automation: automation.name,
          lead: { id: lead.id, name: lead.name, phone: lead.phone, email: lead.email, status: lead.status },
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
          data: { cachedLeadCount: { decrement: 1 }, cachedTotalValue: { decrement: lead.expectedValue ?? 0 }, cacheUpdatedAt: new Date() },
        }),
        prisma.lead.update({
          where: { id: lead.id },
          data: { stageId: targetStageId },
        }),
        prisma.stage.update({
          where: { id: targetStageId },
          data: { cachedLeadCount: { increment: 1 }, cachedTotalValue: { increment: lead.expectedValue ?? 0 }, cacheUpdatedAt: new Date() },
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
      const { redis } = await import('../../lib/queues')
      await redis.publish(`crm:${tenantId}:notifications`, JSON.stringify({
        type: 'AUTOMATION_NOTIFY',
        automationName: automation.name,
        leadName: lead.name,
        message: (config.message as string) ?? `Automação "${automation.name}" disparada`,
        timestamp: new Date().toISOString(),
      }))
      break
    }
  }
}

// ━━━ DAG Node Executor (React Flow) ━━━

async function executeDagNode(
  job: Job,
  automation: { id: string },
  flowJson: DagFlow,
  leadId: string,
  tenantId: string,
  currentNodeId: string | undefined,
  context: Record<string, unknown>,
): Promise<void> {
  const nodes = flowJson.nodes
  const currentNode = nodes.find(n => n.id === currentNodeId)
  if (!currentNode) return

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  })
  if (!lead) throw new Error(`Lead ${leadId} não encontrado`)

  switch (currentNode.type) {
    case 'trigger':
      break

    case 'condition': {
      const field = currentNode.data.field as string
      const operator = currentNode.data.operator as string
      const value = currentNode.data.value as string | number
      const leadValue = (lead as Record<string, unknown>)[field]
      let result = false

      switch (operator) {
        case 'equals': result = leadValue === value; break
        case 'not_equals': result = leadValue !== value; break
        case 'greater_than': result = Number(leadValue) > Number(value); break
        case 'less_than': result = Number(leadValue) < Number(value); break
        case 'contains': result = String(leadValue).toLowerCase().includes(String(value).toLowerCase()); break
      }

      const nextNodes = currentNode.next ?? []
      const nextNodeId = result ? nextNodes[0] : nextNodes[1]
      if (nextNodeId) {
        await enqueueNextNode({ automationId: automation.id, tenantId, leadId, nextNodeId, context })
      }
      return
    }

    case 'action': {
      const actionType = currentNode.data.actionType as string

      switch (actionType) {
        case 'send_message': {
          const template = currentNode.data.template as string | undefined
          const messageText = currentNode.data.message as string | undefined
          const conversation = await prisma.conversation.findFirst({
            where: { leadId, tenantId },
            include: { channel: true },
          })
          if (conversation?.channel?.instanceId) {
            if (template) {
              await evolutionApi.sendTemplate(conversation.channel.instanceId, conversation.remoteJid, template, [lead.name])
            } else if (messageText) {
              const text = messageText.replace('{{nome}}', lead.name).replace('{{telefone}}', lead.phone)
              await evolutionApi.sendText(conversation.channel.instanceId, conversation.remoteJid, text)
            }
          }
          break
        }

        case 'move_stage': {
          const targetStageId = currentNode.data.stageId as string
          if (targetStageId && targetStageId !== lead.stageId) {
            await prisma.$transaction([
              prisma.stage.update({ where: { id: lead.stageId }, data: { cachedLeadCount: { decrement: 1 }, cachedTotalValue: { decrement: lead.expectedValue ?? 0 }, cacheUpdatedAt: new Date() } }),
              prisma.lead.update({ where: { id: leadId }, data: { stageId: targetStageId } }),
              prisma.stage.update({ where: { id: targetStageId }, data: { cachedLeadCount: { increment: 1 }, cachedTotalValue: { increment: lead.expectedValue ?? 0 }, cacheUpdatedAt: new Date() } }),
            ])
          }
          break
        }

        case 'add_tag': {
          const tag = currentNode.data.tag as string
          if (tag && !lead.tags.includes(tag)) {
            await prisma.lead.update({ where: { id: leadId }, data: { tags: [...lead.tags, tag] } })
          }
          break
        }

        case 'update_status': {
          const status = currentNode.data.status as 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST'
          if (status) {
            await prisma.lead.update({ where: { id: leadId }, data: { status } })
          }
          break
        }
      }
      break
    }

    case 'wait': {
      const delayMinutes = Number(currentNode.data.delayMinutes ?? 60)
      const nextNodes = currentNode.next ?? []
      if (nextNodes[0]) {
        await enqueueNextNode({ automationId: automation.id, tenantId, leadId, nextNodeId: nextNodes[0], context, delayMs: delayMinutes * 60_000 })
      }
      return
    }

    case 'end':
      return
  }

  // Avançar para próximos nós
  const nextNodes = currentNode.next ?? []
  for (const nextNodeId of nextNodes) {
    await enqueueNextNode({ automationId: automation.id, tenantId, leadId, nextNodeId, context })
  }
}

// ━━━ Enqueue Helper ━━━

async function enqueueNextNode(params: {
  automationId: string
  tenantId: string
  leadId: string
  nextNodeId: string
  context: Record<string, unknown>
  delayMs?: number
}): Promise<void> {
  await automationQueue.add(
    'execute-node',
    {
      type: 'execute-automation' as const,
      automationId: params.automationId,
      tenantId: params.tenantId,
      leadId: params.leadId,
      currentNodeId: params.nextNodeId,
      context: params.context,
    },
    {
      delay: params.delayMs,
      jobId: `auto:${params.automationId}:${params.leadId}:${params.nextNodeId}:${Date.now()}`,
    },
  )
}
