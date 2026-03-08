// app/api/gps/position/route.ts
// POST: Profissional envia posição GPS
// GET: Retorna última posição (polling fallback)

import { NextRequest, NextResponse } from 'next/server'
import { updatePosition, getSession, startSession, setArrived, stopSession } from '../store'

// POST /api/gps/position — Atualizar posição GPS
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { appointmentId, action, lat, lng, accuracy, heading, speed, destination } = body

    if (!appointmentId || typeof appointmentId !== 'string') {
      return NextResponse.json({ error: 'appointmentId é obrigatório' }, { status: 400 })
    }

    // Ações: start, update, arrived, stop
    if (action === 'start') {
      const session = startSession(
        appointmentId,
        'professional', // Em produção, extrair do JWT
        destination ? { lat: Number(destination.lat), lng: Number(destination.lng) } : undefined
      )
      return NextResponse.json({ ok: true, session: { status: session.status, startedAt: session.startedAt } })
    }

    if (action === 'arrived') {
      const ok = setArrived(appointmentId)
      if (!ok) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'stop') {
      const ok = stopSession(appointmentId)
      if (!ok) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
      return NextResponse.json({ ok: true })
    }

    // Default: update position
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat e lng são obrigatórios' }, { status: 400 })
    }

    const ok = updatePosition(appointmentId, {
      lat,
      lng,
      accuracy: accuracy ?? 10,
      timestamp: Date.now(),
      heading: heading ?? undefined,
      speed: speed ?? undefined,
    })

    if (!ok) {
      return NextResponse.json({ error: 'Sessão não ativa' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET /api/gps/position?appointmentId=xxx — Polling fallback
export async function GET(req: NextRequest) {
  const appointmentId = req.nextUrl.searchParams.get('appointmentId')
  if (!appointmentId) {
    return NextResponse.json({ error: 'appointmentId é obrigatório' }, { status: 400 })
  }

  const session = getSession(appointmentId)
  if (!session) {
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    status: session.status,
    lastPosition: session.lastPosition,
    startedAt: session.startedAt,
    positionCount: session.positions.length,
    destination: session.destination,
  })
}
