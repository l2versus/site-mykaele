// src/utils/availability.ts
import { prisma } from '@/lib/prisma'
import { addMinutes, isBefore, isAfter } from 'date-fns'

interface TimeSlot {
  start: Date
  end: Date
  available: boolean
}

/**
 * Verifica se um horário está disponível (sem conflito com agendamentos existentes)
 */
export async function checkAvailability(
  startTime: Date,
  duration: number
): Promise<boolean> {
  const endTime = addMinutes(startTime, duration)

  const conflict = await prisma.appointment.findFirst({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      AND: [
        { scheduledAt: { lt: endTime } },
        { endAt: { gt: startTime } },
      ],
    },
  })

  return !conflict
}

/**
 * Gera slots de horários disponíveis para agendamento
 * Usa o modelo Schedule do banco para definir horários de cada dia da semana
 */
export async function getAvailableSlots(
  dateStart: Date,
  daysAhead: number = 7,
  slotDuration?: number
): Promise<TimeSlot[]> {
  const slots: TimeSlot[] = []

  // Buscar configuração de agenda
  const schedules = await prisma.schedule.findMany({
    where: { active: true },
  })

  if (schedules.length === 0) {
    return slots
  }

  // Buscar datas bloqueadas
  const endDate = new Date(dateStart)
  endDate.setDate(endDate.getDate() + daysAhead)

  const blockedDates = await prisma.blockedDate.findMany({
    where: {
      date: { gte: dateStart, lte: endDate },
    },
  })
  const blockedSet = new Set(
    blockedDates.map((b: { date: Date }) => b.date.toISOString().split('T')[0])
  )

  // Mapa de dia da semana → schedule
  const scheduleMap = new Map<number, typeof schedules[0]>()
  for (const s of schedules) {
    scheduleMap.set(s.dayOfWeek, s)
  }

  // Gerar slots para os próximos dias
  const currentDate = new Date(dateStart)
  currentDate.setHours(0, 0, 0, 0)

  for (let day = 0; day < daysAhead; day++) {
    const dayOfWeek = currentDate.getDay()
    const schedule = scheduleMap.get(dayOfWeek)

    if (!schedule) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    // Verificar data bloqueada
    const dateStr = currentDate.toISOString().split('T')[0]
    if (blockedSet.has(dateStr)) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    const duration = slotDuration ?? schedule.slotDuration

    // Montar horário de início e fim do dia
    const [startH, startM] = schedule.startTime.split(':').map(Number)
    const [endH, endM] = schedule.endTime.split(':').map(Number)

    const slotStart = new Date(currentDate)
    slotStart.setHours(startH, startM, 0, 0)

    const dayEnd = new Date(currentDate)
    dayEnd.setHours(endH, endM, 0, 0)

    // Intervalo (break)
    let breakStart: Date | null = null
    let breakEnd: Date | null = null
    if (schedule.breakStart && schedule.breakEnd) {
      const [bsH, bsM] = schedule.breakStart.split(':').map(Number)
      const [beH, beM] = schedule.breakEnd.split(':').map(Number)
      breakStart = new Date(currentDate)
      breakStart.setHours(bsH, bsM, 0, 0)
      breakEnd = new Date(currentDate)
      breakEnd.setHours(beH, beM, 0, 0)
    }

    let cursor = new Date(slotStart)

    while (isBefore(cursor, dayEnd)) {
      const slotEnd = addMinutes(cursor, duration)
      if (isAfter(slotEnd, dayEnd)) break

      // Pular slots no intervalo
      if (breakStart && breakEnd) {
        if (isBefore(cursor, breakEnd) && isAfter(slotEnd, breakStart)) {
          cursor = new Date(breakEnd)
          continue
        }
      }

      const available = await checkAvailability(cursor, duration)

      slots.push({
        start: new Date(cursor),
        end: new Date(slotEnd),
        available,
      })

      cursor = new Date(slotEnd)
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return slots
}
