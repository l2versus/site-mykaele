// app/api/appointments/route.ts — PROTEGIDO com auth
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdminOrUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

export async function GET(request: NextRequest) {
  const user = getAdminOrUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)

    // Admin pode ver todos; paciente só seus próprios
    const where = user.role === 'ADMIN'
      ? (searchParams.get('userId') ? { userId: searchParams.get('userId')! } : {})
      : { userId: user.userId }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        service: { select: { name: true, duration: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ message: 'OK', data: appointments }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar agendamentos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getAdminOrUser(request)
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado — use /api/patient/appointments' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { userId, serviceId, scheduledAt, type, location, notes } = body

    if (!userId || !serviceId || !scheduledAt) {
      return NextResponse.json({ error: 'userId, serviceId e scheduledAt obrigatórios' }, { status: 400 })
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } })
    if (!service) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })

    const date = new Date(scheduledAt)
    const endAt = new Date(date.getTime() + service.duration * 60000)
    const price = type === 'RETURN' && service.priceReturn ? service.priceReturn : service.price

    const appointment = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          scheduledAt: { lt: endAt },
          endAt: { gt: date },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      })
      if (conflict) throw new Error('CONFLICT')

      return tx.appointment.create({
        data: {
          userId, serviceId,
          scheduledAt: date, endAt,
          type: type || 'FIRST',
          status: 'PENDING',
          location: location || 'CLINIC',
          notes, price,
        },
      })
    })

    return NextResponse.json({ message: 'Agendamento criado', data: appointment }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'CONFLICT') return NextResponse.json({ error: 'Horário indisponível' }, { status: 409 })
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
  }
}
