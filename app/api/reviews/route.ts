// API de avaliações públicas
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Buscar avaliações aprovadas (público) ou todas (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isAdmin = searchParams.get('admin') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    // Buscar feedbacks com score >= 7 para exibição pública
    // Para admin, buscar todos
    const feedbacks = await prisma.sessionFeedback.findMany({
      where: isAdmin ? {} : { score: { gte: 7 } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Buscar nomes dos usuários e serviços dos agendamentos
    const enriched = await Promise.all(
      feedbacks.map(async (fb) => {
        const user = await prisma.user.findUnique({
          where: { id: fb.userId },
          select: { name: true },
        })
        const appointment = await prisma.appointment.findUnique({
          where: { id: fb.appointmentId },
          select: {
            service: { select: { name: true } },
          },
        })

        // Anonimizar nome: "Marina Santos" → "Marina S."
        const fullName = user?.name || 'Cliente'
        const parts = fullName.split(' ')
        const displayName = parts.length > 1
          ? `${parts[0]} ${parts[parts.length - 1][0]}.`
          : parts[0]

        return {
          id: fb.id,
          nome: displayName,
          cidade: 'Fortaleza, CE',
          texto: fb.comment || '',
          procedimento: appointment?.service?.name || 'Estética Avançada',
          score: fb.score,
          categories: fb.categories ? JSON.parse(fb.categories) : [],
          createdAt: fb.createdAt,
        }
      })
    )

    // Filtrar apenas os que têm comentário para exibição pública
    const filtered = isAdmin ? enriched : enriched.filter(r => r.texto.length > 10)

    return NextResponse.json({ reviews: filtered })
  } catch (error) {
    console.error('Erro ao buscar avaliações:', error)
    return NextResponse.json({ reviews: [] })
  }
}

// POST - Cliente envia avaliação após sessão
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, appointmentId, score, comment, categories } = body

    if (!userId || !appointmentId || !score) {
      return NextResponse.json(
        { error: 'userId, appointmentId e score são obrigatórios' },
        { status: 400 }
      )
    }

    if (score < 1 || score > 10) {
      return NextResponse.json(
        { error: 'Score deve ser entre 1 e 10' },
        { status: 400 }
      )
    }

    // Verificar se já existe feedback para este appointment
    const existing = await prisma.sessionFeedback.findUnique({
      where: { appointmentId },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Avaliação já enviada para esta sessão' },
        { status: 409 }
      )
    }

    // Verificar se o appointment existe e pertence ao user
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, userId },
    })
    if (!appointment) {
      return NextResponse.json(
        { error: 'Agendamento não encontrado' },
        { status: 404 }
      )
    }

    const feedback = await prisma.sessionFeedback.create({
      data: {
        userId,
        appointmentId,
        score,
        comment: comment || null,
        categories: categories ? JSON.stringify(categories) : null,
      },
    })

    // ═══ Award loyalty points for review ═══
    try {
      const POINTS_REVIEW = 30
      const calcTier = (t: number) => t >= 5000 ? 'DIAMOND' : t >= 1500 ? 'GOLD' : t >= 500 ? 'SILVER' : 'BRONZE'

      let loyalty = await prisma.loyaltyPoints.findUnique({ where: { userId } })
      if (!loyalty) {
        loyalty = await prisma.loyaltyPoints.create({
          data: { userId, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
        })
      }
      const newTier = calcTier(loyalty.totalEarned + POINTS_REVIEW)
      await prisma.$transaction([
        prisma.loyaltyPoints.update({
          where: { userId },
          data: { points: { increment: POINTS_REVIEW }, totalEarned: { increment: POINTS_REVIEW }, tier: newTier },
        }),
        prisma.loyaltyTransaction.create({
          data: {
            userId,
            points: POINTS_REVIEW,
            type: 'REVIEW_BONUS',
            description: '⭐ Bônus por avaliação de sessão',
            referenceId: feedback.id,
          },
        }),
      ])
    } catch (loyaltyErr) {
      console.error('Loyalty review bonus error (non-blocking):', loyaltyErr)
    }

    return NextResponse.json({ success: true, feedback }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar avaliação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
