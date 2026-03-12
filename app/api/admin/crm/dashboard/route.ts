// app/api/admin/crm/dashboard/route.ts — Métricas do dashboard CRM
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    let tenantId = req.nextUrl.searchParams.get('tenantId')
    if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

    // Resolver slug → cuid
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    // Filtro de período
    const period = req.nextUrl.searchParams.get('period') ?? '7d'
    const now = new Date()
    let dateFrom: Date

    switch (period) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'yesterday': {
        const y = new Date(now)
        y.setDate(y.getDate() - 1)
        dateFrom = new Date(y.getFullYear(), y.getMonth(), y.getDate())
        break
      }
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 86400000)
        break
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 86400000)
        break
      case '90d':
        dateFrom = new Date(now.getTime() - 90 * 86400000)
        break
      default:
        dateFrom = new Date(now.getTime() - 7 * 86400000)
    }

    // Executar todas as queries em paralelo para performance
    const [
      messagesReceived,
      messagesSent,
      openConversations,
      unansweredChats,
      sourceDistribution,
      wonLeadsData,
      activeLeadsData,
      pendingTasks,
      overdueTasks,
      leadsByStatus,
      recentLeads,
      messagesByDay,
    ] = await Promise.all([
      // Mensagens recebidas no período (fromMe = false)
      prisma.message.count({
        where: { tenantId, fromMe: false, createdAt: { gte: dateFrom } },
      }),

      // Mensagens enviadas no período
      prisma.message.count({
        where: { tenantId, fromMe: true, createdAt: { gte: dateFrom } },
      }),

      // Conversas abertas (não fechadas)
      prisma.conversation.count({
        where: { tenantId, isClosed: false },
      }),

      // Chats sem resposta: conversas com última mensagem recebida (não de nós)
      // e sem resposta posterior
      prisma.conversation.count({
        where: {
          tenantId,
          isClosed: false,
          unreadCount: { gt: 0 },
        },
      }),

      // Fontes de lead
      prisma.lead.groupBy({
        by: ['source'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),

      // Leads ganhos no período + valor total
      prisma.lead.aggregate({
        where: {
          tenantId,
          status: 'WON',
          deletedAt: null,
          closedAt: { gte: dateFrom },
        },
        _count: true,
        _sum: { expectedValue: true },
      }),

      // Leads ativos (não WON, não LOST, não deletados) + valor total
      prisma.lead.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { notIn: ['WON', 'LOST'] },
        },
        _count: true,
        _sum: { expectedValue: true },
      }),

      // Tarefas pendentes
      prisma.crmTask.count({
        where: {
          tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }),

      // Tarefas atrasadas
      prisma.crmTask.count({
        where: {
          tenantId,
          status: 'PENDING',
          dueAt: { lt: now },
        },
      }),

      // Leads por status (para gráfico)
      prisma.lead.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),

      // Leads recentes (últimos 5)
      prisma.lead.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          source: true,
          expectedValue: true,
          createdAt: true,
          stage: { select: { name: true, color: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Mensagens por dia (últimos 7 dias para gráfico)
      prisma.$queryRaw<Array<{ day: string; received: bigint; sent: bigint }>>`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM-DD') as day,
          COUNT(*) FILTER (WHERE "fromMe" = false) as received,
          COUNT(*) FILTER (WHERE "fromMe" = true) as sent
        FROM "Message"
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= ${dateFrom}
        GROUP BY day
        ORDER BY day ASC
      `,
    ])

    // Calcular tempo médio de resposta
    // Busca conversas com pelo menos uma mensagem recebida e uma enviada
    const responseTimeData = await prisma.$queryRaw<Array<{ avg_minutes: number | null }>>`
      WITH response_pairs AS (
        SELECT
          m1."conversationId",
          m1."createdAt" as received_at,
          MIN(m2."createdAt") as responded_at
        FROM "Message" m1
        LEFT JOIN "Message" m2
          ON m2."conversationId" = m1."conversationId"
          AND m2."fromMe" = true
          AND m2."createdAt" > m1."createdAt"
        WHERE m1."tenantId" = ${tenantId}
          AND m1."fromMe" = false
          AND m1."createdAt" >= ${dateFrom}
        GROUP BY m1.id, m1."conversationId", m1."createdAt"
      )
      SELECT AVG(EXTRACT(EPOCH FROM (responded_at - received_at)) / 60) as avg_minutes
      FROM response_pairs
      WHERE responded_at IS NOT NULL
    `

    const avgResponseMinutes = responseTimeData[0]?.avg_minutes ?? null

    // Formatar fontes de lead
    const sources = sourceDistribution.map(s => ({
      name: s.source ?? 'Não informado',
      count: s._count,
    })).sort((a, b) => b.count - a.count)

    // Formatar leads por status
    const statusDistribution = leadsByStatus.map(s => ({
      status: s.status,
      count: s._count,
    }))

    // Formatar mensagens por dia (converter BigInt para number)
    const messagesTimeline = messagesByDay.map(d => ({
      day: d.day,
      received: Number(d.received),
      sent: Number(d.sent),
    }))

    return NextResponse.json({
      period,
      metrics: {
        messagesReceived,
        messagesSent,
        openConversations,
        unansweredChats,
        avgResponseMinutes,
        wonLeads: wonLeadsData._count ?? 0,
        wonValue: wonLeadsData._sum?.expectedValue ?? 0,
        activeLeads: activeLeadsData._count ?? 0,
        activeValue: activeLeadsData._sum?.expectedValue ?? 0,
        pendingTasks,
        overdueTasks,
      },
      charts: {
        sources,
        statusDistribution,
        messagesTimeline,
      },
      recentLeads,
    })
  } catch (err) {
    console.error('[CRM Dashboard API]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
