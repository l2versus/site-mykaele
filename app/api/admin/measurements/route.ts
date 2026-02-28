import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  if (!user || user.role !== 'ADMIN') return null
  return user
}

/* ─── GET: List all measurements for a specific client ─── */
export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

  const measurements = await prisma.bodyMeasurement.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ measurements })
}

/* ─── POST: Add new measurement for a client ─── */
export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { userId, ...data } = body

    if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

    // Auto-calculate BMI if weight and height provided
    let bmi: number | null = null
    if (data.weight && data.height) {
      bmi = +(data.weight / ((data.height / 100) ** 2)).toFixed(1)
    }

    const measurement = await prisma.bodyMeasurement.create({
      data: {
        userId,
        date: data.date ? new Date(data.date) : new Date(),
        weight: data.weight || null,
        height: data.height || null,
        bodyFat: data.bodyFat || null,
        muscleMass: data.muscleMass || null,
        bmi,
        bust: data.bust || null,
        waist: data.waist || null,
        abdomen: data.abdomen || null,
        hip: data.hip || null,
        armLeft: data.armLeft || null,
        armRight: data.armRight || null,
        thighLeft: data.thighLeft || null,
        thighRight: data.thighRight || null,
        calfLeft: data.calfLeft || null,
        calfRight: data.calfRight || null,
        goalWeight: data.goalWeight || null,
        goalWaist: data.goalWaist || null,
        goalHip: data.goalHip || null,
        goalBodyFat: data.goalBodyFat || null,
        notes: data.notes || null,
        measuredBy: data.measuredBy || 'Mykaele Procópio',
        sessionId: data.sessionId || null,
        photoFront: data.photoFront || null,
        photoSide: data.photoSide || null,
        photoBack: data.photoBack || null,
      },
    })

    return NextResponse.json({ measurement }, { status: 201 })
  } catch (error) {
    console.error('Create measurement error:', error)
    return NextResponse.json({ error: 'Erro ao criar medida' }, { status: 500 })
  }
}

/* ─── DELETE: Remove a measurement ─── */
export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  await prisma.bodyMeasurement.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
