// app/check-in/[id]/page.tsx
// Rota pública para a cliente acompanhar o deslocamento da Mykaele
// URL amigável: /check-in/abc123 → carrega a tracking view com dados do agendamento
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import CheckInClient from './CheckInClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CheckInPage({ params }: Props) {
  const { id } = await params

  // Buscar dados do agendamento (sem autenticação — rota pública)
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      address: true,
      service: { select: { name: true, duration: true } },
      user: { select: { name: true, addressLat: true, addressLng: true } },
    },
  })

  if (!appointment) notFound()

  // Só mostrar rastreamento para agendamentos em deslocamento/confirmados
  const allowedStatuses = ['EN_ROUTE', 'CONFIRMED', 'COMPLETED']
  if (!allowedStatuses.includes(appointment.status)) {
    notFound()
  }

  const destination = appointment.user.addressLat && appointment.user.addressLng
    ? { lat: appointment.user.addressLat, lng: appointment.user.addressLng }
    : null

  return (
    <CheckInClient
      appointmentId={appointment.id}
      clientName={appointment.user.name}
      serviceName={appointment.service.name}
      serviceDuration={appointment.service.duration}
      scheduledAt={appointment.scheduledAt.toISOString()}
      status={appointment.status}
      destination={destination}
    />
  )
}
