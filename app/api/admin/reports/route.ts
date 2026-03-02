import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const type = searchParams.get('type') || 'overview'

    const dateFrom = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const dateTo = to ? new Date(to + 'T23:59:59') : new Date()

    const [appointments, payments, expenses, users] = await Promise.all([
      prisma.appointment.findMany({
        where: { scheduledAt: { gte: dateFrom, lte: dateTo } },
        include: { user: { select: { name: true, email: true } }, service: { select: { name: true, price: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.expense.findMany({
        where: { date: { gte: dateFrom, lte: dateTo } },
        orderBy: { date: 'asc' },
      }),
      prisma.user.findMany({
        where: { role: 'PATIENT' },
        select: { id: true, name: true, createdAt: true },
      }),
    ])

    // Revenue by service
    const serviceRevenue: Record<string, { name: string; revenue: number; count: number }> = {}
    appointments.filter(a => a.status === 'COMPLETED').forEach(a => {
      const name = a.service.name
      if (!serviceRevenue[name]) serviceRevenue[name] = { name, revenue: 0, count: 0 }
      serviceRevenue[name].revenue += a.price
      serviceRevenue[name].count++
    })

    // Revenue by month
    const monthlyRevenue: Record<string, number> = {}
    const monthlyExpenses: Record<string, number> = {}
    payments.forEach(p => {
      const key = new Date(p.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + p.amount
    })
    expenses.forEach(e => {
      const key = new Date(e.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      monthlyExpenses[key] = (monthlyExpenses[key] || 0) + e.amount
    })

    // Client retention
    const clientApptsCount: Record<string, number> = {}
    appointments.filter(a => a.status === 'COMPLETED').forEach(a => {
      clientApptsCount[a.userId] = (clientApptsCount[a.userId] || 0) + 1
    })
    const totalClients = Object.keys(clientApptsCount).length
    const returningClients = Object.values(clientApptsCount).filter(c => c > 1).length
    const retentionRate = totalClients > 0 ? (returningClients / totalClients) * 100 : 0

    // Expense breakdown by category
    const expenseByCategory: Record<string, number> = {}
    expenses.forEach(e => { expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount })

    // Daily revenue for chart
    const dailyRevenue: Record<string, number> = {}
    payments.forEach(p => {
      const key = new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      dailyRevenue[key] = (dailyRevenue[key] || 0) + p.amount
    })

    // Status breakdown
    const statusCount: Record<string, number> = {}
    appointments.forEach(a => { statusCount[a.status] = (statusCount[a.status] || 0) + 1 })

    // Hour heatmap
    const hourHeatmap: Record<number, number> = {}
    appointments.filter(a => a.status === 'COMPLETED').forEach(a => {
      const h = new Date(a.scheduledAt).getHours()
      hourHeatmap[h] = (hourHeatmap[h] || 0) + 1
    })

    // New clients per month
    const newClientsPerMonth: Record<string, number> = {}
    users.forEach(u => {
      const key = new Date(u.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      newClientsPerMonth[key] = (newClientsPerMonth[key] || 0) + 1
    })

    // Payment methods
    const paymentMethods: Record<string, { count: number; total: number }> = {}
    payments.forEach(p => {
      if (!paymentMethods[p.method]) paymentMethods[p.method] = { count: 0, total: 0 }
      paymentMethods[p.method].count++
      paymentMethods[p.method].total += p.amount
    })

    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const profit = totalRevenue - totalExpenses

    return NextResponse.json({
      summary: { totalRevenue, totalExpenses, profit, totalAppointments: appointments.length, totalClients, retentionRate: Math.round(retentionRate) },
      serviceRevenue: Object.values(serviceRevenue).sort((a, b) => b.revenue - a.revenue),
      monthlyRevenue, monthlyExpenses, dailyRevenue,
      expenseByCategory, statusCount, hourHeatmap,
      newClientsPerMonth, paymentMethods,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao gerar relatorio' }, { status: 500 })
  }
}
