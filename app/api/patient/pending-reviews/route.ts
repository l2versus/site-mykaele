// API para buscar sessões concluídas sem avaliação do paciente
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const user = verifyToken(auth.substring(7))
  if (!user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  try {
    // Buscar todas as sessões COMPLETED do paciente
    const completedAppointments = await prisma.appointment.findMany({
      where: {
        userId: user.userId,
        status: 'COMPLETED',
      },
      include: {
        service: { select: { name: true, duration: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
    })

    // Buscar feedbacks já enviados
    const existingFeedbacks = await prisma.sessionFeedback.findMany({
      where: { userId: user.userId },
      select: { appointmentId: true },
    })
    const reviewedIds = new Set(existingFeedbacks.map(f => f.appointmentId))

    // Filtrar sessões sem avaliação
    const pendingReviews = completedAppointments
      .filter(a => !reviewedIds.has(a.id))
      .slice(0, 5) // máximo 5 pendentes
      .map(a => ({
        id: a.id,
        scheduledAt: a.scheduledAt,
        serviceName: a.service.name,
        duration: a.service.duration,
      }))

    return NextResponse.json({ pendingReviews })
  } catch (error) {
    console.error('Erro ao buscar reviews pendentes:', error)
    return NextResponse.json({ pendingReviews: [] })
  }
}
