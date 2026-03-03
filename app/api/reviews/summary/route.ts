// API para buscar resumo de avaliações por serviço (público)
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Buscar todos os feedbacks com score >= 7
    const feedbacks = await prisma.sessionFeedback.findMany({
      where: { score: { gte: 7 } },
      orderBy: { createdAt: 'desc' },
    })

    // Buscar os appointments para mapear serviço
    const appointmentIds = feedbacks.map(f => f.appointmentId)
    const appointments = await prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      select: { id: true, serviceId: true },
    })
    const aptMap = new Map(appointments.map(a => [a.id, a.serviceId]))

    // Buscar serviços
    const services = await prisma.service.findMany({
      where: { active: true },
      select: { id: true, name: true },
    })
    const serviceMap = new Map(services.map(s => [s.id, s.name]))

    // Calcular métricas por serviço
    const serviceStats: Record<string, { total: number; count: number; name: string }> = {}

    for (const fb of feedbacks) {
      const serviceId = aptMap.get(fb.appointmentId)
      if (!serviceId) continue
      const serviceName = serviceMap.get(serviceId) || 'Serviço'

      if (!serviceStats[serviceId]) {
        serviceStats[serviceId] = { total: 0, count: 0, name: serviceName }
      }
      serviceStats[serviceId].total += fb.score
      serviceStats[serviceId].count++
    }

    // Composição do resumo
    const summary = Object.entries(serviceStats).map(([serviceId, data]) => ({
      serviceId,
      serviceName: data.name,
      averageRating: +(data.total / data.count / 2).toFixed(1), // Scale 1-10 → 1-5
      reviewCount: data.count,
    }))

    // Média geral
    const totalScore = feedbacks.reduce((acc, f) => acc + f.score, 0)
    const overallAvg = feedbacks.length > 0 ? +(totalScore / feedbacks.length / 2).toFixed(1) : 4.9
    const totalReviews = feedbacks.length

    return NextResponse.json({
      overall: {
        averageRating: overallAvg,
        totalReviews,
      },
      services: summary,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    })
  } catch (error) {
    console.error('Erro ao buscar resumo de avaliações:', error)
    return NextResponse.json({
      overall: { averageRating: 4.9, totalReviews: 0 },
      services: [],
    })
  }
}
