import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { sendBookingNotification, sendCancellationNotification } from '@/lib/whatsapp'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const appointments = await prisma.appointment.findMany({
      where: { userId: user.userId },
      include: { service: { select: { name: true, duration: true } } },
      orderBy: { scheduledAt: 'desc' },
    })
    return NextResponse.json({ appointments })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar agendamentos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { serviceId, scheduledAt, type, location, notes, address, skipWhatsApp, packageId } = await req.json()
    if (!serviceId || !scheduledAt) {
      return NextResponse.json({ error: 'serviceId e scheduledAt obrigatórios' }, { status: 400 })
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } })
    if (!service || !service.active) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })

    const date = new Date(scheduledAt)
    const endAt = new Date(date.getTime() + service.duration * 60000)
    const appointmentType = type || 'FIRST'
    const price = appointmentType === 'RETURN' && service.priceReturn ? service.priceReturn : service.price

    // Usar $transaction para evitar race condition (check + create atômico)
    const result = await prisma.$transaction(async (tx) => {
      // Check for conflicts dentro da transaction
      const conflict = await tx.appointment.findFirst({
        where: {
          scheduledAt: { lt: endAt },
          endAt: { gt: date },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      })
      if (conflict) throw new Error('CONFLICT')

      // Se packageId foi provided, validar e decrementar sessões
      let usedPkg = null
      if (packageId) {
        usedPkg = await tx.package.findFirst({
          where: { id: packageId, userId: user.userId, status: 'ACTIVE' },
          include: { packageOption: true },
        })
        if (!usedPkg) throw new Error('PACKAGE_NOT_FOUND')
        if (usedPkg.usedSessions >= usedPkg.totalSessions) throw new Error('PACKAGE_EXHAUSTED')

        await tx.package.update({
          where: { id: packageId },
          data: { usedSessions: { increment: 1 } },
        })
      }

      const appt = await tx.appointment.create({
        data: {
          userId: user.userId,
          serviceId,
          scheduledAt: date,
          endAt,
          type: appointmentType,
          status: 'PENDING',
          location: location || 'CLINIC',
          address: address || null,
          notes,
          price,
        },
        include: { service: { select: { name: true, duration: true } } },
      })

      return { appointment: appt, usedPackage: usedPkg }
    })

    const appointment = result.appointment
    const usedPackage = result.usedPackage

    // Buscar dados do cliente e pacotes ativos
    const client = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true, phone: true } })
    const activePackages = await prisma.package.findMany({
      where: { userId: user.userId, status: 'ACTIVE' },
      include: { packageOption: { select: { name: true, sessions: true, service: { select: { name: true } } } } },
    })

    // Montar info de pacote
    const relatedPkg = usedPackage || activePackages.find(p => p.packageOption.service.name === appointment.service.name)
    const packageInfo = relatedPkg ? {
      packageName: relatedPkg.packageOption.name,
      sessionsUsed: relatedPkg.usedSessions + (usedPackage ? 1 : 0),
      sessionsTotal: relatedPkg.packageOption.sessions,
      sessionsRemaining: relatedPkg.packageOption.sessions - relatedPkg.usedSessions - (usedPackage ? 1 : 0),
    } : null

    // --- Envio automatico de WhatsApp para a profissional ---
    if (!skipWhatsApp) {
      const dt = new Date(scheduledAt)
      const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      try {
        await sendBookingNotification({
          clientName: client?.name || 'Cliente',
          clientPhone: client?.phone || null,
          serviceName: appointment.service.name,
          date: dateStr,
          time: timeStr,
          location: (location || 'CLINIC') === 'HOME_SPA' ? 'Home Spa (domicilio)' : 'Clinica',
          address: address || null,
          type: appointmentType === 'FIRST' ? 'Primeira Consulta' : 'Retorno',
          price,
          packageInfo,
        })
      } catch (whatsErr) {
        console.error('[WhatsApp] Failed to send notification:', whatsErr)
      }
    }

    return NextResponse.json({ appointment, clientName: client?.name, packageInfo }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'CONFLICT') return NextResponse.json({ error: 'Horário indisponível' }, { status: 409 })
    if (error?.message === 'PACKAGE_NOT_FOUND') return NextResponse.json({ error: 'Pacote não encontrado ou inválido' }, { status: 404 })
    if (error?.message === 'PACKAGE_EXHAUSTED') return NextResponse.json({ error: 'Pacote já foi totalmente utilizado' }, { status: 400 })
    console.error('Patient appointment POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { appointmentId, action } = await req.json()
    if (!appointmentId || action !== 'cancel') {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, userId: user.userId },
      include: { service: { select: { name: true, duration: true } } },
    })
    if (!appointment) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    if (['CANCELLED', 'COMPLETED'].includes(appointment.status)) {
      return NextResponse.json({ error: 'Não é possível cancelar este agendamento' }, { status: 400 })
    }

    // Verificar se faltam pelo menos 4h para a sessão
    const hoursUntil = (new Date(appointment.scheduledAt).getTime() - Date.now()) / 3600000
    if (hoursUntil < 4) {
      return NextResponse.json({ error: 'Cancelamento permitido até 4h antes da sessão. Entre em contato pelo WhatsApp.' }, { status: 400 })
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: { service: { select: { name: true, duration: true } } },
    })

    // Devolver crédito do pacote (se a sessão usou um pacote)
    // Buscar pacote ativo do mesmo serviço com usedSessions > 0
    const relatedPackage = await prisma.package.findFirst({
      where: {
        userId: user.userId,
        status: 'ACTIVE',
        usedSessions: { gt: 0 },
        packageOption: { serviceId: appointment.service ? undefined : undefined },
      },
    })
    // Abordagem mais segura: se tiver pacote ativo do serviço, devolver 1 sessão
    const servicePackage = await prisma.package.findFirst({
      where: {
        userId: user.userId,
        status: 'ACTIVE',
        usedSessions: { gt: 0 },
        packageOption: { service: { name: appointment.service.name } },
      },
    })
    if (servicePackage) {
      await prisma.package.update({
        where: { id: servicePackage.id },
        data: { usedSessions: { decrement: 1 } },
      })
    }

    // Enviar WhatsApp de cancelamento
    const client = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true, phone: true } })
    const dt = new Date(appointment.scheduledAt)
    const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    try {
      await sendCancellationNotification({
        clientName: client?.name || 'Cliente',
        clientPhone: client?.phone || null,
        serviceName: appointment.service.name,
        date: dateStr,
        time: timeStr,
      })
    } catch (whatsErr) {
      console.error('[WhatsApp] Failed to send cancellation:', whatsErr)
    }

    return NextResponse.json({ appointment: updated })
  } catch (error) {
    console.error('Patient appointment PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao cancelar' }, { status: 500 })
  }
}
