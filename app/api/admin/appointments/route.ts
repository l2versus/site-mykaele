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
    const { id, status, cancellationReason } = await req.json()
    if (!id || !status) return NextResponse.json({ error: 'id e status são obrigatórios' }, { status: 400 })

    // Validar transições de status permitidas
    const VALID_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    }

    const current = await prisma.appointment.findUnique({ where: { id }, select: { status: true } })
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

    const appointment = await prisma.appointment.update({ where: { id }, data })
    return NextResponse.json({ appointment })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 })
  }
}
