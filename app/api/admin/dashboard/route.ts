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
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // Start of current week 
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    // Get basic data
    const totalClients = await prisma.user.count({ where: { role: 'PATIENT' } })
    const appointmentsThisMonth = await prisma.appointment.count({ 
      where: { scheduledAt: { gte: startOfMonth, lte: endOfMonth } } 
    })

    const upcomingAppointments = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } },
      include: { user: { select: { name: true, phone: true } }, service: { select: { name: true, duration: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    })

    // Appointment statuses this month
    const appointmentsByStatus = {
      pending: await prisma.appointment.count({ where: { status: 'PENDING', scheduledAt: { gte: startOfMonth, lte: endOfMonth } } }),
      confirmed: await prisma.appointment.count({ where: { status: 'CONFIRMED', scheduledAt: { gte: startOfMonth, lte: endOfMonth } } }),
      completed: await prisma.appointment.count({ where: { status: 'COMPLETED', scheduledAt: { gte: startOfMonth, lte: endOfMonth } } }),
      cancelled: await prisma.appointment.count({ where: { status: 'CANCELLED', scheduledAt: { gte: startOfMonth, lte: endOfMonth } } }),
      noShow: await prisma.appointment.count({ where: { status: 'NO_SHOW', scheduledAt: { gte: startOfMonth, lte: endOfMonth } } }),
    }

    // Weekly activity
    const weekAppointments = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: startOfWeek, lte: endOfWeek } },
      select: { scheduledAt: true },
    })

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const weeklyActivity = weekDays.map((day, i) => {
      const count = weekAppointments.filter(a => new Date(a.scheduledAt).getDay() === i).length
      return { day, count }
    })

    // Top services
    const topServices = await prisma.appointment.groupBy({
      by: ['serviceId'],
      where: { scheduledAt: { gte: startOfMonth, lte: endOfMonth } },
      _count: true,
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    })

    const serviceIds = topServices.map(s => s.serviceId)
    const services = serviceIds.length > 0
      ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true, price: true } })
      : []

    const topServicesData = topServices.map(s => {
      const svc = services.find(sv => sv.id === s.serviceId)
      return { name: svc?.name || 'Desconhecido', count: s._count, price: svc?.price || 0 }
    })

    // Today's appointments
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const todayAppointments = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: startOfDay, lte: endOfDay } },
      include: { user: { select: { name: true, phone: true } }, service: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' },
    })

    // Payments
    const recentPayments = await prisma.payment.findMany({
      where: { createdAt: { gte: startOfMonth } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const revenueThisMonth = recentPayments.reduce((sum, p) => sum + p.amount, 0)

    // Calculate metrics
    const totalAppointments = appointmentsByStatus.pending + appointmentsByStatus.confirmed + 
                             appointmentsByStatus.completed + appointmentsByStatus.cancelled + appointmentsByStatus.noShow
    
    const conversionRate = totalAppointments > 0 ? 
      Math.round((appointmentsByStatus.completed / totalAppointments) * 100) : 0
    const cancellationRate = totalAppointments > 0 ?
      Math.round((appointmentsByStatus.cancelled / totalAppointments) * 100) : 0
    const noShowRate = totalAppointments > 0 ?
      Math.round((appointmentsByStatus.noShow / totalAppointments) * 100) : 0

    const averageTicket = recentPayments.length > 0 ? revenueThisMonth / recentPayments.length : 0
    const ltv = totalClients > 0 ? revenueThisMonth / totalClients : 0
    const occupancyRate = appointmentsThisMonth > 0 ? Math.min(Math.round((appointmentsThisMonth / 30) * 10), 100) : 0

    return NextResponse.json({
      stats: {
        totalClients,
        appointmentsThisMonth,
        appointmentsLastMonth: 0,
        revenueThisMonth,
        revenueLastMonth: 0,
        revenueGrowth: 0,
        appointmentGrowth: 0,
        pendingAppointments: appointmentsByStatus.pending,
        expensesThisMonth: 0,
        profit: revenueThisMonth,
        averageTicket: Math.round(averageTicket),
        ltv: Math.round(ltv),
        mrr: 0,
        occupancyRate,
        noShowRate,
        cancellationRate,
        conversionRate,
      },
      appointmentsByStatus,
      weeklyActivity,
      topServices: topServicesData,
      upcomingAppointments,
      todayAppointments,
      recentPayments,
      recentClients: [],
      followUpAlerts: [],
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ 
      stats: {
        totalClients: 0,
        appointmentsThisMonth: 0,
        appointmentsLastMonth: 0,
        revenueThisMonth: 0,
        revenueLastMonth: 0,
        revenueGrowth: 0,
        appointmentGrowth: 0,
        pendingAppointments: 0,
        expensesThisMonth: 0,
        profit: 0,
        averageTicket: 0,
        ltv: 0,
        mrr: 0,
        occupancyRate: 0,
        noShowRate: 0,
        cancellationRate: 0,
        conversionRate: 0,
      },
      appointmentsByStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 },
      weeklyActivity: [],
      topServices: [],
      upcomingAppointments: [],
      todayAppointments: [],
      recentPayments: [],
      recentClients: [],
      followUpAlerts: [],
    })
  }
}
