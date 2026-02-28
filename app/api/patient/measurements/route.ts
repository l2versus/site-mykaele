import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

/* ─── GET: All measurements for client + evolution data ─── */
export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const measurements = await prisma.bodyMeasurement.findMany({
      where: { userId: user.userId },
      orderBy: { date: 'asc' },
    })

    if (measurements.length === 0) {
      return NextResponse.json({
        measurements: [],
        latest: null,
        initial: null,
        evolution: null,
        goals: null,
        summary: null,
      })
    }

    const initial = measurements[0]
    const latest = measurements[measurements.length - 1]

    // Calculate evolution (deltas between initial and latest)
    const ZONES = [
      { key: 'weight', label: 'Peso', unit: 'kg' },
      { key: 'bodyFat', label: 'Gordura', unit: '%' },
      { key: 'muscleMass', label: 'Massa Muscular', unit: '%' },
      { key: 'bust', label: 'Busto', unit: 'cm' },
      { key: 'waist', label: 'Cintura', unit: 'cm' },
      { key: 'abdomen', label: 'Abdômen', unit: 'cm' },
      { key: 'hip', label: 'Quadril', unit: 'cm' },
      { key: 'armLeft', label: 'Braço E', unit: 'cm' },
      { key: 'armRight', label: 'Braço D', unit: 'cm' },
      { key: 'thighLeft', label: 'Coxa E', unit: 'cm' },
      { key: 'thighRight', label: 'Coxa D', unit: 'cm' },
      { key: 'calfLeft', label: 'Panturrilha E', unit: 'cm' },
      { key: 'calfRight', label: 'Panturrilha D', unit: 'cm' },
    ] as const

    type MeasKey = typeof ZONES[number]['key']

    const evolution = ZONES.map(z => {
      const k = z.key as MeasKey
      const ini = (initial as Record<string, unknown>)[k] as number | null
      const lat = (latest as Record<string, unknown>)[k] as number | null
      if (ini == null || lat == null) return { ...z, initial: null, latest: null, delta: null, deltaPercent: null }
      const delta = +(lat - ini).toFixed(1)
      const deltaPercent = ini !== 0 ? +((delta / ini) * 100).toFixed(1) : 0
      return { ...z, initial: ini, latest: lat, delta, deltaPercent }
    }).filter(e => e.initial !== null)

    // Goal progress
    const goals = latest.goalWeight || latest.goalWaist || latest.goalHip || latest.goalBodyFat ? {
      weight: latest.goalWeight ? { target: latest.goalWeight, current: latest.weight, initial: initial.weight } : null,
      waist: latest.goalWaist ? { target: latest.goalWaist, current: latest.waist, initial: initial.waist } : null,
      hip: latest.goalHip ? { target: latest.goalHip, current: latest.hip, initial: initial.hip } : null,
      bodyFat: latest.goalBodyFat ? { target: latest.goalBodyFat, current: latest.bodyFat, initial: initial.bodyFat } : null,
    } : null

    // Timeline data for charts (all measurements by date)
    const timeline = measurements.map(m => ({
      date: m.date,
      weight: m.weight,
      bodyFat: m.bodyFat,
      muscleMass: m.muscleMass,
      waist: m.waist,
      abdomen: m.abdomen,
      hip: m.hip,
      bust: m.bust,
      armLeft: m.armLeft,
      armRight: m.armRight,
      thighLeft: m.thighLeft,
      thighRight: m.thighRight,
    }))

    // Summary insights
    const totalLostCm = evolution
      .filter(e => e.unit === 'cm' && e.delta !== null && e.delta < 0)
      .reduce((sum, e) => sum + Math.abs(e.delta!), 0)

    const weightDelta = evolution.find(e => e.key === 'weight')?.delta || 0
    const fatDelta = evolution.find(e => e.key === 'bodyFat')?.delta || 0

    const summary = {
      totalMeasurements: measurements.length,
      daysSinceFirst: Math.floor((new Date().getTime() - new Date(initial.date).getTime()) / 86400000),
      totalLostCm: +totalLostCm.toFixed(1),
      weightChange: weightDelta,
      fatChange: fatDelta,
      bestReduction: evolution
        .filter(e => e.unit === 'cm' && e.delta !== null && e.delta < 0)
        .sort((a, b) => (a.delta || 0) - (b.delta || 0))[0] || null,
    }

    return NextResponse.json({
      measurements: measurements.map(m => ({
        id: m.id,
        date: m.date,
        weight: m.weight,
        height: m.height,
        bodyFat: m.bodyFat,
        muscleMass: m.muscleMass,
        bmi: m.bmi,
        bust: m.bust,
        waist: m.waist,
        abdomen: m.abdomen,
        hip: m.hip,
        armLeft: m.armLeft,
        armRight: m.armRight,
        thighLeft: m.thighLeft,
        thighRight: m.thighRight,
        calfLeft: m.calfLeft,
        calfRight: m.calfRight,
        notes: m.notes,
        measuredBy: m.measuredBy,
      })),
      latest: {
        ...latest,
        bmi: latest.weight && latest.height ? +(latest.weight / ((latest.height / 100) ** 2)).toFixed(1) : null,
      },
      initial,
      evolution,
      goals,
      timeline,
      summary,
    })
  } catch (error) {
    console.error('Measurements error:', error)
    return NextResponse.json({ error: 'Erro ao carregar medidas' }, { status: 500 })
  }
}
