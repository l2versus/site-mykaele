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
    const schedule = await prisma.schedule.findMany({ orderBy: { dayOfWeek: 'asc' } })
    return NextResponse.json({ schedule })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar agenda' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { dayOfWeek, startTime, endTime, breakStart, breakEnd, active, slotDuration } = await req.json()
    if (dayOfWeek === undefined) return NextResponse.json({ error: 'dayOfWeek obrigatório' }, { status: 400 })

    const data = {
      startTime: startTime ?? '08:00',
      endTime: endTime ?? '18:00',
      breakStart: breakStart || null,
      breakEnd: breakEnd || null,
      active: active ?? true,
      slotDuration: slotDuration ?? 60,
    }

    const schedule = await prisma.schedule.upsert({
      where: { dayOfWeek },
      update: data,
      create: { dayOfWeek, ...data },
    })
    return NextResponse.json({ schedule })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar agenda' }, { status: 500 })
  }
}

// ADICIONADO: Função POST para resolver o erro 405 do frontend
export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()

    // Se o frontend estiver enviando os 7 dias de uma vez (Array)
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map(async (item) => {
        const data = {
          startTime: item.startTime ?? '08:00',
          endTime: item.endTime ?? '18:00',
          breakStart: item.breakStart || null,
          breakEnd: item.breakEnd || null,
          active: item.active ?? true,
          slotDuration: item.slotDuration ?? 60,
        }
        return prisma.schedule.upsert({
          where: { dayOfWeek: item.dayOfWeek },
          update: data,
          create: { dayOfWeek: item.dayOfWeek, ...data },
        })
      }))
      return NextResponse.json({ schedule: results })
    }

    // Se o frontend estiver enviando um dia por vez
    const { dayOfWeek, startTime, endTime, breakStart, breakEnd, active, slotDuration } = body
    if (dayOfWeek === undefined) return NextResponse.json({ error: 'dayOfWeek obrigatório' }, { status: 400 })

    const data = {
      startTime: startTime ?? '08:00',
      endTime: endTime ?? '18:00',
      breakStart: breakStart || null,
      breakEnd: breakEnd || null,
      active: active ?? true,
      slotDuration: slotDuration ?? 60,
    }

    const schedule = await prisma.schedule.upsert({
      where: { dayOfWeek },
      update: data,
      create: { dayOfWeek, ...data },
    })
    return NextResponse.json({ schedule })

  } catch (error) {
    console.error("Erro no POST /api/admin/schedule:", error)
    return NextResponse.json({ error: 'Erro ao salvar agenda' }, { status: 500 })
  }
}