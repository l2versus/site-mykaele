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
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (from) where.scheduledAt = { ...(where.scheduledAt as object || {}), gte: new Date(from) }
    if (to) where.scheduledAt = { ...(where.scheduledAt as object || {}), lte: new Date(to + 'T23:59:59') }
    if (status) where.status = status

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true, email: true } },
        service: { select: { name: true, duration: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error('Admin appointments GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar agendamentos' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id, status, cancellationReason, paymentMethod, confirmPayment } = await req.json()
    if (!id || !status) return NextResponse.json({ error: 'id e status são obrigatórios' }, { status: 400 })

    // Validar transições de status permitidas
    const VALID_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    }

    const current = await prisma.appointment.findUnique({
      where: { id },
      include: { service: { select: { name: true } } },
    })
    if (!current) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

    const allowed = VALID_TRANSITIONS[current.status] || []
    if (!allowed.includes(status)) {
      return NextResponse.json({
        error: `Transição inválida: ${current.status} → ${status}. Permitido: ${allowed.join(', ') || 'nenhuma'}`,
      }, { status: 400 })
    }

    const data: Record<string, unknown> = { status }
    if (cancellationReason) data.cancellationReason = cancellationReason
    if (status === 'CANCELLED') data.cancelledAt = new Date()

    // ═══ Dar baixa de pagamento presencial ═══
    // Quando admin marca COMPLETED + confirmPayment, registra o pagamento
    if (status === 'COMPLETED' && confirmPayment && paymentMethod) {
      const totalAmount = (current.price || 0) + (current.travelFee || 0)

      // Criar registro de Payment (receita real)
      const payment = await prisma.payment.create({
        data: {
          userId: current.userId,
          appointmentId: id,
          amount: totalAmount,
          method: paymentMethod, // PIX, CASH, CARD
          description: `Atendimento: ${current.service?.name || 'Serviço'} — Pagamento presencial`,
          category: 'REVENUE',
          status: 'APPROVED',
        },
      })

      data.paymentStatus = 'PAID_IN_PERSON'
      data.paymentMethod = paymentMethod
      data.paymentId = payment.id
    } else if (status === 'COMPLETED' && !confirmPayment) {
      // Se marcou como realizado SEM confirmar pagamento, fica como UNPAID
      // Receita NÃO é contabilizada até o admin confirmar
      if (current.paymentStatus !== 'PAID_ONLINE') {
        data.paymentStatus = 'UNPAID'
      }
    }

    const appointment = await prisma.appointment.update({ where: { id }, data })

    // ═══ Award loyalty points on session completion ═══
    if (status === 'COMPLETED') {
      try {
        const POINTS_SESSION = 50
        const TIER_THRESHOLDS = { BRONZE: 0, SILVER: 500, GOLD: 1500, DIAMOND: 5000 }
        const calcTier = (t: number) => t >= 5000 ? 'DIAMOND' : t >= 1500 ? 'GOLD' : t >= 500 ? 'SILVER' : 'BRONZE'

        let loyalty = await prisma.loyaltyPoints.upsert({
          where: { userId: current.userId },
          create: { userId: current.userId, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
          update: {},
        })
        const newTier = calcTier(loyalty.totalEarned + POINTS_SESSION)
        await prisma.$transaction([
          prisma.loyaltyPoints.update({
            where: { userId: current.userId },
            data: { points: { increment: POINTS_SESSION }, totalEarned: { increment: POINTS_SESSION }, tier: newTier },
          }),
          prisma.loyaltyTransaction.create({
            data: {
              userId: current.userId,
              points: POINTS_SESSION,
              type: 'SESSION_COMPLETE',
              description: `💆 Pontos por sessão: ${current.service?.name || 'Atendimento'}`,
              referenceId: id,
            },
          }),
        ])
      } catch (loyaltyErr) {
        console.error('Loyalty points award error (non-blocking):', loyaltyErr)
      }
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    console.error('Admin appointments PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 })
  }
}

// ═══ PATCH: Dar baixa em pagamento de appointment já completado ═══
export async function PATCH(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id, paymentMethod } = await req.json()
    if (!id || !paymentMethod) {
      return NextResponse.json({ error: 'id e paymentMethod são obrigatórios' }, { status: 400 })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { service: { select: { name: true } } },
    })
    if (!appointment) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

    if (appointment.paymentStatus === 'PAID_ONLINE' || appointment.paymentStatus === 'PAID_IN_PERSON') {
      return NextResponse.json({ error: 'Pagamento já registrado' }, { status: 400 })
    }

    const totalAmount = (appointment.price || 0) + (appointment.travelFee || 0)

    // Criar registro de Payment
    const payment = await prisma.payment.create({
      data: {
        userId: appointment.userId,
        appointmentId: id,
        amount: totalAmount,
        method: paymentMethod,
        description: `Atendimento: ${appointment.service?.name || 'Serviço'} — Baixa manual`,
        category: 'REVENUE',
        status: 'APPROVED',
      },
    })

    // Atualizar appointment com status de pagamento
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        paymentStatus: 'PAID_IN_PERSON',
        paymentMethod,
        paymentId: payment.id,
      },
    })

    return NextResponse.json({ appointment: updated, payment })
  } catch (error) {
    console.error('Admin appointments PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao dar baixa no pagamento' }, { status: 500 })
  }
}
