'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import type L from 'leaflet'

// ─── Tipos ───
type GpsPosition = {
  lat: number; lng: number; accuracy: number; timestamp: number; heading?: number; speed?: number
}
type TrackingStatus = 'waiting' | 'active' | 'arrived' | 'stopped'

// ─── Alerta Sonoro com Web Audio API ───
function playArrivalChime(ctx: AudioContext) {
  try {
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const chimeSets = [
      { freq: 1568, start: 0, dur: 1.2, vol: 0.18, type: 'sine' as OscillatorType },
      { freq: 2349, start: 0, dur: 0.8, vol: 0.06, type: 'sine' as OscillatorType },
      { freq: 3136, start: 0, dur: 0.5, vol: 0.03, type: 'sine' as OscillatorType },
      { freq: 1318.5, start: 0.6, dur: 1.6, vol: 0.18, type: 'sine' as OscillatorType },
      { freq: 1975.5, start: 0.6, dur: 1.0, vol: 0.06, type: 'sine' as OscillatorType },
      { freq: 2637, start: 0.6, dur: 0.7, vol: 0.03, type: 'sine' as OscillatorType },
    ]
    chimeSets.forEach(({ freq, start, dur, vol, type }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, now + start)
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur + 0.05)
    })
  } catch { /* Silencioso */ }
}

// ─── Haversine ───
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (n: number) => (n * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

interface Props {
  appointmentId: string
  clientName: string
  serviceName: string
  serviceDuration: number
  scheduledAt: string
  status: string
  destination: { lat: number; lng: number } | null
}

export default function CheckInClient({
  appointmentId,
  clientName,
  serviceName,
  scheduledAt,
  status: initialStatus,
  destination: destProp,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>(
    initialStatus === 'EN_ROUTE' ? 'active' : 'waiting'
  )
  const [lastPosition, setLastPosition] = useState<GpsPosition | null>(null)
  const [eta, setEta] = useState<string>('—')
  const [progress, setProgress] = useState(0)
  const [showArrivalModal, setShowArrivalModal] = useState(false)
  const [positions, setPositions] = useState<GpsPosition[]>([])
  const [showOverlay, setShowOverlay] = useState(true)

  const destinationRef = useRef<{ lat: number; lng: number }>(
    destProp ?? { lat: -3.7937, lng: -38.4784 }
  )

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  // ─── Desbloquear Áudio (iOS/Android) ───
  const unlockAudio = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
      audioCtxRef.current = ctx
    } catch { /* ok */ }
    setShowOverlay(false)
  }, [])

  // ─── Trigger Chegada ───
  const triggerArrival = useCallback(() => {
    setTrackingStatus('arrived')
    setShowArrivalModal(true)
    if (audioCtxRef.current) playArrivalChime(audioCtxRef.current)
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400])
  }, [])

  // ─── Calcular ETA ───
  const calcEta = useCallback((pos: GpsPosition) => {
    const dest = destinationRef.current
    const distKm = haversineKm(pos, dest) * 1.3
    if (distKm < 0.05) { triggerArrival(); return }
    const speedKmH = pos.speed && pos.speed > 0.5 ? pos.speed * 3.6 : 25
    const etaMin = Math.max(1, Math.round((distKm / speedKmH) * 60))
    setEta(etaMin <= 1 ? '< 1 min' : `≈ ${etaMin} min`)
    setProgress(Math.min(95, Math.max(5, (1 - distKm / 15) * 100)))
  }, [triggerArrival])

  // ─── Inicializar Leaflet ───
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    let mounted = true
    import('leaflet').then((LeafletModule) => {
      if (!mounted || !mapContainerRef.current) return
      const Leaflet = LeafletModule.default
      delete (Leaflet.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      Leaflet.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' })

      const dest = destinationRef.current
      const map = Leaflet.map(mapContainerRef.current!, {
        center: [dest.lat, dest.lng], zoom: 14, zoomControl: false, attributionControl: true,
      })
      Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      Leaflet.control.zoom({ position: 'bottomright' }).addTo(map)

      const destIcon = Leaflet.divIcon({
        html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#c9a96e,#b8935a);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(201,169,110,0.5);border:3px solid #fff;">🏠</div>`,
        className: '', iconSize: [40, 40], iconAnchor: [20, 20],
      })
      Leaflet.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(map)
      destMarkerRef.current = Leaflet.marker([dest.lat, dest.lng], { icon: destIcon })

      const profIcon = Leaflet.divIcon({
        html: `<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#b76e79,#d4a0a7);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;color:#fff;box-shadow:0 4px 20px rgba(183,110,121,0.5);border:3px solid #fff;font-family:serif;">M</div>`,
        className: '', iconSize: [44, 44], iconAnchor: [22, 22],
      })
      const marker = Leaflet.marker([dest.lat - 0.01, dest.lng - 0.01], { icon: profIcon }).addTo(map)
      markerRef.current = marker

      routeLineRef.current = Leaflet.polyline([], {
        color: '#b76e79', weight: 4, opacity: 0.6, dashArray: '8, 12',
      }).addTo(map)

      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 200)
    })
    return () => { mounted = false }
  }, [])

  // ─── SSE Connection ───
  useEffect(() => {
    const es = new EventSource(`/api/gps/stream?appointmentId=${appointmentId}`)
    eventSourceRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'init' && msg.data?.lastPosition) {
          const pos = msg.data.lastPosition as GpsPosition
          setLastPosition(pos)
          setTrackingStatus(msg.data.status === 'arrived' ? 'arrived' : 'active')
          markerRef.current?.setLatLng([pos.lat, pos.lng])
          mapRef.current?.setView([pos.lat, pos.lng], 15)
          calcEta(pos)
        } else if (msg.type === 'position') {
          const pos = msg.data as GpsPosition
          setLastPosition(pos)
          setTrackingStatus('active')
          setPositions(prev => [...prev.slice(-100), pos])
          markerRef.current?.setLatLng([pos.lat, pos.lng])
          routeLineRef.current?.addLatLng([pos.lat, pos.lng])
          mapRef.current?.panTo([pos.lat, pos.lng], { animate: true, duration: 1 })
          calcEta(pos)
        } else if (msg.type === 'arrived') {
          triggerArrival()
        } else if (msg.type === 'stopped') {
          setTrackingStatus('stopped')
        }
      } catch { /* ignore */ }
    }

    return () => { es.close() }
  }, [appointmentId, calcEta, triggerArrival])

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      mapRef.current?.remove()
    }
  }, [])

  const firstName = clientName.split(' ')[0]

  return (
    <>
      <style>{`
        @keyframes overlay-fadeOut { to { opacity: 0; pointer-events: none; } }
        @keyframes overlay-btn-glow { 0%,100%{box-shadow:0 0 20px rgba(201,169,110,0.3)} 50%{box-shadow:0 0 40px rgba(201,169,110,0.6)} }
        @keyframes sparkle { 0%,100%{opacity:0;transform:rotate(var(--r,0deg)) translateY(-48px) scale(0)} 50%{opacity:1;transform:rotate(var(--r,0deg)) translateY(-48px) scale(1)} }
        @keyframes confetti-fall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(120px) rotate(720deg);opacity:0} }
        @keyframes pulse-ring-arrival { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(1.5);opacity:0} }
        @keyframes float-in { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div className="min-h-screen flex flex-col" style={{ background: '#faf8f5' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #2a2420, #3d342e)', color: '#e8dfd6' }}>
          <div>
            <h1 className="text-base font-semibold" style={{ fontFamily: "'Jost', sans-serif" }}>
              ✦ Mykaele está a caminho
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#b8a99e' }}>
              {serviceName} · {fmtTime(scheduledAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: '#b8a99e' }}>Olá, {firstName} 💛</p>
            <p className="text-lg font-bold" style={{ color: '#c9a96e' }}>{eta}</p>
          </div>
        </div>

        {/* Status bar */}
        {trackingStatus === 'active' && (
          <div className="px-5 py-3 flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #c9a96e15, #b76e7915)' }}>
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse" />
              <span className="absolute w-5 h-5 rounded-full bg-rose-400/20 animate-ping" />
            </div>
            <div className="flex-1">
              <div className="h-1.5 rounded-full" style={{ background: '#e8dfd6' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #b76e79, #c9a96e)' }} />
              </div>
            </div>
            <span className="text-xs font-semibold" style={{ color: '#8a7a6e' }}>{Math.round(progress)}%</span>
          </div>
        )}

        {trackingStatus === 'waiting' && (
          <div className="px-5 py-4 text-center" style={{ background: '#f5f0eb' }}>
            <p className="text-sm" style={{ color: '#8a7a6e' }}>
              ⏳ Aguardando Mykaele iniciar o deslocamento...
            </p>
          </div>
        )}

        {trackingStatus === 'arrived' && !showArrivalModal && (
          <div className="px-5 py-3 text-center" style={{ background: 'linear-gradient(90deg, #c9a96e20, #c9a96e10)' }}>
            <p className="text-sm font-semibold" style={{ color: '#8a6e3e' }}>
              ✦ Mykaele chegou! Prepare-se para sua sessão.
            </p>
          </div>
        )}

        {/* Mapa */}
        <div className="flex-1 relative" style={{ minHeight: '60vh' }}>
          <div ref={mapContainerRef} className="absolute inset-0" />
        </div>

        {/* Info rodapé */}
        {lastPosition && (
          <div className="px-5 py-3 flex items-center justify-between text-xs"
            style={{ background: '#fff', borderTop: '1px solid #e8dfd6', color: '#8a7a6e' }}>
            <span>{positions.length} posições recebidas</span>
            <span>Atualizado {new Date(lastPosition.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}

        {/* Overlay de desbloqueio de áudio */}
        {showOverlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg, #2a2420f0, #3d342ef0)', backdropFilter: 'blur(20px)' }}>
            <div className="text-center px-8 max-w-sm" style={{ animation: 'float-in 0.6s ease-out' }}>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #c9a96e, #b8935a)', boxShadow: '0 8px 32px rgba(201,169,110,0.4)' }}>
                <span className="text-3xl">📍</span>
              </div>
              <h2 className="text-xl font-medium mb-2" style={{ color: '#e8dfd6', fontFamily: "'Cormorant Garamond', serif" }}>
                Olá, {firstName}!
              </h2>
              <p className="text-sm mb-6" style={{ color: '#b8a99e' }}>
                Acompanhe o deslocamento da Mykaele até você em tempo real.
              </p>
              <button onClick={unlockAudio}
                className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-wider transition-all"
                style={{
                  background: 'linear-gradient(135deg, #c9a96e, #b8935a)',
                  color: '#2a2420', border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(201,169,110,0.4)',
                  animation: 'overlay-btn-glow 2.5s ease-in-out infinite',
                }}>
                Acompanhar Deslocamento
              </button>
            </div>
          </div>
        )}

        {/* Modal de Chegada */}
        {showArrivalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(42,36,32,0.85)', backdropFilter: 'blur(16px)' }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="absolute w-2 h-2 rounded-full"
                style={{
                  background: i % 2 === 0 ? '#c9a96e' : '#b76e79',
                  left: `${10 + Math.random() * 80}%`, top: `${5 + Math.random() * 30}%`,
                  animation: `confetti-fall ${2 + Math.random() * 2}s ease-in ${Math.random() * 1.5}s infinite`,
                }} />
            ))}
            <div className="bg-white rounded-3xl p-8 max-w-xs w-full mx-6 text-center relative"
              style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.3)', animation: 'float-in 0.5s ease-out' }}>
              <div className="relative w-24 h-24 mx-auto mb-5">
                <div className="w-full h-full rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #c9a96e22, #c9a96e44)' }}>
                  <span className="text-5xl">✦</span>
                </div>
                {Array.from({ length: 6 }).map((_, i) => {
                  const deg = i * 60
                  return (
                    <div key={i} className="absolute w-1.5 h-1.5 rounded-full"
                      style={{ background: '#c9a96e', top: '50%', left: '50%',
                        transform: `rotate(${deg}deg) translateY(-48px)`,
                        animation: `sparkle 1.8s ease-in-out ${i * 0.3}s infinite`,
                      }} />
                  )
                })}
                <div className="absolute -inset-4 rounded-full border-2"
                  style={{ borderColor: 'rgba(201,169,110,0.3)', animation: 'pulse-ring-arrival 2s ease-out infinite' }} />
              </div>
              <h2 className="text-2xl font-medium mb-2"
                style={{ fontFamily: "'Cormorant Garamond', serif", color: '#2a2420' }}>
                Mykaele chegou!
              </h2>
              <p className="text-sm mb-2" style={{ color: '#4a3f38', fontWeight: 500 }}>
                Sua profissional está no seu endereço.
              </p>
              <p className="text-sm mb-7" style={{ color: '#9a8a7e', lineHeight: '1.6' }}>
                Prepare-se para uma sessão incrível. ✦
              </p>
              <button onClick={() => setShowArrivalModal(false)}
                className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #c9a96e, #b8935a)',
                  color: '#2a2420', border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(201,169,110,0.35)',
                }}>
                Entendi, obrigada!
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
