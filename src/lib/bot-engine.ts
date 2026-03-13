// src/lib/bot-engine.ts — Motor de execução de fluxos de bot visual
// Quando mensagem chega:
//   1. Verifica se lead tem sessão ativa de bot → processa no fluxo atual
//   2. Se não, verifica se algum fluxo ativo tem gatilho que bate → inicia sessão
//   3. Fallback: retorna false → webhook-processor usa auto-reply ou humano
//
// Node types: TRIGGER, MESSAGE, QUESTION, CONDITION, ACTION, DELAY, END

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'

// ─── Tipos dos nós do React Flow ─────────────────────────────────

interface FlowNode {
  id: string
  type: string
  data: Record<string, unknown>
  position: { x: number; y: number }
}

interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
}

interface SessionData {
  answers: Record<string, string>
  variables: Record<string, unknown>
  lastQuestionNodeId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────

function getOutgoingEdges(edges: FlowEdge[], nodeId: string): FlowEdge[] {
  return edges.filter(e => e.source === nodeId)
}

function findNodeById(nodes: FlowNode[], id: string): FlowNode | undefined {
  return nodes.find(n => n.id === id)
}

function interpolateVars(
  text: string,
  leadName: string,
  sessionData: SessionData,
): string {
  let result = text
    .replace(/\{\{nome\}\}/gi, leadName.split(' ')[0] || leadName)

  // Substituir respostas coletadas: {{resposta_nodeId}}
  for (const [key, val] of Object.entries(sessionData.answers)) {
    result = result.replace(new RegExp(`\\{\\{resposta_${key}\\}\\}`, 'gi'), val)
  }
  // Variáveis genéricas: {{var_nome}}
  for (const [key, val] of Object.entries(sessionData.variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val))
  }
  return result
}

// ─── Enviar mensagem via WhatsApp ─────────────────────────────────

async function sendBotMessage(
  tenantId: string,
  conversationId: string,
  instanceId: string,
  remoteJid: string,
  text: string,
): Promise<void> {
  try {
    const result = await evolutionApi.sendText(instanceId, remoteJid, text)

    if (result?.key?.id) {
      await prisma.message.create({
        data: {
          conversationId,
          tenantId,
          waMessageId: result.key.id,
          fromMe: true,
          type: 'TEXT',
          content: text,
          status: 'SENT',
          sentByUserId: 'bot',
        },
      })
    }
  } catch (err) {
    console.error('[bot-engine] Erro ao enviar mensagem:', err instanceof Error ? err.message : err)
  }
}

// ─── Verificar gatilho ────────────────────────────────────────────

function matchesTrigger(
  flow: { triggerType: string; triggerConfig: unknown },
  messageContent: string,
): boolean {
  switch (flow.triggerType) {
    case 'any_new_conversation':
      return true

    case 'keyword': {
      const config = flow.triggerConfig as { keywords?: string[] } | null
      if (!config?.keywords?.length) return false
      const lower = messageContent.toLowerCase().trim()
      return config.keywords.some(kw => lower.includes(kw.toLowerCase()))
    }

    case 'schedule': {
      const config = flow.triggerConfig as { schedule?: string } | null
      if (!config?.schedule) return true
      // Formato: "08:00-18:00"
      const [start, end] = config.schedule.split('-')
      if (!start || !end) return true
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const current = hours * 60 + minutes
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      return current >= (sh * 60 + sm) && current <= (eh * 60 + em)
    }

    default:
      return false
  }
}

// ─── Encontrar o primeiro nó TRIGGER do fluxo ────────────────────

function findTriggerNode(nodes: FlowNode[]): FlowNode | undefined {
  return nodes.find(n => n.type === 'trigger')
}

// ─── Avançar para o próximo nó e executar ─────────────────────────

async function advanceToNode(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  session: { id: string; data: SessionData },
  ctx: {
    tenantId: string
    leadId: string
    leadName: string
    conversationId: string
    instanceId: string
    remoteJid: string
    flowId: string
    incomingMessage?: string
  },
): Promise<void> {
  const node = findNodeById(nodes, nodeId)
  if (!node) {
    await endSession(session.id, 'completed')
    return
  }

  switch (node.type) {
    case 'trigger': {
      // Pular trigger — ir para próximo nó
      const outgoing = getOutgoingEdges(edges, node.id)
      if (outgoing.length > 0 && outgoing[0]) {
        await advanceToNode(outgoing[0].target, nodes, edges, session, ctx)
      } else {
        await endSession(session.id, 'completed')
      }
      break
    }

    case 'message': {
      // Enviar mensagem e avançar imediatamente
      const text = node.data.message as string | undefined
      if (text) {
        const interpolated = interpolateVars(text, ctx.leadName, session.data)
        await sendBotMessage(ctx.tenantId, ctx.conversationId, ctx.instanceId, ctx.remoteJid, interpolated)
      }

      const outgoing = getOutgoingEdges(edges, node.id)
      if (outgoing.length > 0 && outgoing[0]) {
        // Pequeno delay entre mensagens consecutivas para parecer humano
        await new Promise(r => setTimeout(r, 1500))
        await advanceToNode(outgoing[0].target, nodes, edges, session, ctx)
      } else {
        await endSession(session.id, 'completed')
      }
      break
    }

    case 'question': {
      // Enviar pergunta e PARAR — esperar resposta do lead
      const text = node.data.question as string | undefined
      if (text) {
        const interpolated = interpolateVars(text, ctx.leadName, session.data)
        await sendBotMessage(ctx.tenantId, ctx.conversationId, ctx.instanceId, ctx.remoteJid, interpolated)
      }

      // Salvar posição atual — próxima mensagem do lead será a resposta
      session.data.lastQuestionNodeId = node.id
      await prisma.crmBotSession.update({
        where: { id: session.id },
        data: {
          currentNodeId: node.id,
          data: session.data as unknown as Prisma.InputJsonValue,
          lastActivityAt: new Date(),
        },
      })
      break
    }

    case 'condition': {
      // Avaliar condição e seguir pela branch correta
      const field = node.data.field as string | undefined    // 'answer' | 'lead.status' etc.
      const op = node.data.operator as string | undefined    // 'eq' | 'contains' | 'any'
      const value = node.data.value as string | undefined

      let matched = false
      const outgoing = getOutgoingEdges(edges, node.id)

      if (field === 'answer' && ctx.incomingMessage) {
        const answer = ctx.incomingMessage.toLowerCase().trim()
        switch (op) {
          case 'eq': matched = answer === value?.toLowerCase(); break
          case 'contains': matched = !!value && answer.includes(value.toLowerCase()); break
          case 'any': matched = true; break
          default: matched = true
        }
      } else if (field && field.startsWith('lead.')) {
        // Buscar campo do lead
        const lead = await prisma.lead.findFirst({
          where: { id: ctx.leadId, tenantId: ctx.tenantId, deletedAt: null },
        })
        if (lead) {
          const leadField = field.replace('lead.', '')
          const leadValue = String((lead as Record<string, unknown>)[leadField] ?? '')
          switch (op) {
            case 'eq': matched = leadValue === value; break
            case 'contains': matched = !!value && leadValue.toLowerCase().includes(value.toLowerCase()); break
            default: matched = true
          }
        }
      } else {
        matched = true
      }

      // sourceHandle: 'true' ou 'false' determina qual edge seguir
      const targetEdge = outgoing.find(e =>
        e.sourceHandle === (matched ? 'true' : 'false'),
      ) ?? outgoing[0] // fallback para primeira edge se não tiver handles

      if (targetEdge) {
        await advanceToNode(targetEdge.target, nodes, edges, session, ctx)
      } else {
        await endSession(session.id, 'completed')
      }
      break
    }

    case 'action': {
      // Executar ação (mover estágio, adicionar tag, etc.) e avançar
      const actionType = node.data.actionType as string | undefined
      await executeNodeAction(actionType, node.data, ctx)

      const outgoing = getOutgoingEdges(edges, node.id)
      if (outgoing.length > 0 && outgoing[0]) {
        await advanceToNode(outgoing[0].target, nodes, edges, session, ctx)
      } else {
        await endSession(session.id, 'completed')
      }
      break
    }

    case 'delay': {
      // Salvar posição e agendar continuação
      // Por agora, delay curto inline (máx 30s); delays longos precisam de scheduler
      const delaySeconds = Math.min(Number(node.data.seconds) || 5, 30)

      await prisma.crmBotSession.update({
        where: { id: session.id },
        data: {
          currentNodeId: node.id,
          data: session.data as unknown as Prisma.InputJsonValue,
          lastActivityAt: new Date(),
        },
      })

      await new Promise(r => setTimeout(r, delaySeconds * 1000))

      const outgoing = getOutgoingEdges(edges, node.id)
      if (outgoing.length > 0 && outgoing[0]) {
        await advanceToNode(outgoing[0].target, nodes, edges, session, ctx)
      } else {
        await endSession(session.id, 'completed')
      }
      break
    }

    case 'end': {
      // Fluxo concluído
      const endMessage = node.data.message as string | undefined
      if (endMessage) {
        const interpolated = interpolateVars(endMessage, ctx.leadName, session.data)
        await sendBotMessage(ctx.tenantId, ctx.conversationId, ctx.instanceId, ctx.remoteJid, interpolated)
      }

      // Se nó final tem ação de transferência
      const transfer = node.data.transfer as boolean | undefined
      const status = transfer ? 'transferred' : 'completed'
      await endSession(session.id, status)
      break
    }

    default: {
      // Tipo desconhecido — pular para próximo
      const outgoing = getOutgoingEdges(edges, node.id)
      if (outgoing.length > 0 && outgoing[0]) {
        await advanceToNode(outgoing[0].target, nodes, edges, session, ctx)
      } else {
        await endSession(session.id, 'completed')
      }
    }
  }
}

// ─── Executar ação de um nó ACTION ────────────────────────────────

async function executeNodeAction(
  actionType: string | undefined,
  data: Record<string, unknown>,
  ctx: { tenantId: string; leadId: string },
): Promise<void> {
  if (!actionType) return

  try {
    switch (actionType) {
      case 'move_stage': {
        const stageId = data.stageId as string | undefined
        if (!stageId) break
        const lead = await prisma.lead.findFirst({
          where: { id: ctx.leadId, tenantId: ctx.tenantId, deletedAt: null },
          select: { stageId: true, expectedValue: true },
        })
        if (!lead || lead.stageId === stageId) break

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
            where: { id: ctx.leadId },
            data: { stageId },
          }),
          prisma.stage.update({
            where: { id: stageId },
            data: {
              cachedLeadCount: { increment: 1 },
              cachedTotalValue: { increment: lead.expectedValue ?? 0 },
              cacheUpdatedAt: new Date(),
            },
          }),
        ])
        break
      }

      case 'add_tag': {
        const tag = data.tag as string | undefined
        if (!tag) break
        const lead = await prisma.lead.findFirst({
          where: { id: ctx.leadId, tenantId: ctx.tenantId, deletedAt: null },
          select: { tags: true },
        })
        if (lead && !lead.tags.includes(tag)) {
          await prisma.lead.update({
            where: { id: ctx.leadId },
            data: { tags: [...lead.tags, tag] },
          })
        }
        break
      }

      case 'set_status': {
        const status = data.status as 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST' | undefined
        if (!status) break
        await prisma.lead.update({
          where: { id: ctx.leadId },
          data: { status },
        })
        break
      }

      case 'set_value': {
        const value = Number(data.value)
        if (isNaN(value)) break
        await prisma.lead.update({
          where: { id: ctx.leadId },
          data: { expectedValue: value },
        })
        break
      }
    }
  } catch (err) {
    console.error('[bot-engine] Erro ao executar ação:', err instanceof Error ? err.message : err)
  }
}

// ─── Encerrar sessão ──────────────────────────────────────────────

async function endSession(
  sessionId: string,
  status: 'completed' | 'timeout' | 'transferred',
): Promise<void> {
  await prisma.crmBotSession.update({
    where: { id: sessionId },
    data: { status, completedAt: new Date() },
  }).catch(err => {
    console.error('[bot-engine] Erro ao encerrar sessão:', err instanceof Error ? err.message : err)
  })
}

// ─── API Pública ──────────────────────────────────────────────────

/**
 * Processa mensagem recebida pelo motor de bots.
 * Retorna true se o bot tratou a mensagem (não deve ir para auto-reply).
 * Retorna false se nenhum bot ativo — fallback para auto-reply/humano.
 */
export async function tryBotReply(params: {
  tenantId: string
  leadId: string
  leadName: string
  channelId: string
  remoteJid: string
  messageContent: string
  isNewLead: boolean
}): Promise<boolean> {
  const { tenantId, leadId, leadName, channelId, remoteJid, messageContent, isNewLead } = params

  try {
    // Buscar canal para instanceId
    const channel = await prisma.crmChannel.findUnique({
      where: { id: channelId },
      select: { instanceId: true },
    })
    if (!channel?.instanceId) return false

    // Buscar conversa
    const conversation = await prisma.conversation.findUnique({
      where: { tenantId_remoteJid: { tenantId, remoteJid } },
      select: { id: true },
    })
    if (!conversation) return false

    const ctx = {
      tenantId,
      leadId,
      leadName,
      conversationId: conversation.id,
      instanceId: channel.instanceId,
      remoteJid,
      flowId: '',
      incomingMessage: messageContent,
    }

    // 1. Verificar sessão ativa
    const activeSession = await prisma.crmBotSession.findFirst({
      where: { leadId, tenantId, status: 'active' },
      include: { flow: true },
    })

    if (activeSession) {
      // Timeout check: se última atividade > 30 min, encerrar sessão
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
      if (activeSession.lastActivityAt < thirtyMinAgo) {
        await endSession(activeSession.id, 'timeout')
        // Continua abaixo para verificar novos gatilhos
      } else {
        // Processar resposta no fluxo atual
        const nodes = activeSession.flow.nodes as unknown as FlowNode[]
        const edges = activeSession.flow.edges as unknown as FlowEdge[]
        const sessionData = (activeSession.data as unknown as SessionData) ?? { answers: {}, variables: {} }

        ctx.flowId = activeSession.flowId

        // Se estava esperando resposta de QUESTION
        if (sessionData.lastQuestionNodeId) {
          // Salvar resposta
          sessionData.answers[sessionData.lastQuestionNodeId] = messageContent
          delete sessionData.lastQuestionNodeId

          // Avançar para próximo nó após a question
          const outgoing = getOutgoingEdges(edges, activeSession.currentNodeId)
          if (outgoing.length > 0 && outgoing[0]) {
            await advanceToNode(
              outgoing[0].target, nodes, edges,
              { id: activeSession.id, data: sessionData },
              ctx,
            )
          } else {
            await endSession(activeSession.id, 'completed')
          }
          return true
        }

        // Se estava em delay, continuar para próximo nó
        const currentNode = findNodeById(nodes, activeSession.currentNodeId)
        if (currentNode?.type === 'delay') {
          const outgoing = getOutgoingEdges(edges, currentNode.id)
          if (outgoing.length > 0 && outgoing[0]) {
            await advanceToNode(
              outgoing[0].target, nodes, edges,
              { id: activeSession.id, data: sessionData },
              ctx,
            )
          }
          return true
        }

        // Outros casos — avançar do nó atual
        const outgoing = getOutgoingEdges(edges, activeSession.currentNodeId)
        if (outgoing.length > 0 && outgoing[0]) {
          await advanceToNode(
            outgoing[0].target, nodes, edges,
            { id: activeSession.id, data: sessionData },
            ctx,
          )
        }
        return true
      }
    }

    // 2. Buscar fluxos ativos com gatilho compatível
    const activeFlows = await prisma.crmBotFlow.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    for (const flow of activeFlows) {
      if (!matchesTrigger(flow, messageContent)) continue

      // Verificar se lead já tem sessão (ativa ou completada recentemente)
      // para gatilho "any_new_conversation", só ativar se é conversa nova
      if (flow.triggerType === 'any_new_conversation' && !isNewLead) continue

      const nodes = flow.nodes as unknown as FlowNode[]
      const edges = flow.edges as unknown as FlowEdge[]
      const triggerNode = findTriggerNode(nodes)
      if (!triggerNode) continue

      // Criar sessão
      const session = await prisma.crmBotSession.create({
        data: {
          tenantId,
          flowId: flow.id,
          leadId,
          currentNodeId: triggerNode.id,
          status: 'active',
          data: { answers: {}, variables: {} },
        },
      })

      ctx.flowId = flow.id

      // Iniciar execução a partir do trigger
      await advanceToNode(
        triggerNode.id, nodes, edges,
        { id: session.id, data: { answers: {}, variables: {} } },
        ctx,
      )
      return true
    }

    // 3. Nenhum bot tratou — fallback
    return false
  } catch (err) {
    console.error('[bot-engine] Erro:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Encerra todas as sessões ativas de um lead (ex: quando lead é movido manualmente).
 */
export async function cancelBotSessions(leadId: string, tenantId: string): Promise<void> {
  await prisma.crmBotSession.updateMany({
    where: { leadId, tenantId, status: 'active' },
    data: { status: 'transferred', completedAt: new Date() },
  }).catch(err => {
    console.error('[bot-engine] Erro ao cancelar sessões:', err instanceof Error ? err.message : err)
  })
}
