// app/api/admin/crm/team/stats/route.ts — Productivity stats per member
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

    const tenantParam = req.nextUrl.searchParams.get('tenantId')
    if (!tenantParam) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

    const tenant = await prisma.crmTenant.findFirst({
      where: { OR: [{ id: tenantParam }, { slug: tenantParam }] },
      select: { id: true },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    const memberId = req.nextUrl.searchParams.get('memberId')

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)

    // Build member filter
    const memberFilter = memberId ? { assignedToUserId: memberId } : {}
    const sentByFilter = memberId ? { sentByUserId: memberId } : {}

    // Won leads this month (for commission)
    const wonLeads = await prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: 'WON',
        closedAt: { gte: monthStart },
        ...memberFilter,
      },
      select: { expectedValue: true, assignedToUserId: true },
    })

    // Lost leads this month
    const lostCount = await prisma.lead.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: 'LOST',
        closedAt: { gte: monthStart },
        ...memberFilter,
      },
    })

    // Messages sent this week (daily breakdown)
    const messagesSentWeek = await prisma.message.findMany({
      where: {
        tenantId: tenant.id,
        fromMe: true,
        createdAt: { gte: weekStart },
        ...sentByFilter,
      },
      select: { createdAt: true, sentByUserId: true },
    })

    // Pending tasks
    const pendingTasks = await prisma.crmTask.count({
      where: {
        tenantId: tenant.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        ...(memberId ? { assignedToUserId: memberId } : {}),
      },
    })

    // Aggregate daily messages
    const dailyMessages: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = d.toISOString().split('T')[0]
      dailyMessages[key] = 0
    }
    for (const msg of messagesSentWeek) {
      const key = msg.createdAt.toISOString().split('T')[0]
      if (dailyMessages[key] !== undefined) dailyMessages[key]++
    }

    // Won value and count by member
    const wonByMember: Record<string, { count: number; value: number }> = {}
    for (const lead of wonLeads) {
      const mid = lead.assignedToUserId ?? '_unassigned'
      if (!wonByMember[mid]) wonByMember[mid] = { count: 0, value: 0 }
      wonByMember[mid].count++
      wonByMember[mid].value += lead.expectedValue ?? 0
    }

    // Get members with commission
    const members = await prisma.crmTeamMember.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, name: true, commissionPercent: true },
    })

    const memberStats = members.map(m => {
      const won = wonByMember[m.id] ?? { count: 0, value: 0 }
      const commission = m.commissionPercent ? (won.value * m.commissionPercent / 100) : null
      return {
        memberId: m.id,
        name: m.name,
        wonCount: won.count,
        wonValue: won.value,
        commissionPercent: m.commissionPercent,
        commission,
      }
    })

    return NextResponse.json({
      period: { monthStart: monthStart.toISOString(), weekStart: weekStart.toISOString() },
      wonLeadsMonth: wonLeads.length,
      wonValueMonth: wonLeads.reduce((s, l) => s + (l.expectedValue ?? 0), 0),
      lostLeadsMonth: lostCount,
      messagesSentWeek: messagesSentWeek.length,
      pendingTasks,
      dailyMessages: Object.entries(dailyMessages).map(([day, count]) => ({ day, count })),
      memberStats,
    })
  } catch (err) {
    console.error('[team/stats] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
