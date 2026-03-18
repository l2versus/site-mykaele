// app/api/admin/crm/monitoring/route.ts — Monitoramento de respostas
// Mostra leads que ficaram sem resposta e saúde do sistema de auto-reply.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findUnansweredMessages } from '@/lib/response-guarantee'

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'

export async function GET() {
  try {
    const tenantId = DEFAULT_TENANT_ID

    // 1. Mensagens sem resposta (últimas 24h)
    const unanswered = await findUnansweredMessages(tenantId, 24)

    // 2. Estatísticas de resposta (últimas 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      totalReceived,
      respondedByBot,
      respondedByAi,
      respondedByAutoReply,
      respondedBySafetyNet,
      totalFailed,
    ] = await Promise.all([
      // Total de mensagens recebidas (não fromMe)
      prisma.message.count({
        where: { tenantId, fromMe: false, createdAt: { gte: since } },
      }),
      // Respondidas pelo bot
      prisma.leadActivity.count({
        where: {
          lead: { tenantId },
          type: 'RESPONSE_SENT',
          createdAt: { gte: since },
          payload: { path: ['handler'], equals: 'bot' },
        },
      }),
      // Respondidas pela IA
      prisma.leadActivity.count({
        where: {
          lead: { tenantId },
          type: 'RESPONSE_SENT',
          createdAt: { gte: since },
          payload: { path: ['handler'], equals: 'ai-agent' },
        },
      }),
      // Respondidas pelo auto-reply
      prisma.leadActivity.count({
        where: {
          lead: { tenantId },
          type: 'RESPONSE_SENT',
          createdAt: { gte: since },
          payload: { path: ['handler'], equals: 'auto-reply' },
        },
      }),
      // Safety net ativado (emergência)
      prisma.leadActivity.count({
        where: {
          lead: { tenantId },
          type: { in: ['SAFETY_NET_SENT', 'RESPONSE_SENT'] },
          createdAt: { gte: since },
          payload: { path: ['handler'], equals: 'safety-net' },
        },
      }),
      // Falhas totais (sem resposta)
      prisma.leadActivity.count({
        where: {
          lead: { tenantId },
          type: 'RESPONSE_FAILED',
          createdAt: { gte: since },
        },
      }),
    ])

    const totalResponded = respondedByBot + respondedByAi + respondedByAutoReply + respondedBySafetyNet
    const responseRate = totalReceived > 0 ? Math.round((totalResponded / totalReceived) * 100) : 100

    // 3. Última atividade do webhook
    const lastWebhookMessage = await prisma.message.findFirst({
      where: { tenantId, fromMe: false },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    const lastWebhookAgo = lastWebhookMessage
      ? Math.round((Date.now() - lastWebhookMessage.createdAt.getTime()) / 60_000)
      : null

    // 4. Saúde do sistema
    const health = {
      status: totalFailed === 0 && responseRate >= 90 ? 'healthy' : responseRate >= 70 ? 'degraded' : 'critical',
      webhookActive: lastWebhookAgo !== null && lastWebhookAgo < 60,
      lastMessageMinutesAgo: lastWebhookAgo,
    }

    return NextResponse.json({
      health,
      stats: {
        period: '24h',
        totalReceived,
        totalResponded,
        responseRate: `${responseRate}%`,
        breakdown: {
          bot: respondedByBot,
          aiAgent: respondedByAi,
          autoReply: respondedByAutoReply,
          safetyNet: respondedBySafetyNet,
          failed: totalFailed,
        },
      },
      unanswered: unanswered.map(u => ({
        leadId: u.leadId,
        leadName: u.leadName,
        phone: u.phone,
        message: u.messageContent,
        receivedAt: u.receivedAt,
        status: u.trackingType,
      })),
    })
  } catch (err) {
    console.error('[monitoring] Erro:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao buscar monitoramento' }, { status: 500 })
  }
}
