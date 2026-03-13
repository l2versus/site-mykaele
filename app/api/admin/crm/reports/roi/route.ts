// app/api/admin/crm/reports/roi/route.ts — Relatório de ROI
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
    default:
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

    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    const { dateFrom, dateTo } = parseDateRange(req)

    // Extrair meses cobertos pelo período
    const startMonth = dateFrom.getMonth() + 1
    const startYear = dateFrom.getFullYear()
    const endMonth = dateTo.getMonth() + 1
    const endYear = dateTo.getFullYear()

    const [totalLeads, wonData, spendData, monthlyRevenue] = await Promise.all([
      // Total de leads no período
      prisma.lead.count({
        where: { tenantId, deletedAt: null, createdAt: { gte: dateFrom, lte: dateTo } },
      }),

      // Leads ganhos + receita
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

      // Investimentos em marketing no período
      prisma.crmMarketingSpend.findMany({
        where: {
          tenantId,
          OR: buildMonthRange(startMonth, startYear, endMonth, endYear),
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),

      // Receita por mês (leads ganhos agrupados por mês)
      prisma.$queryRaw<Array<{ month: number; year: number; revenue: number; won_count: bigint }>>`
        SELECT
          EXTRACT(MONTH FROM "closedAt")::int as month,
          EXTRACT(YEAR FROM "closedAt")::int as year,
          COALESCE(SUM("expectedValue"), 0) as revenue,
          COUNT(*) as won_count
        FROM "Lead"
        WHERE "tenantId" = ${tenantId}
          AND "status" = 'WON'
          AND "deletedAt" IS NULL
          AND "closedAt" IS NOT NULL
          AND "closedAt" >= ${dateFrom}
          AND "closedAt" <= ${dateTo}
        GROUP BY month, year
        ORDER BY year ASC, month ASC
      `,
    ])

    const wonCount = wonData._count ?? 0
    const totalRevenue = wonData._sum?.expectedValue ?? 0
    const totalInvestment = spendData.reduce((sum, s) => sum + s.amount, 0)

    // Agrupar investimento por fonte
    const investmentBySource: Record<string, number> = {}
    for (const s of spendData) {
      investmentBySource[s.source] = (investmentBySource[s.source] ?? 0) + s.amount
    }

    // ROI
    const roi = totalInvestment > 0 ? ((totalRevenue - totalInvestment) / totalInvestment) * 100 : null
    const costPerLead = totalLeads > 0 ? totalInvestment / totalLeads : null
    const costPerConversion = wonCount > 0 ? totalInvestment / wonCount : null

    // Gráfico mensal: investimento vs receita
    const monthNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const monthlyMap = new Map<string, { label: string; investment: number; revenue: number; roi: number | null }>()

    // Preencher com meses do período
    const d = new Date(dateFrom)
    while (d <= dateTo) {
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      const key = `${y}-${m}`
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          label: `${monthNames[m]} ${y}`,
          investment: 0,
          revenue: 0,
          roi: null,
        })
      }
      d.setMonth(d.getMonth() + 1)
    }

    // Popular investimentos
    for (const s of spendData) {
      const key = `${s.year}-${s.month}`
      const entry = monthlyMap.get(key)
      if (entry) entry.investment += s.amount
    }

    // Popular receita
    for (const r of monthlyRevenue) {
      const key = `${r.year}-${r.month}`
      const entry = monthlyMap.get(key)
      if (entry) entry.revenue += r.revenue
    }

    // Calcular ROI mensal
    for (const entry of monthlyMap.values()) {
      if (entry.investment > 0) {
        entry.roi = Math.round(((entry.revenue - entry.investment) / entry.investment) * 100 * 10) / 10
      }
    }

    const monthlyChart = Array.from(monthlyMap.values())

    // Investimentos por fonte (para pie chart)
    const sourceBreakdown = Object.entries(investmentBySource)
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Lista detalhada de investimentos
    const spendList = spendData.map(s => ({
      id: s.id,
      month: s.month,
      year: s.year,
      monthLabel: `${monthNames[s.month]} ${s.year}`,
      amount: s.amount,
      source: s.source,
      notes: s.notes,
    }))

    return NextResponse.json({
      metrics: {
        totalInvestment,
        totalRevenue,
        roi: roi !== null ? Math.round(roi * 10) / 10 : null,
        costPerLead: costPerLead !== null ? Math.round(costPerLead * 100) / 100 : null,
        costPerConversion: costPerConversion !== null ? Math.round(costPerConversion * 100) / 100 : null,
        totalLeads,
        wonCount,
      },
      charts: {
        monthly: monthlyChart,
        sourceBreakdown,
      },
      spendList,
    })
  } catch (err) {
    console.error('[CRM ROI Report API]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — criar/atualizar investimento
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { tenantId, month, year, amount, source, notes } = body

    if (!tenantId || !month || !year || amount === undefined || !source) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenantId, month, year, amount, source' }, { status: 400 })
    }

    // Resolver tenant
    let resolvedTenantId = tenantId
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) resolvedTenantId = tenantBySlug.id
    }

    const spend = await prisma.crmMarketingSpend.upsert({
      where: {
        tenantId_month_year_source: {
          tenantId: resolvedTenantId,
          month: Number(month),
          year: Number(year),
          source: String(source),
        },
      },
      create: {
        tenantId: resolvedTenantId,
        month: Number(month),
        year: Number(year),
        amount: Number(amount),
        source: String(source),
        notes: notes ? String(notes) : null,
      },
      update: {
        amount: Number(amount),
        notes: notes ? String(notes) : null,
      },
    })

    return NextResponse.json(spend, { status: 201 })
  } catch (err) {
    console.error('[CRM ROI Spend POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remover investimento
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    await prisma.crmMarketingSpend.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[CRM ROI Spend DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Helper: construir OR para filtro de meses
function buildMonthRange(startMonth: number, startYear: number, endMonth: number, endYear: number) {
  const conditions: Array<{ month: number; year: number }> = []
  let m = startMonth
  let y = startYear
  while (y < endYear || (y === endYear && m <= endMonth)) {
    conditions.push({ month: m, year: y })
    m++
    if (m > 12) { m = 1; y++ }
  }
  // Se vazio, ao menos inclua o mês atual
  if (conditions.length === 0) {
    conditions.push({ month: startMonth, year: startYear })
  }
  return conditions
}
