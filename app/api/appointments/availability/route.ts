// app/api/appointments/availability/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/utils/availability'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const dateStart = searchParams.get('dateStart')
    const daysAhead = parseInt(searchParams.get('daysAhead') || '7')
    const slotDuration = searchParams.get('slotDuration')
      ? parseInt(searchParams.get('slotDuration')!)
      : undefined

    if (!dateStart) {
      return NextResponse.json(
        { error: 'Parâmetro dateStart é obrigatório' },
        { status: 400 }
      )
    }

    const startDate = new Date(dateStart)
    const slots = await getAvailableSlots(startDate, daysAhead, slotDuration)

    return NextResponse.json(
      {
        message: 'Slots de disponibilidade obtidos',
        data: { daysAhead, slots },
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('Erro ao buscar disponibilidade:', error)
    const message = error instanceof Error ? error.message : 'Erro ao buscar disponibilidade'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
