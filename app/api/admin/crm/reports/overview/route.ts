// app/api/admin/crm/reports/overview/route.ts — Métricas gerais de relatórios
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseDateRange(req: NextRequest): { dateFrom: Date; dateTo: Date } {
  const period = req.nextUrl.searchParams.get('period') ?? '30d'
  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (period === 'custom') {
    const startStr = req.nextUrl.searchParams.get('start')
    const endStr = req.nextUrl.searchParams.get('end')
    if (startStr && endStr) {
      return {
        dateFrom: new Date(startStr + 'T00:00:00'),
        dateTo: new Date(endStr + 'T23:59:59.999'),
      }
    }
  }

  let dateFrom: Date
  switch (period) {
    case 'today':
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      dateFrom = new Date(y.getFullYear(), y.getMonth(), y.getDate())
      return { dateFrom, dateTo: new Date(dateFrom.getTime() + 86400000 - 1) }
    }
    case '7d':
      dateFrom = new Date(now.getTime() - 7 * 86400000)
      break
    case '90d':
      dateFrom = new Date(now.getTime() - 90 * 86400000)
      break
    default: // 30d
      dateFrom = new Date(now.getTime() - 30 * 86400000)
  }

  return { dateFrom, dateTo: todayEnd }
}

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

    const { dateFrom, dateTo } = parseDateRange(req)

    const [
      totalLeads,
      wonData,
      lostData,
      closedLeadsForAvg,
      leadsTimeline,
      leadsByStage,
      leadsBySource,
    ] = await Promise.all([
      // Total de leads criados no período
      prisma.lead.count({
        where: { tenantId, deletedAt: null, createdAt: { gte: dateFrom, lte: dateTo } },
      }),

      // Leads ganhos no período
      prisma.lead.aggregate({
        where: {
          tenantId,
          status: 'WON',
          deletedAt: null,
          closedAt: { gte: dateFrom, lte: dateTo },
        },
        _count: true,
        _sum: { expectedValue: true },
      }),

      // Leads perdidos no período
      prisma.lead.aggregate({
        where: {
          tenantId,
          status: 'LOST',
          deletedAt: null,
          closedAt: { gte: dateFrom, lte: dateTo },
        },
        _count: true,
        _sum: { expectedValue: true },
      }),

      // Tempo médio de fechamento (dias) para leads ganhos
      prisma.$queryRaw<Array<{ avg_days: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM ("closedAt" - "createdAt")) / 86400) as avg_days
        FROM "Lead"
        WHERE "tenantId" = ${tenantId}
          AND "status" = 'WON'
          AND "deletedAt" IS NULL
          AND "closedAt" IS NOT NULL
          AND "closedAt" >= ${dateFrom}
          AND "closedAt" <= ${dateTo}
      `,

      // Leads criados vs ganhos ao longo do tempo (por dia)
      prisma.$queryRaw<Array<{ day: string; created: bigint; won: bigint }>>`
        SELECT
          TO_CHAR(d.day, 'YYYY-MM-DD') as day,
          COALESCE(c.created, 0) as created,
          COALESCE(w.won, 0) as won
        FROM generate_series(${dateFrom}::date, ${dateTo}::date, '1 day'::interval) d(day)
        LEFT JOIN (
          SELECT DATE("createdAt") as dt, COUNT(*) as created
          FROM "Lead"
          WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL
            AND "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
          GROUP BY dt
        ) c ON c.dt = d.day::date
        LEFT JOIN (
          SELECT DATE("closedAt") as dt, COUNT(*) as won
          FROM "Lead"
          WHERE "tenantId" = ${tenantId} AND "status" = 'WON' AND "deletedAt" IS NULL
            AND "closedAt" >= ${dateFrom} AND "closedAt" <= ${dateTo}
          GROUP BY dt
        ) w ON w.dt = d.day::date
        ORDER BY d.day ASC
      `,

      // Leads por estágio do pipeline (snapshot atual)
      prisma.stage.findMany({
        where: {
          tenantId,
          pipeline: { tenantId },
        },
        select: {
          id: true,
          name: true,
          color: true,
          type: true,
          order: true,
          cachedLeadCount: true,
          cachedTotalValue: true,
          pipeline: { select: { name: true } },
        },
        orderBy: { order: 'asc' },
      }),

      // Leads por fonte
      prisma.lead.groupBy({
        by: ['source'],
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _count: true,
        _sum: { expectedValue: true },
      }),
    ])

    const wonCount = wonData._count ?? 0
    const wonValue = wonData._sum?.expectedValue ?? 0
    const lostCount = lostData._count ?? 0
    const lostValue = lostData._sum?.expectedValue ?? 0
    const closedTotal = wonCount + lostCount
    const conversionRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0
    const avgTicket = wonCount > 0 ? wonValue / wonCount : 0
    const avgCloseDays = closedLeadsForAvg[0]?.avg_days ?? null

    // Formatar timeline
    const timeline = leadsTimeline.map(d => ({
      day: d.day,
      created: Number(d.created),
      won: Number(d.won),
    }))

    // Formatar estágios
    const stages = leadsByStage.map(s => ({
      id: s.id,
      name: s.name,
      color: s.color,
      type: s.type,
      order: s.order,
      leadCount: s.cachedLeadCount,
      totalValue: s.cachedTotalValue,
      pipeline: s.pipeline.name,
    }))

    // Formatar fontes
    const sources = leadsBySource
      .map(s => ({
        name: s.source ?? 'Não informado',
        count: s._count,
        value: s._sum?.expectedValue ?? 0,
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      metrics: {
        totalLeads,
        wonCount,
        wonValue,
        lostCount,
        lostValue,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgTicket: Math.round(avgTicket * 100) / 100,
        avgCloseDays: avgCloseDays !== null ? Math.round(avgCloseDays * 10) / 10 : null,
      },
      charts: {
        timeline,
        stages,
        sources,
      },
    })
  } catch (err) {
    console.error('[CRM Reports Overview API]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
