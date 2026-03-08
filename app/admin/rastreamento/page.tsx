'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

type GpsState = 'idle' | 'active' | 'arrived'

export default function RastreamentoProfissionalPage() {
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('id') ?? 'demo'
  const clientName = searchParams.get('client') ?? 'Fernanda Oliveira'
  const serviceName = searchParams.get('service') ?? 'Drenagem Linfática · 90 min'

  const [gpsState, setGpsState] = useState<GpsState>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [accuracy, setAccuracy] = useState<number>(0)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [ringOffset, setRingOffset] = useState(439.6) // full circle = not started

  const watchIdRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null)

  // ─── Enviar posição ao servidor ───
  const sendPosition = useCallback(async (lat: number, lng: number, acc: number, speed?: number, heading?: number) => {
    try {
      await fetch('/api/gps/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          lat,
          lng,
          accuracy: acc,
          speed,
          heading,
        }),
      })
    } catch {
      // Retry silencioso — próximo tick tenta de novo
    }
  }, [appointmentId])

  // ─── Iniciar sessão GPS ───
  const startTracking = useCallback(async () => {
    // 1) Iniciar sessão no servidor
    try {
      await fetch('/api/gps/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action: 'start' }),
      })
    } catch { /* continua mesmo offline */ }

    // 2) Solicitar Wake Lock para manter tela ativa
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        setWakeLockActive(true)
        wakeLockRef.current.addEventListener('release', () => setWakeLockActive(false))
      }
    } catch {
      // iOS < 16.4 ou browser sem suporte
    }

    // 3) Iniciar geolocation watchPosition
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy: acc, speed, heading } = position.coords
          setCoords({ lat: latitude, lng: longitude })
          setAccuracy(Math.round(acc))
          lastCoordsRef.current = { lat: latitude, lng: longitude }

          // Enviar posição imediatamente no primeiro fix
          sendPosition(latitude, longitude, acc, speed ?? undefined, heading ?? undefined)
        },
        (error) => {
          console.warn('GPS error:', error.message)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      )

      // 4) Enviar posição a cada 3 segundos (throttle)
      sendIntervalRef.current = setInterval(() => {
        if (lastCoordsRef.current) {
          sendPosition(lastCoordsRef.current.lat, lastCoordsRef.current.lng, accuracy)
        }
      }, 3000)
    }

    setGpsState('active')
    setRingOffset(150) // parcialmente preenchido
  }, [appointmentId, accuracy, sendPosition])

  // ─── Marcar chegada ───
  const markArrived = useCallback(async () => {
    // Notificar servidor
    try {
      await fetch('/api/gps/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action: 'arrived' }),
      })
    } catch { /* ignora */ }

    // Parar GPS
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current)
      sendIntervalRef.current = null
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
    }

    setGpsState('arrived')
    setRingOffset(0) // anel completo
    setWakeLockActive(false)

    // Vibrar
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 300])
    }
  }, [appointmentId])

  // ─── Reset (para novo uso) ───
  const resetTracking = useCallback(async () => {
    try {
      await fetch('/api/gps/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action: 'stop' }),
      })
    } catch { /* ignora */ }

    setGpsState('idle')
    setCoords(null)
    setAccuracy(0)
    setRingOffset(439.6)
  }, [appointmentId])

  // ─── Cleanup ao sair ───
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current)
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
      }
    }
  }, [])

  // ─── Botão principal ───
  function handleMainButton() {
    if (gpsState === 'idle') startTracking()
    else if (gpsState === 'active') markArrived()
    else resetTracking()
  }

  // Config visual por estado
  const btnConfig = {
    idle: {
      label: 'Iniciar Deslocamento',
      bg: 'linear-gradient(135deg, #c9a96e, #b8935a)',
      color: '#2a2420',
      shadow: '0 4px 24px rgba(201,169,110,0.35)',
    },
    active: {
      label: 'Parar Transmissão',
      bg: 'linear-gradient(135deg, #b5637a, #d4849a)',
      color: '#fffdf9',
      shadow: '0 4px 24px rgba(181,99,122,0.35)',
    },
    arrived: {
      label: 'Cheguei ao destino ✓',
      bg: 'linear-gradient(135deg, #4a7c5c, #5cb85c)',
      color: '#fffdf9',
      shadow: '0 4px 24px rgba(92,184,92,0.3)',
    },
  }[gpsState]

  const hintText = {
    idle: 'A cliente será notificada automaticamente',
    active: 'GPS ativo · Não bloqueie a tela',
    arrived: 'Transmissão encerrada',
  }[gpsState]

  const stateEmoji = { idle: '📍', active: '🛣️', arrived: '✓' }[gpsState]
  const stateLabel = { idle: 'Parado', active: 'Transmitindo', arrived: 'Chegou' }[gpsState]

  return (
    <>
      <style>{`
        @keyframes shimmer-pro {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes blink-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center justify-between relative overflow-hidden"
        style={{
          background: '#2a2420',
          fontFamily: "'Jost', sans-serif",
          padding: '80px 24px 48px',
        }}>

        {/* Glow radial de fundo */}
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.06) 0%, transparent 65%)' }} />

        {/* ─── Header: Próximo Atendimento ─── */}
        <div className="text-center w-full relative z-10">
          <div className="mb-9 text-[13px] font-light uppercase tracking-[0.35em]"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: 'rgba(255,253,249,0.35)' }}>
            Myka Home SPA
          </div>

          <div className="rounded-[20px] p-5 text-left"
            style={{
              background: 'rgba(255,253,249,0.04)',
              border: '1px solid rgba(201,169,110,0.15)',
            }}>
            <div className="text-[10px] uppercase tracking-[0.15em] mb-2.5"
              style={{ color: '#c9a96e', opacity: 0.8 }}>
              Próximo atendimento
            </div>
            <div className="text-2xl font-medium mb-1"
              style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fffdf9' }}>
              {clientName}
            </div>
            <div className="text-[13px] mb-3.5" style={{ color: 'rgba(255,253,249,0.5)' }}>
              {serviceName}
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,253,249,0.4)' }}>
                <span className="text-[13px]">🕑</span>
                <span>Hoje, 14h00</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,253,249,0.4)' }}>
                <span className="text-[13px]">📍</span>
                <span>Meireles, CE</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Centro: Ring GPS ─── */}
        <div className="flex flex-col items-center gap-7 w-full relative z-10">

          {/* GPS Ring */}
          <div className="relative w-40 h-40">
            <div className="absolute inset-0 rounded-full"
              style={{ background: 'rgba(255,253,249,0.03)', border: '1px solid rgba(201,169,110,0.1)' }} />

            <svg className="absolute inset-0" viewBox="0 0 144 144"
              style={{ transform: 'rotate(-90deg)', transition: 'all 0.5s' }}>
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d4849a" />
                  <stop offset="100%" stopColor="#c9a96e" />
                </linearGradient>
              </defs>
              <circle cx="72" cy="72" r="70" fill="none" stroke="rgba(201,169,110,0.1)" strokeWidth="2" />
              <circle cx="72" cy="72" r="70" fill="none" stroke="url(#ringGrad)" strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="439.6"
                strokeDashoffset={ringOffset}
                style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>

            <div className="absolute inset-4 rounded-full flex flex-col items-center justify-center gap-1"
              style={{ background: 'rgba(255,253,249,0.04)' }}>
              <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-[22px] transition-all"
                style={{
                  background: 'rgba(201,169,110,0.1)',
                  border: '1px solid rgba(201,169,110,0.15)',
                }}>
                {stateEmoji}
              </div>
              <div className="text-[13px] font-normal"
                style={{ fontFamily: "'Cormorant Garamond', serif", color: 'rgba(255,253,249,0.45)', letterSpacing: '0.05em' }}>
                {stateLabel}
              </div>
            </div>
          </div>

          {/* Location Display */}
          <div className="w-full max-w-[340px] rounded-xl p-3.5 flex items-center gap-3 transition-all duration-400"
            style={{
              background: 'rgba(255,253,249,0.04)',
              border: '1px solid rgba(255,253,249,0.06)',
              opacity: coords ? 1 : 0,
              transform: coords ? 'translateY(0)' : 'translateY(8px)',
            }}>
            <div className="w-2 h-2 rounded-full shrink-0"
              style={{ background: '#c9a96e', animation: 'blink-dot 1.5s ease-in-out infinite' }} />
            <div className="text-xs" style={{ fontFamily: 'monospace', color: 'rgba(255,253,249,0.4)', letterSpacing: '0.02em' }}>
              {coords ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°` : '—'}
            </div>
            <div className="ml-auto text-[10px]" style={{ color: 'rgba(201,169,110,0.5)', letterSpacing: '0.05em' }}>
              {accuracy > 0 ? `±${accuracy}m` : '—'}
            </div>
          </div>

          {/* Wake Lock Banner */}
          {wakeLockActive && gpsState === 'active' && (
            <div className="w-full max-w-[340px] rounded-[10px] p-2.5 px-3.5 flex items-start gap-2"
              style={{ background: 'rgba(201,169,110,0.07)', border: '1px solid rgba(201,169,110,0.15)' }}>
              <span className="text-[13px] shrink-0 mt-0.5">🔆</span>
              <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(201,169,110,0.7)', letterSpacing: '0.02em' }}>
                Mantenha a tela do celular <strong>ligada</strong> durante o deslocamento para garantir o rastreio.
              </span>
            </div>
          )}

          {/* Main GPS Button */}
          <div className="w-full flex flex-col items-center gap-3">
            <button
              onClick={handleMainButton}
              className="w-full max-w-[340px] h-16 rounded-2xl text-sm font-semibold uppercase tracking-[0.12em] cursor-pointer transition-all relative overflow-hidden"
              style={{
                background: btnConfig.bg,
                color: btnConfig.color,
                boxShadow: btnConfig.shadow,
                border: 'none',
                fontFamily: "'Jost', sans-serif",
              }}>
              {btnConfig.label}
              {/* Shimmer effect quando ativo */}
              {gpsState === 'active' && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                    animation: 'shimmer-pro 2.5s ease-in-out infinite',
                  }} />
              )}
            </button>

            <div className="text-[11px] text-center"
              style={{ color: 'rgba(255,253,249,0.28)', letterSpacing: '0.04em' }}>
              {hintText}
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div />
      </div>
    </>
  )
}
