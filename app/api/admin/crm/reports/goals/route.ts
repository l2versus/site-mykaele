// app/api/admin/crm/reports/goals/route.ts — Relatório de Metas
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const GOAL_TYPES = [
  { key: 'leads_generated', label: 'Leads Gerados', unit: '' },
  { key: 'leads_won', label: 'Leads Ganhos', unit: '' },
  { key: 'revenue', label: 'Receita (R$)', unit: 'currency' },
  { key: 'nps_score', label: 'NPS Score', unit: '' },
  { key: 'response_time', label: 'Tempo de Resposta (min)', unit: 'minutes' },
]

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

    const now = new Date()
    const month = parseInt(req.nextUrl.searchParams.get('month') ?? String(now.getMonth() + 1))
    const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(now.getFullYear()))

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)
    const today = new Date()
    const daysInMonth = new Date(year, month, 0).getDate()
    const dayOfMonth = Math.min(today.getDate(), daysInMonth)
    const daysElapsed = today >= monthEnd ? daysInMonth : dayOfMonth

    // Buscar metas e dados atuais em paralelo
    const [goals, leadsCreated, leadsWon, npsData, responseTimeData, dailyLeads] = await Promise.all([
      // Metas configuradas para este mês
      prisma.crmGoal.findMany({
        where: { tenantId, month, year },
      }),

      // Leads gerados no mês
      prisma.lead.count({
        where: { tenantId, deletedAt: null, createdAt: { gte: monthStart, lte: monthEnd } },
      }),

      // Leads ganhos no mês (receita = leadsWon._sum.expectedValue)
      prisma.lead.aggregate({
        where: { tenantId, status: 'WON', deletedAt: null, closedAt: { gte: monthStart, lte: monthEnd } },
        _count: true,
        _sum: { expectedValue: true },
      }),

      // NPS score médio
      prisma.crmNpsResponse.aggregate({
        where: {
          tenantId,
          respondedAt: { gte: monthStart, lte: monthEnd },
          score: { gte: 0 },
        },
        _avg: { score: true },
      }),

      // Tempo médio de resposta
      prisma.$queryRaw<Array<{ avg_minutes: number | null }>>`
        WITH response_pairs AS (
          SELECT
            m1."createdAt" as received_at,
            MIN(m2."createdAt") as responded_at
          FROM "Message" m1
          LEFT JOIN "Message" m2
            ON m2."conversationId" = m1."conversationId"
            AND m2."fromMe" = true
            AND m2."createdAt" > m1."createdAt"
          WHERE m1."tenantId" = ${tenantId}
            AND m1."fromMe" = false
            AND m1."createdAt" >= ${monthStart}
            AND m1."createdAt" <= ${monthEnd}
          GROUP BY m1.id, m1."createdAt"
        )
        SELECT AVG(EXTRACT(EPOCH FROM (responded_at - received_at)) / 60) as avg_minutes
        FROM response_pairs
        WHERE responded_at IS NOT NULL
      `,

      // Leads criados por dia (para gráfico de evolução)
      prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT
          TO_CHAR(d.day, 'YYYY-MM-DD') as day,
          COALESCE(c.cnt, 0) as count
        FROM generate_series(${monthStart}::date, ${monthEnd}::date, '1 day'::interval) d(day)
        LEFT JOIN (
          SELECT DATE("createdAt") as dt, COUNT(*) as cnt
          FROM "Lead"
          WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL
            AND "createdAt" >= ${monthStart} AND "createdAt" <= ${monthEnd}
          GROUP BY dt
        ) c ON c.dt = d.day::date
        ORDER BY d.day ASC
      `,
    ])

    const wonCount = leadsWon._count ?? 0
    const revenueValue = leadsWon._sum?.expectedValue ?? 0
    const avgNps = npsData._avg?.score ?? null
    const avgResponse = responseTimeData[0]?.avg_minutes ?? null

    // Valores atuais por tipo
    const currentValues: Record<string, number> = {
      leads_generated: leadsCreated,
      leads_won: wonCount,
      revenue: revenueValue,
      nps_score: avgNps ?? 0,
      response_time: avgResponse ?? 0,
    }

    // Mapear metas com progresso
    const goalsMap = new Map(goals.map(g => [g.type, g]))

    const goalResults = GOAL_TYPES.map(gt => {
      const goal = goalsMap.get(gt.key)
      const target = goal?.targetValue ?? 0
      const current = currentValues[gt.key] ?? 0
      const progress = target > 0 ? (current / target) * 100 : 0

      // Projeção: baseado no ritmo atual, qual será o valor no final do mês?
      let projected: number | null = null
      if (daysElapsed > 0 && target > 0) {
        // Para response_time, menor é melhor — não projetar
        if (gt.key === 'response_time' || gt.key === 'nps_score') {
          projected = current
        } else {
          projected = (current / daysElapsed) * daysInMonth
        }
      }

      const willHitTarget = projected !== null && target > 0
        ? (gt.key === 'response_time' ? projected <= target : projected >= target)
        : null

      return {
        id: goal?.id ?? null,
        type: gt.key,
        label: gt.label,
        unit: gt.unit,
        targetValue: target,
        currentValue: Math.round(current * 100) / 100,
        progress: Math.min(Math.round(progress * 10) / 10, 100),
        projected: projected !== null ? Math.round(projected * 100) / 100 : null,
        willHitTarget,
        isConfigured: !!goal,
      }
    })

    // Evolução cumulativa de leads gerados
    let cumulative = 0
    const dailyProgress = dailyLeads.map(d => {
      cumulative += Number(d.count)
      return { day: d.day, count: Number(d.count), cumulative }
    })

    return NextResponse.json({
      month,
      year,
      daysInMonth,
      daysElapsed,
      goals: goalResults,
      dailyProgress,
      goalTypes: GOAL_TYPES,
    })
  } catch (err) {
    console.error('[CRM Goals Report API]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — criar/atualizar meta
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { tenantId, type, targetValue, month, year } = body

    if (!tenantId || !type || targetValue === undefined || !month || !year) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenantId, type, targetValue, month, year' }, { status: 400 })
    }

    let resolvedTenantId = tenantId
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) resolvedTenantId = tenantBySlug.id
    }

    const goal = await prisma.crmGoal.upsert({
      where: {
        tenantId_type_month_year: {
          tenantId: resolvedTenantId,
          type: String(type),
          month: Number(month),
          year: Number(year),
        },
      },
      create: {
        tenantId: resolvedTenantId,
        type: String(type),
        targetValue: Number(targetValue),
        month: Number(month),
        year: Number(year),
      },
      update: {
        targetValue: Number(targetValue),
      },
    })

    return NextResponse.json(goal, { status: 201 })
  } catch (err) {
    console.error('[CRM Goals POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
