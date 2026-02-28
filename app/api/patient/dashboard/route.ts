import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const now = new Date()

    // --- Appointments ---
    const allAppointments = await prisma.appointment.findMany({
      where: { userId: user.userId },
      include: { service: { select: { name: true, duration: true } } },
      orderBy: { scheduledAt: 'desc' },
    })

    const upcoming = allAppointments
      .filter(a => ['PENDING', 'CONFIRMED'].includes(a.status) && new Date(a.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

    const nextAppointment = upcoming[0] || null

    const completedCount = allAppointments.filter(a => a.status === 'COMPLETED').length
    const totalCount = allAppointments.length
    const cancelledCount = allAppointments.filter(a => a.status === 'CANCELLED').length
    const upcomingCount = upcoming.length

    // --- Packages (Protocolos) ---
    const packages = await prisma.package.findMany({
      where: { userId: user.userId },
      include: {
        packageOption: {
          include: { service: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const activePackages = packages.filter(p => p.status === 'ACTIVE')
    const completedPackages = packages.filter(p => p.status === 'COMPLETED')

    // Protocol progress (primary active package)
    const primaryProtocol = activePackages[0] || null
    const protocolProgress = primaryProtocol
      ? {
          id: primaryProtocol.id,
          name: primaryProtocol.packageOption.name,
          serviceName: primaryProtocol.packageOption.service.name,
          serviceId: primaryProtocol.packageOption.serviceId,
          totalSessions: primaryProtocol.totalSessions,
          usedSessions: primaryProtocol.usedSessions,
          remaining: primaryProtocol.totalSessions - primaryProtocol.usedSessions,
          progressPercent: Math.round((primaryProtocol.usedSessions / primaryProtocol.totalSessions) * 100),
          phase: getPhase(primaryProtocol.usedSessions, primaryProtocol.totalSessions),
          purchaseDate: primaryProtocol.purchaseDate,
        }
      : null

    // --- Payments ---
    const payments = await prisma.payment.findMany({
      where: { userId: user.userId, category: 'REVENUE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const totalInvested = payments.reduce((sum, p) => sum + p.amount, 0)

    // --- User balance ---
    const userData = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { balance: true }
    })
    const userBalance = userData?.balance || 0

    // --- Session History (last 5 completed) ---
    const recentSessions = allAppointments
      .filter(a => a.status === 'COMPLETED')
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        date: a.scheduledAt,
        serviceName: a.service.name,
        duration: a.service.duration,
        price: a.price,
      }))

    // --- Body Measurements (latest) ---
    const latestMeasurement = await prisma.bodyMeasurement.findFirst({
      where: { userId: user.userId },
      orderBy: { date: 'desc' },
    })
    const firstMeasurement = await prisma.bodyMeasurement.findFirst({
      where: { userId: user.userId },
      orderBy: { date: 'asc' },
    })
    const measurementCount = await prisma.bodyMeasurement.count({ where: { userId: user.userId } })

    // --- Monthly Activity (last 6 months) ---
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const monthlyActivity = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const monthApts = allAppointments.filter(
        a => a.status === 'COMPLETED' && new Date(a.scheduledAt) >= monthStart && new Date(a.scheduledAt) <= monthEnd
      )
      const monthName = monthStart.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      monthlyActivity.push({ month: monthName, sessions: monthApts.length })
    }

    return NextResponse.json({
      nextAppointment: nextAppointment
        ? {
            id: nextAppointment.id,
            scheduledAt: nextAppointment.scheduledAt,
            serviceName: nextAppointment.service.name,
            duration: nextAppointment.service.duration,
            status: nextAppointment.status,
            type: nextAppointment.type,
            location: nextAppointment.location,
          }
        : null,
      stats: {
        totalSessions: totalCount,
        completedSessions: completedCount,
        upcomingSessions: upcomingCount,
        cancelledSessions: cancelledCount,
        activePackages: activePackages.length,
        completedPackages: completedPackages.length,
        totalInvested,
        balance: userBalance,
      },
      protocolProgress,
      allProtocols: activePackages.map(p => ({
        id: p.id,
        name: p.packageOption.name,
        serviceName: p.packageOption.service.name,
        serviceId: p.packageOption.serviceId,
        totalSessions: p.totalSessions,
        usedSessions: p.usedSessions,
        remaining: p.totalSessions - p.usedSessions,
        progressPercent: Math.round((p.usedSessions / p.totalSessions) * 100),
        phase: getPhase(p.usedSessions, p.totalSessions),
      })),
      upcomingAppointments: upcoming.slice(0, 5).map(a => ({
        id: a.id,
        scheduledAt: a.scheduledAt,
        serviceName: a.service.name,
        status: a.status,
        type: a.type,
      })),
      recentSessions,
      monthlyActivity,
      payments: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        description: p.description,
        date: p.createdAt,
      })),
      bodyMetrics: latestMeasurement && firstMeasurement ? {
        hasMeasurements: true,
        totalMeasurements: measurementCount,
        latest: {
          date: latestMeasurement.date,
          weight: latestMeasurement.weight,
          bodyFat: latestMeasurement.bodyFat,
          waist: latestMeasurement.waist,
          hip: latestMeasurement.hip,
          bmi: latestMeasurement.weight && latestMeasurement.height
            ? +(latestMeasurement.weight / ((latestMeasurement.height / 100) ** 2)).toFixed(1) : null,
        },
        deltas: {
          weight: latestMeasurement.weight && firstMeasurement.weight ? +(latestMeasurement.weight - firstMeasurement.weight).toFixed(1) : null,
          waist: latestMeasurement.waist && firstMeasurement.waist ? +(latestMeasurement.waist - firstMeasurement.waist).toFixed(1) : null,
          hip: latestMeasurement.hip && firstMeasurement.hip ? +(latestMeasurement.hip - firstMeasurement.hip).toFixed(1) : null,
          bodyFat: latestMeasurement.bodyFat && firstMeasurement.bodyFat ? +(latestMeasurement.bodyFat - firstMeasurement.bodyFat).toFixed(1) : null,
        },
      } : { hasMeasurements: false, totalMeasurements: 0, latest: null, deltas: null },
    })
  } catch (error) {
    console.error('Client dashboard error:', error)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}

function getPhase(used: number, total: number): { number: number; name: string; description: string } {
  const pct = total > 0 ? used / total : 0
  if (pct === 0) return { number: 1, name: 'Início', description: 'Preparação e avaliação inicial' }
  if (pct < 0.3) return { number: 1, name: 'Ativação', description: 'Desintoxicação e estímulo metabólico' }
  if (pct < 0.6) return { number: 2, name: 'Remodelação', description: 'Redução e modelagem corporal intensiva' }
  if (pct < 0.9) return { number: 3, name: 'Refinamento', description: 'Definição e ajuste fino dos contornos' }
  return { number: 4, name: 'Manutenção', description: 'Consolidação e manutenção dos resultados' }
}
