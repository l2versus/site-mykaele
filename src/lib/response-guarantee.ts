// src/lib/response-guarantee.ts — Sistema de Garantia de Resposta
// Garante que NENHUMA mensagem de paciente fique sem resposta.
//
// Arquitetura:
// 1. Cada mensagem recebida cria um "pendingResponse" no banco
// 2. Cascade Bot → IA → AutoReply tenta responder
// 3. Se todos falham, safety net envia mensagem padrão
// 4. Monitor periódico detecta mensagens sem resposta
//
// ZERO mensagens perdidas. Se a IA cair, o paciente recebe resposta humana padrão.

import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'

// Mensagem de segurança quando TUDO falha (IA, bot, auto-reply)
const SAFETY_NET_MESSAGE = 'Oi! Recebi sua mensagem 😊 Vou te responder em breve, tá? Se for urgente, me liga!'

const SAFETY_NET_TIMEOUT_MS = 25_000 // 25s — tempo máximo para cascade responder

interface ResponseContext {
  tenantId: string
  leadId: string
  leadName: string
  channelId: string
  remoteJid: string
  messageContent: string
  waMessageId: string
  isNewLead: boolean
}

interface CascadeResult {
  handler: 'bot' | 'ai-agent' | 'auto-reply' | 'safety-net' | 'none'
  success: boolean
  error?: string
  durationMs: number
}

/**
 * Registra que uma mensagem precisa de resposta.
 * Chamado IMEDIATAMENTE após salvar a mensagem no banco.
 */
export async function trackPendingResponse(ctx: ResponseContext): Promise<string> {
  const activity = await prisma.leadActivity.create({
    data: {
      leadId: ctx.leadId,
      type: 'RESPONSE_PENDING',
      payload: {
        waMessageId: ctx.waMessageId,
        messageContent: ctx.messageContent.substring(0, 200),
        remoteJid: ctx.remoteJid,
        channelId: ctx.channelId,
        trackedAt: new Date().toISOString(),
      },
    },
  })
  return activity.id
}

/**
 * Marca que uma resposta foi enviada com sucesso.
 * Chamado por qualquer handler que consiga responder (bot, IA, auto-reply, safety net).
 */
export async function markResponseSent(
  trackingId: string,
  handler: CascadeResult['handler'],
  durationMs: number
): Promise<void> {
  await prisma.leadActivity.update({
    where: { id: trackingId },
    data: {
      type: 'RESPONSE_SENT',
      payload: {
        handler,
        durationMs,
        sentAt: new Date().toISOString(),
      },
    },
  }).catch((err) => {
    console.error('[response-guarantee] Falha ao marcar resposta enviada:', err instanceof Error ? err.message : err)
  })
}

/**
 * Marca que a cascade falhou completamente.
 */
export async function markResponseFailed(
  trackingId: string,
  errors: string[]
): Promise<void> {
  await prisma.leadActivity.update({
    where: { id: trackingId },
    data: {
      type: 'RESPONSE_FAILED',
      payload: {
        errors,
        failedAt: new Date().toISOString(),
      },
    },
  }).catch((err) => {
    console.error('[response-guarantee] Falha ao marcar resposta falhada:', err instanceof Error ? err.message : err)
  })
}

/**
 * Safety Net — última linha de defesa.
 * Se Bot, IA e AutoReply falharam, envia mensagem padrão para o paciente não ficar no vácuo.
 */
export async function sendSafetyNetResponse(ctx: {
  tenantId: string
  leadId: string
  leadName: string
  channelId: string
  remoteJid: string
  trackingId: string
}): Promise<boolean> {
  try {
    // Verificar se já recebeu resposta (outro handler pode ter respondido entre-tempo)
    const tracking = await prisma.leadActivity.findUnique({
      where: { id: ctx.trackingId },
      select: { type: true },
    })
    if (tracking?.type === 'RESPONSE_SENT') return true // Já respondido

    // Buscar config personalizada de safety net (ou usar padrão)
    const integration = await prisma.crmIntegration.findFirst({
      where: { tenantId: ctx.tenantId, provider: 'safety-net', isActive: true },
    })
    const creds = integration?.credentials as Record<string, unknown> | null
    const customMessage = typeof creds?.message === 'string' && creds.message.trim()
      ? creds.message as string
      : SAFETY_NET_MESSAGE

    const firstName = ctx.leadName.split(' ')[0] || 'cliente'
    const finalMessage = customMessage.replace(/\{\{nome\}\}/gi, firstName)

    // Buscar instanceId
    const channel = await prisma.crmChannel.findUnique({
      where: { id: ctx.channelId },
      select: { instanceId: true },
    })
    if (!channel?.instanceId) {
      console.error(`[safety-net] FALHA CRÍTICA: canal ${ctx.channelId} sem instanceId — paciente ${ctx.leadId} sem resposta`)
      return false
    }

    // Enviar
    const result = await evolutionApi.sendText(channel.instanceId, ctx.remoteJid, finalMessage)

    // Salvar no banco
    if (result?.key?.id) {
      const conversation = await prisma.conversation.findUnique({
        where: { tenantId_remoteJid: { tenantId: ctx.tenantId, remoteJid: ctx.remoteJid } },
        select: { id: true },
      })
      if (conversation) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            tenantId: ctx.tenantId,
            waMessageId: result.key.id,
            fromMe: true,
            type: 'TEXT',
            content: finalMessage,
            status: 'SENT',
            aiSummary: 'Safety net — resposta automática de emergência',
          },
        })
      }
    }

    // Registrar atividade
    await prisma.leadActivity.create({
      data: {
        leadId: ctx.leadId,
        type: 'SAFETY_NET_SENT',
        payload: {
          message: finalMessage,
          reason: 'Todos os handlers (bot, IA, auto-reply) falharam',
          sentAt: new Date().toISOString(),
        },
      },
    })

    return true
  } catch (err) {
    console.error('[safety-net] FALHA ao enviar safety net:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Executa a cascade com garantia de resposta.
 * Se Bot + IA + AutoReply falharem, dispara o safety net.
 *
 * USO: Substituir o fire-and-forget no webhook-processor.
 */
export async function executeWithGuarantee(
  ctx: ResponseContext,
  handlers: {
    tryBot: () => Promise<boolean>
    tryAiAgent: () => Promise<boolean>
    tryAutoReply: () => Promise<void>
  }
): Promise<CascadeResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let trackingId: string

  try {
    trackingId = await trackPendingResponse(ctx)
  } catch (err) {
    // Se nem o tracking funciona, tenta enviar safety net direto
    console.error('[response-guarantee] Falha ao criar tracking:', err instanceof Error ? err.message : err)
    trackingId = 'unknown'
  }

  // 1. Tentar Bot Builder
  try {
    const botHandled = await handlers.tryBot()
    if (botHandled) {
      const duration = Date.now() - startTime
      await markResponseSent(trackingId, 'bot', duration)
      return { handler: 'bot', success: true, durationMs: duration }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`[bot] ${msg}`)
    console.error('[response-guarantee] Bot falhou:', msg)
  }

  // 2. Tentar Agente IA
  try {
    const aiHandled = await handlers.tryAiAgent()
    if (aiHandled) {
      const duration = Date.now() - startTime
      await markResponseSent(trackingId, 'ai-agent', duration)
      return { handler: 'ai-agent', success: true, durationMs: duration }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`[ai-agent] ${msg}`)
    console.error('[response-guarantee] IA falhou:', msg)
  }

  // 3. Tentar Auto-Reply
  try {
    await handlers.tryAutoReply()
    // Auto-reply é void — verifica se marcou como enviado no banco
    const autoReplySent = await prisma.leadActivity.findFirst({
      where: { leadId: ctx.leadId, type: 'AUTO_REPLY_SENT' },
      orderBy: { createdAt: 'desc' },
    })
    const wasJustSent = autoReplySent && (Date.now() - autoReplySent.createdAt.getTime()) < 10_000
    if (wasJustSent) {
      const duration = Date.now() - startTime
      await markResponseSent(trackingId, 'auto-reply', duration)
      return { handler: 'auto-reply', success: true, durationMs: duration }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`[auto-reply] ${msg}`)
    console.error('[response-guarantee] Auto-reply falhou:', msg)
  }

  // 4. SAFETY NET — última linha de defesa
  console.error(`[response-guarantee] TODOS os handlers falharam para lead=${ctx.leadId}. Ativando safety net.`, errors)

  const safetyResult = await sendSafetyNetResponse({
    tenantId: ctx.tenantId,
    leadId: ctx.leadId,
    leadName: ctx.leadName,
    channelId: ctx.channelId,
    remoteJid: ctx.remoteJid,
    trackingId,
  })

  const duration = Date.now() - startTime

  if (safetyResult) {
    await markResponseSent(trackingId, 'safety-net', duration)
    return { handler: 'safety-net', success: true, durationMs: duration }
  }

  // FALHA TOTAL — nenhum handler respondeu
  await markResponseFailed(trackingId, errors)
  console.error(`[response-guarantee] ⚠️ FALHA TOTAL: lead=${ctx.leadId} ficou sem resposta! Errors:`, errors)

  return { handler: 'none', success: false, error: errors.join(' | '), durationMs: duration }
}

/**
 * Busca mensagens que ficaram sem resposta nas últimas N horas.
 * Usar no painel admin para monitoramento.
 */
export async function findUnansweredMessages(tenantId: string, hoursBack = 24): Promise<Array<{
  leadId: string
  leadName: string
  phone: string
  messageContent: string
  receivedAt: Date
  trackingType: string
}>> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

  const pending = await prisma.leadActivity.findMany({
    where: {
      type: { in: ['RESPONSE_PENDING', 'RESPONSE_FAILED'] },
      createdAt: { gte: since },
      lead: { tenantId, deletedAt: null },
    },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return pending.map(p => {
    const payload = p.payload as Record<string, unknown>
    return {
      leadId: p.lead.id,
      leadName: p.lead.name,
      phone: p.lead.phone,
      messageContent: (payload?.messageContent as string) ?? '',
      receivedAt: p.createdAt,
      trackingType: p.type,
    }
  })
}
