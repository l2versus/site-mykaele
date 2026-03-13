// app/api/admin/crm/reports/communications/route.ts — Relatório de Comunicações
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

    const [
      totalSent, totalReceived,
      openConversations, closedConversations,
      avgResponseTime,
      messageTimeline,
      messagesByDow,
      messageHeatmap,
      topLeads,
    ] = await Promise.all([
      // Total enviadas
      prisma.message.count({
        where: { tenantId, fromMe: true, createdAt: { gte: dateFrom, lte: dateTo } },
      }),

      // Total recebidas
      prisma.message.count({
        where: { tenantId, fromMe: false, createdAt: { gte: dateFrom, lte: dateTo } },
      }),

      // Conversas abertas
      prisma.conversation.count({
        where: { tenantId, isClosed: false },
      }),

      // Conversas fechadas no período
      prisma.conversation.count({
        where: { tenantId, isClosed: true, updatedAt: { gte: dateFrom, lte: dateTo } },
      }),

      // Tempo médio de resposta
      prisma.$queryRaw<Array<{ avg_minutes: number | null }>>`
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
            AND m1."createdAt" <= ${dateTo}
          GROUP BY m1.id, m1."conversationId", m1."createdAt"
        )
        SELECT AVG(EXTRACT(EPOCH FROM (responded_at - received_at)) / 60) as avg_minutes
        FROM response_pairs
        WHERE responded_at IS NOT NULL
      `,

      // Mensagens por dia (timeline)
      prisma.$queryRaw<Array<{ day: string; sent: bigint; received: bigint }>>`
        SELECT
          TO_CHAR(d.day, 'YYYY-MM-DD') as day,
          COALESCE(s.sent, 0) as sent,
          COALESCE(r.received, 0) as received
        FROM generate_series(${dateFrom}::date, ${dateTo}::date, '1 day'::interval) d(day)
        LEFT JOIN (
          SELECT DATE("createdAt") as dt, COUNT(*) as sent
          FROM "Message"
          WHERE "tenantId" = ${tenantId} AND "fromMe" = true
            AND "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
          GROUP BY dt
        ) s ON s.dt = d.day::date
        LEFT JOIN (
          SELECT DATE("createdAt") as dt, COUNT(*) as received
          FROM "Message"
          WHERE "tenantId" = ${tenantId} AND "fromMe" = false
            AND "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
          GROUP BY dt
        ) r ON r.dt = d.day::date
        ORDER BY d.day ASC
      `,

      // Mensagens por dia da semana
      prisma.$queryRaw<Array<{ dow: number; count: bigint }>>`
        SELECT
          EXTRACT(DOW FROM "createdAt")::int as dow,
          COUNT(*) as count
        FROM "Message"
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
        GROUP BY dow
        ORDER BY dow
      `,

      // Heatmap: mensagens por hora x dia da semana
      prisma.$queryRaw<Array<{ dow: number; hour: number; count: bigint }>>`
        SELECT
          EXTRACT(DOW FROM "createdAt")::int as dow,
          EXTRACT(HOUR FROM "createdAt")::int as hour,
          COUNT(*) as count
        FROM "Message"
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
        GROUP BY dow, hour
        ORDER BY dow, hour
      `,

      // Top leads por volume de mensagens
      prisma.$queryRaw<Array<{ lead_id: string; lead_name: string; msg_count: bigint }>>`
        SELECT
          l.id as lead_id,
          l.name as lead_name,
          COUNT(m.id) as msg_count
        FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        JOIN "Lead" l ON l.id = c."leadId"
        WHERE m."tenantId" = ${tenantId}
          AND m."createdAt" >= ${dateFrom} AND m."createdAt" <= ${dateTo}
          AND l."deletedAt" IS NULL
        GROUP BY l.id, l.name
        ORDER BY msg_count DESC
        LIMIT 10
      `,
    ])

    const avgMinutes = avgResponseTime[0]?.avg_minutes ?? null

    // Heatmap matrix: 7 dias x 24 horas
    const heatmapMatrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const h of messageHeatmap) {
      heatmapMatrix[h.dow][h.hour] = Number(h.count)
    }

    // Preencher dia da semana com zeros
    const dowData = Array.from({ length: 7 }, (_, i) => ({
      dow: i,
      count: 0,
    }))
    for (const d of messagesByDow) {
      dowData[d.dow].count = Number(d.count)
    }

    return NextResponse.json({
      metrics: {
        totalSent,
        totalReceived,
        totalMessages: totalSent + totalReceived,
        openConversations,
        closedConversations,
        avgResponseMinutes: avgMinutes !== null ? Math.round(avgMinutes * 10) / 10 : null,
      },
      charts: {
        timeline: messageTimeline.map(d => ({
          day: d.day,
          sent: Number(d.sent),
          received: Number(d.received),
        })),
        byDow: dowData,
        heatmap: heatmapMatrix,
        topLeads: topLeads.map(l => ({
          id: l.lead_id,
          name: l.lead_name,
          messageCount: Number(l.msg_count),
        })),
      },
    })
  } catch (err) {
    console.error('[CRM Communications Report API]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
