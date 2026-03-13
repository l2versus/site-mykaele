// app/api/admin/crm/reports/activities/route.ts — Relatório de Atividades
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
    if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    let tenantId = req.nextUrl.searchParams.get('tenantId')
    if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    const { dateFrom, dateTo } = parseDateRange(req)
    const filterType = req.nextUrl.searchParams.get('type') ?? ''
    const filterUser = req.nextUrl.searchParams.get('userId') ?? ''
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
    const limit = 50

    // Build where clause
    const where: Record<string, unknown> = {
      tenantId,
      createdAt: { gte: dateFrom, lte: dateTo },
    }
    if (filterType) where.type = filterType
    if (filterUser) where.userId = filterUser

    const [
      activities,
      totalCount,
      byType,
      byDay,
      teamMembers,
    ] = await Promise.all([
      // Lista paginada de atividades
      prisma.crmActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),

      // Total para paginação
      prisma.crmActivityLog.count({ where }),

      // Contagem por tipo
      prisma.crmActivityLog.groupBy({
        by: ['type'],
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
        _count: true,
        orderBy: { _count: { type: 'desc' } },
      }),

      // Volume por dia
      prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT
          TO_CHAR(d.day, 'YYYY-MM-DD') as day,
          COALESCE(a.count, 0) as count
        FROM generate_series(${dateFrom}::date, ${dateTo}::date, '1 day'::interval) d(day)
        LEFT JOIN (
          SELECT DATE("createdAt") as dt, COUNT(*) as count
          FROM "CrmActivityLog"
          WHERE "tenantId" = ${tenantId}
            AND "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
          GROUP BY dt
        ) a ON a.dt = d.day::date
        ORDER BY d.day ASC
      `,

      // Team members para filtro
      prisma.crmTeamMember.findMany({
        where: { tenantId, isActive: true },
        select: { userId: true, name: true },
      }),
    ])

    // Se não tem CrmActivityLog mas tem LeadActivity, usa fallback
    const hasActivities = totalCount > 0

    // Fallback: se não tem CrmActivityLog, usar LeadActivity
    let fallbackActivities: typeof activities = []
    let fallbackByType: typeof byType = []
    let fallbackByDay: typeof byDay = []
    let fallbackTotal = 0

    if (!hasActivities) {
      const leadActivityWhere: Record<string, unknown> = {
        createdAt: { gte: dateFrom, lte: dateTo },
        lead: { tenantId, deletedAt: null },
      }
      if (filterType) leadActivityWhere.type = filterType

      const [la, laCount, laByType, laByDay] = await Promise.all([
        prisma.leadActivity.findMany({
          where: leadActivityWhere,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
          include: { lead: { select: { name: true } } },
        }),
        prisma.leadActivity.count({ where: leadActivityWhere }),
        prisma.leadActivity.groupBy({
          by: ['type'],
          where: { createdAt: { gte: dateFrom, lte: dateTo }, lead: { tenantId, deletedAt: null } },
          _count: true,
          orderBy: { _count: { type: 'desc' } },
        }),
        prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
          SELECT
            TO_CHAR(d.day, 'YYYY-MM-DD') as day,
            COALESCE(a.count, 0) as count
          FROM generate_series(${dateFrom}::date, ${dateTo}::date, '1 day'::interval) d(day)
          LEFT JOIN (
            SELECT DATE(la."createdAt") as dt, COUNT(*) as count
            FROM "LeadActivity" la
            JOIN "Lead" l ON l.id = la."leadId"
            WHERE l."tenantId" = ${tenantId} AND l."deletedAt" IS NULL
              AND la."createdAt" >= ${dateFrom} AND la."createdAt" <= ${dateTo}
            GROUP BY dt
          ) a ON a.dt = d.day::date
          ORDER BY d.day ASC
        `,
      ])

      fallbackActivities = la.map(a => ({
        id: a.id,
        tenantId,
        type: a.type,
        description: `${a.type} — ${a.lead.name}`,
        leadId: a.leadId,
        userId: a.createdBy,
        metadata: a.payload,
        createdAt: a.createdAt,
      }))
      fallbackTotal = laCount
      fallbackByType = laByType
      fallbackByDay = laByDay
    }

    const finalActivities = hasActivities ? activities : fallbackActivities
    const finalTotal = hasActivities ? totalCount : fallbackTotal
    const finalByType = hasActivities ? byType : fallbackByType
    const finalByDay = hasActivities ? byDay : fallbackByDay

    return NextResponse.json({
      activities: finalActivities,
      pagination: {
        total: finalTotal,
        page,
        limit,
        totalPages: Math.ceil(finalTotal / limit),
      },
      charts: {
        byType: finalByType.map(t => ({
          type: t.type,
          count: t._count,
        })),
        byDay: finalByDay.map(d => ({
          day: d.day,
          count: Number(d.count),
        })),
      },
      teamMembers: teamMembers.map(m => ({
        userId: m.userId,
        displayName: m.name,
      })),
    })
  } catch (err) {
    console.error('[CRM Activities Report API]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
