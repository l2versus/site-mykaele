// app/api/admin/crm/reports/consolidated/route.ts — Relatório Consolidado por estágio
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
    const pipelineId = req.nextUrl.searchParams.get('pipelineId')
    const assignedTo = req.nextUrl.searchParams.get('assignedTo')

    const [pipelines, stageMetrics, heatmap, teamMembers] = await Promise.all([
      // Pipelines disponíveis
      prisma.pipeline.findMany({
        where: { tenantId },
        select: { id: true, name: true, isDefault: true },
        orderBy: { createdAt: 'asc' },
      }),

      // Métricas por estágio (tempo médio de permanência + contagem real no período)
      prisma.$queryRaw<Array<{
        stage_id: string; stage_name: string; stage_color: string | null
        stage_type: string; stage_order: number; pipeline_name: string
        lead_count: bigint; total_value: number; avg_days: number | null
      }>>`
        SELECT
          s.id as stage_id,
          s.name as stage_name,
          s.color as stage_color,
          s.type::text as stage_type,
          s.order as stage_order,
          p.name as pipeline_name,
          COUNT(l.id) as lead_count,
          COALESCE(SUM(l."expectedValue"), 0) as total_value,
          AVG(
            EXTRACT(EPOCH FROM (
              CASE
                WHEN l."closedAt" IS NOT NULL THEN l."closedAt"
                ELSE NOW()
              END - l."createdAt"
            )) / 86400
          ) as avg_days
        FROM "Stage" s
        JOIN "Pipeline" p ON p.id = s."pipelineId"
        LEFT JOIN "Lead" l ON l."stageId" = s.id
          AND l."deletedAt" IS NULL
          ${assignedTo ? prisma.$queryRaw`AND l."assignedToUserId" = ${assignedTo}` : prisma.$queryRaw``}
        WHERE s."tenantId" = ${tenantId}
          ${pipelineId ? prisma.$queryRaw`AND s."pipelineId" = ${pipelineId}` : prisma.$queryRaw``}
        GROUP BY s.id, s.name, s.color, s.type, s.order, p.name
        ORDER BY p.name ASC, s.order ASC
      `,

      // Heatmap: movimentações por dia da semana x hora
      prisma.$queryRaw<Array<{ dow: number; hour: number; count: bigint }>>`
        SELECT
          EXTRACT(DOW FROM "createdAt")::int as dow,
          EXTRACT(HOUR FROM "createdAt")::int as hour,
          COUNT(*) as count
        FROM "LeadActivity"
        WHERE "type" = 'STAGE_CHANGED'
          AND "createdAt" >= ${dateFrom}
          AND "createdAt" <= ${dateTo}
          AND "leadId" IN (
            SELECT id FROM "Lead" WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL
          )
        GROUP BY dow, hour
        ORDER BY dow, hour
      `,

      // Team members para filtro
      prisma.crmTeamMember.findMany({
        where: { tenantId, isActive: true },
        select: { userId: true, displayName: true },
      }),
    ])

    // Converter BigInt e calcular taxas de conversão entre estágios
    const stages = stageMetrics.map(s => ({
      id: s.stage_id,
      name: s.stage_name,
      color: s.stage_color,
      type: s.stage_type,
      order: s.stage_order,
      pipeline: s.pipeline_name,
      leadCount: Number(s.lead_count),
      totalValue: s.total_value,
      avgDays: s.avg_days !== null ? Math.round(s.avg_days * 10) / 10 : null,
    }))

    // Taxas de conversão entre estágios adjacentes (apenas OPEN)
    const openStages = stages.filter(s => s.type === 'OPEN')
    const stagesWithConversion = openStages.map((s, i) => ({
      ...s,
      conversionToNext: i < openStages.length - 1 && s.leadCount > 0
        ? Math.round((openStages[i + 1].leadCount / s.leadCount) * 100 * 10) / 10
        : null,
    }))

    // Heatmap: 7 dias x 24 horas
    const heatmapMatrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const h of heatmap) {
      heatmapMatrix[h.dow][h.hour] = Number(h.count)
    }

    return NextResponse.json({
      pipelines,
      stages: stagesWithConversion,
      wonLostStages: stages.filter(s => s.type !== 'OPEN'),
      heatmap: heatmapMatrix,
      teamMembers,
    })
  } catch (err) {
    console.error('[CRM Consolidated Report API]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
