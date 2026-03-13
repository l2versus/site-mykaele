// app/api/admin/crm/reports/wins-losses/route.ts — Relatório de Ganhos e Perdas
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseDateRange(req: NextRequest): { dateFrom: Date; dateTo: Date } {
  const period = req.nextUrl.searchParams.get('period') ?? '30d'
  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (period === 'custom') {
    const s = req.nextUrl.searchParams.get('start')
    const e = req.nextUrl.searchParams.get('end')
    if (s && e) return { dateFrom: new Date(s + 'T00:00:00'), dateTo: new Date(e + 'T23:59:59.999') }
  }

  let dateFrom: Date
  switch (period) {
    case 'today': dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      dateFrom = new Date(y.getFullYear(), y.getMonth(), y.getDate())
      return { dateFrom, dateTo: new Date(dateFrom.getTime() + 86400000 - 1) }
    }
    case '7d': dateFrom = new Date(now.getTime() - 7 * 86400000); break
    case '90d': dateFrom = new Date(now.getTime() - 90 * 86400000); break
    default: dateFrom = new Date(now.getTime() - 30 * 86400000)
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

    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    const { dateFrom, dateTo } = parseDateRange(req)

    const [
      wonData, lostData, totalCreated,
      timeline, funnelData, lossReasons,
      wonLeads, lostLeads,
    ] = await Promise.all([
      // Ganhos
      prisma.lead.aggregate({
        where: { tenantId, status: 'WON', deletedAt: null, closedAt: { gte: dateFrom, lte: dateTo } },
        _count: true,
        _sum: { expectedValue: true },
        _avg: { expectedValue: true },
      }),
      // Perdidos
      prisma.lead.aggregate({
        where: { tenantId, status: 'LOST', deletedAt: null, closedAt: { gte: dateFrom, lte: dateTo } },
        _count: true,
        _sum: { expectedValue: true },
        _avg: { expectedValue: true },
      }),
      // Total criados no período
      prisma.lead.count({
        where: { tenantId, deletedAt: null, createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      // Timeline: ganhos vs perdas por dia
      prisma.$queryRaw<Array<{ day: string; won: bigint; lost: bigint }>>`
        SELECT
          TO_CHAR(d.day, 'YYYY-MM-DD') as day,
          COALESCE(w.won, 0) as won,
          COALESCE(l.lost, 0) as lost
        FROM generate_series(${dateFrom}::date, ${dateTo}::date, '1 day'::interval) d(day)
        LEFT JOIN (
          SELECT DATE("closedAt") as dt, COUNT(*) as won
          FROM "Lead"
          WHERE "tenantId" = ${tenantId} AND "status" = 'WON' AND "deletedAt" IS NULL
            AND "closedAt" >= ${dateFrom} AND "closedAt" <= ${dateTo}
          GROUP BY dt
        ) w ON w.dt = d.day::date
        LEFT JOIN (
          SELECT DATE("closedAt") as dt, COUNT(*) as lost
          FROM "Lead"
          WHERE "tenantId" = ${tenantId} AND "status" = 'LOST' AND "deletedAt" IS NULL
            AND "closedAt" >= ${dateFrom} AND "closedAt" <= ${dateTo}
          GROUP BY dt
        ) l ON l.dt = d.day::date
        ORDER BY d.day ASC
      `,
      // Funil: leads por estágio (snapshot)
      prisma.stage.findMany({
        where: { tenantId },
        select: {
          id: true, name: true, color: true, type: true, order: true,
          cachedLeadCount: true, cachedTotalValue: true,
        },
        orderBy: { order: 'asc' },
      }),
      // Motivos de perda
      prisma.lead.groupBy({
        by: ['lostReason'],
        where: {
          tenantId, status: 'LOST', deletedAt: null,
          closedAt: { gte: dateFrom, lte: dateTo },
        },
        _count: true,
      }),
      // Lista dos últimos ganhos
      prisma.lead.findMany({
        where: { tenantId, status: 'WON', deletedAt: null, closedAt: { gte: dateFrom, lte: dateTo } },
        select: {
          id: true, name: true, expectedValue: true, createdAt: true, closedAt: true,
          source: true, stage: { select: { name: true } },
        },
        orderBy: { closedAt: 'desc' },
        take: 20,
      }),
      // Lista dos últimos perdidos
      prisma.lead.findMany({
        where: { tenantId, status: 'LOST', deletedAt: null, closedAt: { gte: dateFrom, lte: dateTo } },
        select: {
          id: true, name: true, expectedValue: true, createdAt: true, closedAt: true,
          source: true, lostReason: true, stage: { select: { name: true } },
        },
        orderBy: { closedAt: 'desc' },
        take: 20,
      }),
    ])

    const wonCount = wonData._count ?? 0
    const wonValue = wonData._sum?.expectedValue ?? 0
    const wonAvg = wonData._avg?.expectedValue ?? 0
    const lostCount = lostData._count ?? 0
    const lostValue = lostData._sum?.expectedValue ?? 0
    const lostAvg = lostData._avg?.expectedValue ?? 0
    const closedTotal = wonCount + lostCount
    const winRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0

    // Tempo no pipeline para ganhos
    const wonWithTime = wonLeads.filter(l => l.closedAt).map(l => ({
      ...l,
      daysInPipeline: l.closedAt
        ? Math.round((l.closedAt.getTime() - l.createdAt.getTime()) / 86400000)
        : null,
    }))

    const lostWithTime = lostLeads.map(l => ({
      ...l,
      daysInPipeline: l.closedAt
        ? Math.round((l.closedAt.getTime() - l.createdAt.getTime()) / 86400000)
        : null,
    }))

    return NextResponse.json({
      metrics: {
        wonCount, wonValue, wonAvg: Math.round(wonAvg),
        lostCount, lostValue, lostAvg: Math.round(lostAvg),
        winRate: Math.round(winRate * 10) / 10,
        totalCreated,
      },
      charts: {
        timeline: timeline.map(d => ({ day: d.day, won: Number(d.won), lost: Number(d.lost) })),
        funnel: funnelData.map(s => ({
          name: s.name, color: s.color, type: s.type, order: s.order,
          count: s.cachedLeadCount, value: s.cachedTotalValue,
        })),
        lossReasons: lossReasons
          .map(r => ({ reason: r.lostReason ?? 'Não informado', count: r._count }))
          .sort((a, b) => b.count - a.count),
      },
      wonLeads: wonWithTime,
      lostLeads: lostWithTime,
    })
  } catch (err) {
    console.error('[CRM Wins-Losses API]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
