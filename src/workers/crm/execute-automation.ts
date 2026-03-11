// src/workers/crm/execute-automation.ts — Executor de DAG node-by-node com WaitNode via delay
import type { Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { automationQueue } from '../../lib/queues'
import { evolutionApi } from '../../lib/evolution-api'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface AutomationNode {
  id: string
  type: 'trigger' | 'condition' | 'action' | 'wait' | 'end'
  data: Record<string, unknown>
  next?: string[]
}

interface AutomationPayload {
  type: 'execute-automation'
  automationId: string
  tenantId: string
  leadId: string
  currentNodeId: string
  context: Record<string, unknown>
}

/**
 * Executa um nó da automação e enfileira o próximo.
 * Cada nó é processado individualmente — suporta WaitNode via delay do BullMQ.
 */
export async function executeAutomation(job: Job<AutomationPayload>): Promise<void> {
  const { automationId, tenantId, leadId, currentNodeId, context } = job.data

  const automation = await prisma.crmAutomation.findFirst({
    where: { id: automationId, tenantId, isActive: true },
  })
  if (!automation) return

  const flowJson = JSON.parse(JSON.stringify(automation.flowJson)) as { nodes: AutomationNode[] }
  const nodes = flowJson.nodes
  const currentNode = nodes.find(n => n.id === currentNodeId)
  if (!currentNode) return

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  })
  if (!lead) return

  // Executar nó atual
  switch (currentNode.type) {
    case 'trigger':
      // Trigger já foi processado — avançar para próximo nó
      break

    case 'condition': {
      const field = currentNode.data.field as string
      const operator = currentNode.data.operator as string
      const value = currentNode.data.value as string | number

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leadValue = (lead as Record<string, unknown>)[field]
      let result = false

      switch (operator) {
        case 'equals':
          result = leadValue === value
          break
        case 'not_equals':
          result = leadValue !== value
          break
        case 'greater_than':
          result = Number(leadValue) > Number(value)
          break
        case 'less_than':
          result = Number(leadValue) < Number(value)
          break
        case 'contains':
          result = String(leadValue).toLowerCase().includes(String(value).toLowerCase())
          break
      }

      // Condition nodes têm 2 saídas: [trueNext, falseNext]
      const nextNodes = currentNode.next ?? []
      const nextNodeId = result ? nextNodes[0] : nextNodes[1]
      if (nextNodeId) {
        await enqueueNextNode({ automationId, tenantId, leadId, nextNodeId, context })
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
              await evolutionApi.sendTemplate(
                conversation.channel.instanceId,
                conversation.remoteJid,
                template,
                [lead.name],
              )
            } else if (messageText) {
              const text = messageText
                .replace('{{nome}}', lead.name)
                .replace('{{telefone}}', lead.phone)
              await evolutionApi.sendText(
                conversation.channel.instanceId,
                conversation.remoteJid,
                text,
              )
            }
          }
          break
        }

        case 'move_stage': {
          const targetStageId = currentNode.data.stageId as string
          if (targetStageId) {
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
          }
          break
        }

        case 'add_tag': {
          const tag = currentNode.data.tag as string
          if (tag && !lead.tags.includes(tag)) {
            await prisma.lead.update({
              where: { id: leadId },
              data: { tags: [...lead.tags, tag] },
            })
          }
          break
        }

        case 'update_status': {
          const status = currentNode.data.status as 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST'
          if (status) {
            await prisma.lead.update({
              where: { id: leadId },
              data: { status },
            })
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
        await enqueueNextNode({
          automationId, tenantId, leadId,
          nextNodeId: nextNodes[0],
          context,
          delayMs: delayMinutes * 60 * 1000,
        })
      }
      return
    }

    case 'end':
      return
  }

  // Avançar para próximos nós (exceto condition e wait que fazem routing próprio)
  const nextNodes = currentNode.next ?? []
  for (const nextNodeId of nextNodes) {
    await enqueueNextNode({ automationId, tenantId, leadId, nextNodeId, context })
  }
}

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
