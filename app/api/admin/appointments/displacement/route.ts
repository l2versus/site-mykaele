// app/api/admin/appointments/displacement/route.ts
// POST: Iniciar deslocamento — atualiza status no banco + retorna dados para GPS
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { appointmentId } = await req.json()
    if (!appointmentId || typeof appointmentId !== 'string') {
      return NextResponse.json({ error: 'appointmentId é obrigatório' }, { status: 400 })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: { select: { name: true, phone: true, addressLat: true, addressLng: true, address: true } },
        service: { select: { name: true, duration: true } },
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    if (appointment.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: `Só é possível iniciar deslocamento para agendamentos CONFIRMADOS. Status atual: ${appointment.status}` },
        { status: 400 }
      )
    }

    // Atualizar status para EN_ROUTE (Em Deslocamento)
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'EN_ROUTE' },
    })

    // Montar URL do check-in para a cliente
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mykaprocopio.com.br'
    const checkInUrl = `${siteUrl}/check-in/${appointmentId}`

    // Dados de destino (lat/lng da cliente)
    const destination = appointment.user.addressLat && appointment.user.addressLng
      ? { lat: appointment.user.addressLat, lng: appointment.user.addressLng }
      : null

    return NextResponse.json({
      ok: true,
      appointment: {
        id: appointmentId,
        clientName: appointment.user.name,
        clientPhone: appointment.user.phone,
        serviceName: appointment.service.name,
        serviceDuration: appointment.service.duration,
        address: appointment.address || appointment.user.address,
        destination,
        scheduledAt: appointment.scheduledAt,
      },
      checkInUrl,
    })
  } catch (error) {
    console.error('Displacement start error:', error)
    return NextResponse.json({ error: 'Erro ao iniciar deslocamento' }, { status: 500 })
  }
}
