import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const serviceId = searchParams.get('serviceId')
    const mode = searchParams.get('mode') // 'days' = return availability per day for a range

    // MODE: days — return availability status for a date range
    if (mode === 'days') {
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')
      if (!startDate || !endDate) {
        return NextResponse.json({ error: 'startDate e endDate obrigatórios' }, { status: 400 })
      }

      const schedules = await prisma.schedule.findMany({ where: { active: true } })
      const scheduleMap = new Map(schedules.map(s => [s.dayOfWeek, s]))

      const start = new Date(startDate)
      const end = new Date(endDate)
      const blockedDates = await prisma.blockedDate.findMany({
        where: { date: { gte: new Date(startDate + 'T00:00:00'), lte: new Date(endDate + 'T23:59:59') } },
      })
      const blockedSet = new Set(blockedDates.map(b => b.date.toISOString().split('T')[0]))

      // Get all appointments in range
      const appointments = await prisma.appointment.findMany({
        where: {
          scheduledAt: { gte: new Date(startDate + 'T00:00:00'), lte: new Date(endDate + 'T23:59:59') },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      })

      const now = new Date()
      const days: { date: string; status: 'available' | 'full' | 'closed' | 'past'; availableSlots: number }[] = []
      const cursor = new Date(start)

      while (cursor <= end) {
        const dateStr = cursor.toISOString().split('T')[0]
        const dayOfWeek = cursor.getDay()
        const schedule = scheduleMap.get(dayOfWeek)

        // Past dates
        const isToday = dateStr === now.toISOString().split('T')[0]
        const isPast = cursor < new Date(now.toISOString().split('T')[0] + 'T00:00:00')

        if (isPast) {
          days.push({ date: dateStr, status: 'past', availableSlots: 0 })
          cursor.setDate(cursor.getDate() + 1)
          continue
        }

        if (!schedule || blockedSet.has(dateStr)) {
          days.push({ date: dateStr, status: 'closed', availableSlots: 0 })
          cursor.setDate(cursor.getDate() + 1)
          continue
        }

        // Count available slots for this day
        const [startH, startM] = schedule.startTime.split(':').map(Number)
        const [endH, endM] = schedule.endTime.split(':').map(Number)
        const breakStartTime = schedule.breakStart ? schedule.breakStart.split(':').map(Number) : null
        const breakEndTime = schedule.breakEnd ? schedule.breakEnd.split(':').map(Number) : null
        const slotDuration = schedule.slotDuration || 60

        const dayAppts = appointments.filter(a => {
          const aDate = new Date(a.scheduledAt).toISOString().split('T')[0]
          return aDate === dateStr
        })

        let slotCursor = new Date(dateStr + `T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`)
        const dayEnd = new Date(dateStr + `T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`)
        let availableCount = 0

        while (slotCursor < dayEnd) {
          const slotEnd = new Date(slotCursor.getTime() + slotDuration * 60000)

          if (slotCursor <= now) { slotCursor = slotEnd; continue }
          if (slotEnd > dayEnd) break

          if (breakStartTime && breakEndTime) {
            const bStart = new Date(dateStr + `T${String(breakStartTime[0]).padStart(2, '0')}:${String(breakStartTime[1]).padStart(2, '0')}:00`)
            const bEnd = new Date(dateStr + `T${String(breakEndTime[0]).padStart(2, '0')}:${String(breakEndTime[1]).padStart(2, '0')}:00`)
            if (slotCursor >= bStart && slotCursor < bEnd) { slotCursor = bEnd; continue }
          }

          const hasConflict = dayAppts.some(apt => {
            const aptStart = new Date(apt.scheduledAt)
            const aptEnd = new Date(apt.endAt)
            return slotCursor < aptEnd && slotEnd > aptStart
          })

          if (!hasConflict) availableCount++
          slotCursor = slotEnd
        }

        days.push({
          date: dateStr,
          status: availableCount === 0 ? 'full' : 'available',
          availableSlots: availableCount,
        })

        cursor.setDate(cursor.getDate() + 1)
      }

      return NextResponse.json({ days })
    }

    // MODE: default — return time slots for a specific date
    if (!date || !serviceId) {
      return NextResponse.json({ error: 'date e serviceId obrigatórios' }, { status: 400 })
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } })
    if (!service) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })

    const targetDate = new Date(date)
    const dayOfWeek = targetDate.getDay()

    // Check schedule for this day
    const schedule = await prisma.schedule.findUnique({ where: { dayOfWeek } })
    if (!schedule || !schedule.active) {
      return NextResponse.json({ slots: [], message: 'Dia não disponível' })
    }

    // Check if date is blocked
    const startOfDay = new Date(date + 'T00:00:00')
    const endOfDay = new Date(date + 'T23:59:59')
    const blocked = await prisma.blockedDate.findFirst({
      where: { date: { gte: startOfDay, lte: endOfDay } },
    })
    if (blocked) {
      return NextResponse.json({ slots: [], message: blocked.reason || 'Data bloqueada' })
    }

    // Get existing appointments for this date
    const existing = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    })

    // Generate slots
    const slots: { time: string; available: boolean }[] = []
    const [startH, startM] = schedule.startTime.split(':').map(Number)
    const [endH, endM] = schedule.endTime.split(':').map(Number)
    const breakStartTime = schedule.breakStart ? schedule.breakStart.split(':').map(Number) : null
    const breakEndTime = schedule.breakEnd ? schedule.breakEnd.split(':').map(Number) : null
    const slotDuration = schedule.slotDuration || 60
    const now = new Date()

    let current = new Date(date + `T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`)
    const end = new Date(date + `T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`)

    while (current < end) {
      const slotEnd = new Date(current.getTime() + slotDuration * 60000)
      
      // Skip if in the past
      if (current <= now) {
        current = slotEnd
        continue
      }

      // Skip if during break
      if (breakStartTime && breakEndTime) {
        const breakStart = new Date(date + `T${String(breakStartTime[0]).padStart(2, '0')}:${String(breakStartTime[1]).padStart(2, '0')}:00`)
        const breakEnd = new Date(date + `T${String(breakEndTime[0]).padStart(2, '0')}:${String(breakEndTime[1]).padStart(2, '0')}:00`)
        if (current >= breakStart && current < breakEnd) {
          current = breakEnd
          continue
        }
      }

      // Check for conflicts
      const hasConflict = existing.some(apt => {
        const aptStart = new Date(apt.scheduledAt)
        const aptEnd = new Date(apt.endAt)
        return current < aptEnd && slotEnd > aptStart
      })

      if (slotEnd <= end) {
        slots.push({
          time: current.toTimeString().slice(0, 5),
          available: !hasConflict,
        })
      }

      current = slotEnd
    }

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Availability GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar disponibilidade' }, { status: 500 })
  }
}
