import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { sendPostSessionEmail } from '@/lib/email'

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
      CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'EN_ROUTE'],
      EN_ROUTE: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
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

    // ═══ Award loyalty points on session completion (idempotent) ═══
    if (status === 'COMPLETED') {
      try {
        const calcTier = (t: number) => t >= 5000 ? 'DIAMOND' : t >= 1500 ? 'GOLD' : t >= 500 ? 'SILVER' : 'BRONZE'

        // IDEMPOTÊNCIA: Se já deu pontos para este appointment, não dá de novo
        const alreadyAwarded = await prisma.loyaltyTransaction.findFirst({
          where: { type: 'SESSION_COMPLETE', referenceId: id },
        })
        if (alreadyAwarded) {
          console.log(`[Loyalty] Pontos já concedidos para appointment ${id}, skip.`)
        } else {
          // PONTOS FRACIONADOS: Se veio de pacote, calcula valor proporcional
          let pointsToAward = Math.round(current.price || 0) // 1 ponto por R$1 do serviço
          if (pointsToAward <= 0) pointsToAward = 50 // fallback mínimo

          // Buscar se este appointment veio de um pacote ativo
          const userPackage = await prisma.package.findFirst({
            where: { userId: current.userId, status: 'ACTIVE', packageOption: { service: { id: current.serviceId } } },
            include: { packageOption: true },
          })
          if (userPackage) {
            // Pontos fracionados: valor total do pacote / número de sessões
            pointsToAward = Math.round(userPackage.packageOption.price / userPackage.packageOption.sessions)
          }

          // Garantir que LoyaltyPoints existe (sem race condition)
          await prisma.loyaltyPoints.upsert({
            where: { userId: current.userId },
            create: { userId: current.userId, points: 0, totalEarned: 0, totalSpent: 0, tier: 'BRONZE' },
            update: {},
          })

          const loyalty = await prisma.loyaltyPoints.findUnique({ where: { userId: current.userId } })
          const newTier = calcTier((loyalty?.totalEarned || 0) + pointsToAward)

          try {
            await prisma.$transaction([
              prisma.loyaltyPoints.update({
                where: { userId: current.userId },
                data: { points: { increment: pointsToAward }, totalEarned: { increment: pointsToAward }, tier: newTier },
              }),
              prisma.loyaltyTransaction.create({
                data: {
                  userId: current.userId,
                  points: pointsToAward,
                  type: 'SESSION_COMPLETE',
                  description: `💆 +${pointsToAward} pts por sessão: ${current.service?.name || 'Atendimento'}${userPackage ? ' (pacote)' : ''}`,
                  referenceId: id,
                },
              }),
            ])
            console.log(`[Loyalty] ${pointsToAward} pontos concedidos para user ${current.userId} (apt ${id})`)
          } catch (txErr: unknown) {
            // P2002 = unique constraint (type+referenceId) — webhook duplicado, ignorar
            if (txErr && typeof txErr === 'object' && 'code' in txErr && (txErr as { code: string }).code === 'P2002') {
              console.log(`[Loyalty] Duplicata ignorada (P2002) para appointment ${id}`)
            } else {
              throw txErr
            }
          }
        }
      } catch (loyaltyErr) {
        console.error('Loyalty points award error (non-blocking):', loyaltyErr)
      }

      // ═══ Enviar email pós-sessão ═══
      try {
        const user = await prisma.user.findUnique({
          where: { id: current.userId },
          select: { name: true, email: true }
        })

        if (user?.email) {
          // Buscar medidas recentes para incluir no email
          const recentMeasurements = await prisma.bodyMeasurement.findMany({
            where: { userId: current.userId },
            orderBy: { date: 'desc' },
            take: 2 // Última e penúltima para calcular variação
          })

          let measurements: {
            waist?: { current: number; change: number }
            abdomen?: { current: number; change: number }
            hip?: { current: number; change: number }
            weight?: { current: number; change: number }
          } | undefined

          if (recentMeasurements.length >= 1) {
            const latest = recentMeasurements[0]
            const previous = recentMeasurements[1]

            measurements = {}
            if (latest.waist) {
              measurements.waist = {
                current: latest.waist,
                change: previous?.waist ? Number((latest.waist - previous.waist).toFixed(1)) : 0
              }
            }
            if (latest.abdomen) {
              measurements.abdomen = {
                current: latest.abdomen,
                change: previous?.abdomen ? Number((latest.abdomen - previous.abdomen).toFixed(1)) : 0
              }
            }
            if (latest.hip) {
              measurements.hip = {
                current: latest.hip,
                change: previous?.hip ? Number((latest.hip - previous.hip).toFixed(1)) : 0
              }
            }
            if (latest.weight) {
              measurements.weight = {
                current: latest.weight,
                change: previous?.weight ? Number((latest.weight - previous.weight).toFixed(1)) : 0
              }
            }
          }

          await sendPostSessionEmail({
            clientName: user.name,
            clientEmail: user.email,
            serviceName: current.service?.name || 'Sessão',
            sessionDate: current.scheduledAt.toISOString(),
            measurements,
            adminNotes: current.notes || undefined
          })
          console.log(`[EMAIL] Email pós-sessão enviado para ${user.email}`)
        }
      } catch (emailErr) {
        console.error('Post-session email error (non-blocking):', emailErr)
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

// ═══ DELETE: Excluir agendamento permanentemente ═══
export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

    // ─── Reverter pontos de fidelidade que foram concedidos por este appointment ───
    const loyaltyTxs = await prisma.loyaltyTransaction.findMany({
      where: { referenceId: id, points: { gt: 0 } },
    })
    if (loyaltyTxs.length > 0) {
      const totalPoints = loyaltyTxs.reduce((sum, tx) => sum + tx.points, 0)
      const loyalty = await prisma.loyaltyPoints.findUnique({ where: { userId: appointment.userId } })
      if (loyalty) {
        const calcTier = (t: number) => t >= 5000 ? 'DIAMOND' : t >= 1500 ? 'GOLD' : t >= 500 ? 'SILVER' : 'BRONZE'
        const newEarned = Math.max(0, loyalty.totalEarned - totalPoints)
        const newPoints = Math.max(0, loyalty.points - totalPoints)
        await prisma.loyaltyPoints.update({
          where: { userId: appointment.userId },
          data: { points: newPoints, totalEarned: newEarned, tier: calcTier(newEarned) },
        })
      }
    }

    // ─── Reverter sessão usada de pacote (se aplicável) ───
    if (appointment.status === 'COMPLETED') {
      const userPkg = await prisma.package.findFirst({
        where: { userId: appointment.userId, status: 'ACTIVE', packageOption: { serviceId: appointment.serviceId } },
        include: { packageOption: true },
      })
      if (userPkg && userPkg.usedSessions > 0) {
        await prisma.package.update({
          where: { id: userPkg.id },
          data: { usedSessions: { decrement: 1 } },
        })
      }
    }

    // ─── Remover registros dependentes ───
    await prisma.payment.deleteMany({ where: { appointmentId: id } })
    await prisma.loyaltyTransaction.deleteMany({ where: { referenceId: id } })
    await prisma.sessionFeedback.deleteMany({ where: { appointmentId: id } })
    await prisma.digitalReceipt.deleteMany({ where: { appointmentId: id } })
    await prisma.appointment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin appointments DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao excluir agendamento' }, { status: 500 })
  }
}
