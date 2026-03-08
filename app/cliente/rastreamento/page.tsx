'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import 'leaflet/dist/leaflet.css'
import type L from 'leaflet'

// ─── Tipos ───
type GpsPosition = {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
  heading?: number
  speed?: number
}

type TrackingStatus = 'waiting' | 'active' | 'arrived' | 'stopped'

// ─── Alerta Sonoro com Web Audio API (reutiliza ctx pré-destravado) ───
function playArrivalChime(ctx: AudioContext) {
  try {
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime

    // "Ding" duplo de hotel de luxo — sino cristalino com harmônicos
    const chimeSets = [
      // Primeiro ding (nota alta, brilhante)
      { freq: 1568, start: 0, dur: 1.2, vol: 0.18, type: 'sine' as OscillatorType },
      { freq: 2349, start: 0, dur: 0.8, vol: 0.06, type: 'sine' as OscillatorType },     // harmônico
      { freq: 3136, start: 0, dur: 0.5, vol: 0.03, type: 'sine' as OscillatorType },     // overtone
      // Segundo ding (terça menor abaixo — resolve elegante)
      { freq: 1318.5, start: 0.6, dur: 1.6, vol: 0.18, type: 'sine' as OscillatorType },
      { freq: 1975.5, start: 0.6, dur: 1.0, vol: 0.06, type: 'sine' as OscillatorType }, // harmônico
      { freq: 2637,   start: 0.6, dur: 0.7, vol: 0.03, type: 'sine' as OscillatorType }, // overtone
    ]

    chimeSets.forEach(({ freq, start, dur, vol, type }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = type
      osc.frequency.setValueAtTime(freq, now + start)

      // Attack rápido + decay longo (sino real)
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur + 0.05)
    })
  } catch {
    // Silencioso se Web Audio falhar
  }
}

// ─── Componente Principal ───
export default function RastreamentoPage() {
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('id') ?? 'demo'

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const [status, setStatus] = useState<TrackingStatus>('waiting')
  const [lastPosition, setLastPosition] = useState<GpsPosition | null>(null)
  const [eta, setEta] = useState<string>('—')
  const [progress, setProgress] = useState(0)
  const [showArrivalModal, setShowArrivalModal] = useState(false)
  const [positions, setPositions] = useState<GpsPosition[]>([])
  const [showOverlay, setShowOverlay] = useState(true)

  // Destino padrão (Sapiranga, Fortaleza — endereço base Mykaele)
  const destinationRef = useRef<{ lat: number; lng: number }>({
    lat: Number(searchParams.get('dlat') ?? -3.7937),
    lng: Number(searchParams.get('dlng') ?? -38.4784),
  })

  // ─── Inicializar Leaflet ───
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let mounted = true

    // Import dinâmico para evitar SSR
    import('leaflet').then((LeafletModule) => {
      if (!mounted || !mapContainerRef.current) return

      const Leaflet = LeafletModule.default

      // Fix ícones padrão do Leaflet no Next.js (webpack)
      // Usamos divIcon customizado, mas prevenimos o erro de paths
      delete (Leaflet.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      Leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: '',
        iconUrl: '',
        shadowUrl: '',
      })

      const dest = destinationRef.current
      const map = Leaflet.map(mapContainerRef.current!, {
        center: [dest.lat, dest.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      })

      // Tile layer OpenStreetMap
      Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        crossOrigin: 'anonymous',
      }).addTo(map)

      // Controle de zoom no canto inferior direito
      Leaflet.control.zoom({ position: 'bottomright' }).addTo(map)

      // Marcador do destino (casa da cliente)
      const destIcon = Leaflet.divIcon({
        html: `<div style="
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #c9a96e, #b8935a);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; box-shadow: 0 4px 16px rgba(201,169,110,0.5);
          border: 3px solid #fff;
        ">🏠</div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })
      destMarkerRef.current = Leaflet.marker([dest.lat, dest.lng], { icon: destIcon })
        .addTo(map)
        .bindPopup('📍 Destino do atendimento')

      // Polyline da rota (será atualizada com posições reais)
      routeLineRef.current = Leaflet.polyline([], {
        color: '#d4849a',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 8',
        lineCap: 'round',
      }).addTo(map)

      mapRef.current = map

      // Redimensionar quando layout muda
      setTimeout(() => map.invalidateSize(), 300)
    })

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Atualizar marcador da profissional no mapa ───
  const updateMapMarker = useCallback((pos: GpsPosition) => {
    if (!mapRef.current) return

    import('leaflet').then((LeafletModule) => {
      const Leaflet = LeafletModule.default

      const proIcon = Leaflet.divIcon({
        html: `<div style="
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, #f0d4dc, #d4849a);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 700; color: #b5637a;
          box-shadow: 0 4px 20px rgba(212,132,154,0.5);
          border: 3px solid #fff;
          font-family: 'Cormorant Garamond', serif;
          animation: pulse-marker 2s ease-in-out infinite;
        ">M</div>`,
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      })

      if (markerRef.current) {
        markerRef.current.setLatLng([pos.lat, pos.lng])
      } else {
        markerRef.current = Leaflet.marker([pos.lat, pos.lng], { icon: proIcon })
          .addTo(mapRef.current!)
          .bindPopup('✦ Mykaele · A caminho')
      }

      // Atualizar polyline com rota percorrida
      if (routeLineRef.current) {
        const latLngs = positions.concat(pos).map(p => Leaflet.latLng(p.lat, p.lng))
        routeLineRef.current.setLatLngs(latLngs)
      }

      // Ajustar vista do mapa para mostrar profissional e destino
      const dest = destinationRef.current
      const bounds = Leaflet.latLngBounds(
        [pos.lat, pos.lng],
        [dest.lat, dest.lng]
      )
      mapRef.current?.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 })
    })
  }, [positions])

  // ─── Calcular ETA simplificado ───
  const calculateEta = useCallback((pos: GpsPosition) => {
    const dest = destinationRef.current
    const R = 6371
    const dLat = (dest.lat - pos.lat) * Math.PI / 180
    const dLon = (dest.lng - pos.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(pos.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distKm = R * c * 1.3 // fator de correção para ruas

    // Velocidade média urbana: 25 km/h
    const speed = pos.speed && pos.speed > 0 ? pos.speed * 3.6 : 25
    const minutes = Math.round((distKm / speed) * 60)

    if (minutes <= 1) {
      setEta('< 1 min')
      setProgress(98)
    } else {
      setEta(`≈ ${minutes} min`)
      // Progresso baseado na distância (máx ~10km como 100%)
      setProgress(Math.min(95, Math.round((1 - distKm / 10) * 100)))
    }
  }, [])

  // ─── Destravar AudioContext (chamado pelo overlay) ───
  const unlockAudio = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      // Tocar silêncio para destravar no iOS/Android
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
      audioCtxRef.current = ctx
    } catch {
      // Browser sem Web Audio — seguimos sem som
    }
    setShowOverlay(false)
  }, [])

  // ─── Disparar alerta de chegada ───
  const triggerArrival = useCallback(() => {
    setStatus('arrived')
    setProgress(100)
    setEta('Chegou!')
    setShowArrivalModal(true)

    // Tocar chime se AudioContext disponível
    if (audioCtxRef.current) {
      playArrivalChime(audioCtxRef.current)
    }

    // Vibrar se disponível
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400])
    }
  }, [])

  // ─── Conectar ao SSE ───
  useEffect(() => {
    if (appointmentId === 'demo') return // Modo demo não conecta

    const es = new EventSource(`/api/gps/stream?appointmentId=${encodeURIComponent(appointmentId)}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'init' || msg.type === 'position') {
          const pos: GpsPosition = msg.type === 'init' ? msg.data.lastPosition : msg.data
          if (!pos) return

          setLastPosition(pos)
          setPositions(prev => [...prev.slice(-100), pos])
          setStatus('active')
          updateMapMarker(pos)
          calculateEta(pos)
        }

        if (msg.type === 'arrived') {
          triggerArrival()
        }

        if (msg.type === 'stopped') {
          setStatus('stopped')
        }
      } catch {
        // Ignorar mensagens malformadas
      }
    }

    es.onerror = () => {
      // SSE reconecta automaticamente
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [appointmentId, updateMapMarker, calculateEta, triggerArrival])

  // ─── Modo Demo (simulação local) ───
  useEffect(() => {
    if (appointmentId !== 'demo') return

    setStatus('active')
    const dest = destinationRef.current

    // Rota simulada: ponto de partida ~3km ao sul do destino
    const startLat = dest.lat - 0.025
    const startLng = dest.lng - 0.015
    let step = 0
    const totalSteps = 120

    const interval = setInterval(() => {
      step++
      if (step >= totalSteps) {
        clearInterval(interval)
        triggerArrival()
        return
      }

      const t = step / totalSteps
      // Curva suave (cubic ease-out)
      const ease = 1 - Math.pow(1 - t, 3)

      const pos: GpsPosition = {
        lat: startLat + (dest.lat - startLat) * ease + (Math.random() - 0.5) * 0.0002,
        lng: startLng + (dest.lng - startLng) * ease + (Math.random() - 0.5) * 0.0003,
        accuracy: 5 + Math.random() * 10,
        timestamp: Date.now(),
        speed: 6 + Math.random() * 4,
      }

      setLastPosition(pos)
      setPositions(prev => [...prev.slice(-100), pos])
      updateMapMarker(pos)
      calculateEta(pos)
    }, 2000)

    return () => clearInterval(interval)
  }, [appointmentId, updateMapMarker, calculateEta, triggerArrival])

  // ─── Steps do progresso ───
  const steps = [
    { label: 'Confirmou', done: status !== 'waiting', active: false },
    { label: 'Saiu', done: status === 'active' || status === 'arrived', active: false },
    { label: 'A caminho', done: status === 'arrived', active: status === 'active' },
    { label: 'Chegou', done: status === 'arrived', active: false },
  ]

  return (
    <>
      <style>{`
        /* Leaflet tile fix — override Tailwind v4 preflight */
        .leaflet-container img,
        .leaflet-tile-pane img,
        .leaflet-tile {
          max-width: none !important;
          max-height: none !important;
          width: 256px !important;
          height: 256px !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
        }
        .leaflet-container img {
          width: auto !important;
          height: auto !important;
        }
        .leaflet-control-container img,
        .leaflet-marker-pane img {
          width: auto !important;
          height: auto !important;
        }
        .leaflet-container {
          z-index: 0;
          background: #e8e4df !important;
        }
        @keyframes pulse-marker {
          0%, 100% { box-shadow: 0 4px 20px rgba(212,132,154,0.5); }
          50% { box-shadow: 0 4px 30px rgba(212,132,154,0.8); }
        }
        @keyframes arrival-glow {
          0% { box-shadow: 0 0 0 0 rgba(201,169,110,0.6); }
          70% { box-shadow: 0 0 0 20px rgba(201,169,110,0); }
          100% { box-shadow: 0 0 0 0 rgba(201,169,110,0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring-arrival {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes overlay-fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes overlay-btn-glow {
          0%, 100% { box-shadow: 0 4px 24px rgba(201,169,110,0.35); }
          50% { box-shadow: 0 8px 40px rgba(201,169,110,0.55); }
        }
        @keyframes sparkle {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1) rotate(180deg); opacity: 1; }
          100% { transform: scale(0) rotate(360deg); opacity: 0; }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(60px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      <div className="fixed inset-0 flex flex-col" style={{ background: '#faf6f1', fontFamily: "'Jost', sans-serif" }}>

        {/* ─── Mapa Leaflet ─── */}
        <div
          ref={mapContainerRef}
          className="absolute inset-0 z-0"
          style={{ minHeight: '100vh' }}
        />

        {/* Gradientes sobre o mapa */}
        <div className="fixed top-0 left-0 right-0 h-[220px] z-10 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, #faf6f1 0%, rgba(250,246,241,0.6) 60%, transparent 100%)' }} />
        <div className="fixed bottom-0 left-0 right-0 h-[340px] z-10 pointer-events-none"
          style={{ background: 'linear-gradient(0deg, #faf6f1 0%, rgba(250,246,241,0.85) 50%, transparent 100%)' }} />

        {/* ─── Status Bar (topo) ─── */}
        <div className="fixed top-0 left-0 right-0 z-[100] pt-[60px]">
          <div className="mx-5 rounded-2xl p-4 flex items-center gap-3.5"
            style={{
              background: 'rgba(255,253,249,0.95)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 4px 24px rgba(42,36,32,0.12)',
              border: '1px solid rgba(201,169,110,0.2)',
            }}>
            {/* Pulse dot */}
            <div className="relative w-2.5 h-2.5 shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ background: status === 'arrived' ? '#5cb85c' : '#d4849a' }} />
              {status === 'active' && (
                <div className="absolute -inset-[5px] rounded-full animate-ping" style={{ background: '#d4849a', opacity: 0.4 }} />
              )}
            </div>

            <div className="flex-1">
              <div className="text-[17px] font-medium" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#2a2420' }}>
                {status === 'waiting' && 'Aguardando Mykaele...'}
                {status === 'active' && 'Mykaele está a caminho'}
                {status === 'arrived' && '✦ Mykaele chegou!'}
                {status === 'stopped' && 'Rastreamento encerrado'}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#9a8a7e', letterSpacing: '0.03em' }}>
                {lastPosition
                  ? `Atualizado ${new Date(lastPosition.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Aguardando sinal GPS'}
              </div>
            </div>

            <div className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{
                background: status === 'arrived' ? '#5cb85c' : '#c9a96e',
                color: status === 'arrived' ? '#fff' : '#2a2420',
                letterSpacing: '0.06em',
              }}>
              {eta}
            </div>
          </div>
        </div>

        {/* ─── Bottom Card ─── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 px-5 pb-10">
          <div className="rounded-t-3xl rounded-b-xl overflow-hidden"
            style={{
              background: '#fffdf9',
              boxShadow: '0 -4px 40px rgba(42,36,32,0.12), 0 0 0 1px rgba(201,169,110,0.15)',
            }}>

            {/* Drag handle */}
            <div className="flex justify-center pt-2.5">
              <div className="w-9 h-[3px] rounded-full" style={{ background: '#e8ddd1' }} />
            </div>

            <div className="px-5 pt-4 pb-5">
              {/* Pro Info */}
              <div className="flex items-center gap-3.5 mb-4">
                <div className="relative shrink-0">
                  <div className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-xl font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, #f0d4dc, #f3ece3)',
                      fontFamily: "'Cormorant Garamond', serif",
                      color: '#b5637a',
                      border: '2px solid #fffdf9',
                      boxShadow: '0 2px 12px rgba(212,132,154,0.25)',
                    }}>
                    M
                  </div>
                  <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2"
                    style={{ background: '#5cb85c', borderColor: '#fffdf9' }} />
                </div>

                <div className="flex-1">
                  <div className="text-[19px] font-semibold leading-tight"
                    style={{ fontFamily: "'Cormorant Garamond', serif", color: '#2a2420' }}>
                    Mykaele Santos
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#9a8a7e', letterSpacing: '0.04em' }}>
                    Esteticista · Myka Home SPA
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[11px]" style={{ color: '#c9a96e', letterSpacing: '1px' }}>★★★★★</span>
                    <span className="text-xs font-semibold" style={{ color: '#2a2420' }}>5.0</span>
                  </div>
                </div>

                <a href="https://wa.me/5585999999999" target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] transition-colors shrink-0"
                  style={{ background: '#f3ece3', border: '1px solid #e8ddd1' }}>
                  💬
                </a>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs" style={{ color: '#9a8a7e', letterSpacing: '0.04em' }}>
                    Progresso do deslocamento
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#b8935a' }}>
                    {Math.max(0, progress)}%
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: '#f3ece3' }}>
                  <div className="h-full rounded-full transition-all duration-[3s] ease-out"
                    style={{
                      width: `${Math.max(0, progress)}%`,
                      background: 'linear-gradient(90deg, #f0d4dc, #c9a96e)',
                    }} />
                </div>
              </div>

              {/* Steps */}
              <div className="flex items-center justify-between px-1">
                {steps.map((step, i) => (
                  <div key={step.label} className="contents">
                    <div className="flex flex-col items-center gap-1.5" style={{ flex: '0 0 auto' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all"
                        style={{
                          background: step.done ? '#c9a96e' : step.active ? '#d4849a' : '#f3ece3',
                          color: step.done || step.active ? '#fffdf9' : '#9a8a7e',
                          boxShadow: step.done
                            ? '0 2px 8px rgba(201,169,110,0.4)'
                            : step.active
                              ? '0 2px 8px rgba(212,132,154,0.4)'
                              : 'none',
                          border: !step.done && !step.active ? '1.5px solid #e8ddd1' : 'none',
                          animation: step.active ? 'arrival-glow 2s ease-in-out infinite' : 'none',
                        }}>
                        {step.done ? '✓' : step.active ? '●' : i + 1}
                      </div>
                      <span className="text-[9px] uppercase text-center leading-tight"
                        style={{ color: '#9a8a7e', letterSpacing: '0.05em' }}>
                        {step.label}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className="flex-1 h-[1px] mx-1 mb-5 relative overflow-hidden" style={{ background: '#e8ddd1' }}>
                        <div className="absolute inset-y-0 left-0 transition-all duration-[2s] ease-out"
                          style={{
                            width: step.done ? '100%' : '0%',
                            background: 'linear-gradient(90deg, #c9a96e, #d4849a)',
                          }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Service Chips */}
              <div className="flex gap-2 mt-3.5 flex-wrap">
                <span className="px-3 py-1 rounded-full text-[11px] flex items-center gap-1"
                  style={{ background: '#f0d4dc', color: '#b5637a', letterSpacing: '0.03em' }}>
                  ✦ Drenagem Linfática
                </span>
                <span className="px-3 py-1 rounded-full text-[11px]"
                  style={{ background: 'rgba(201,169,110,0.12)', color: '#b8935a' }}>
                  90 min
                </span>
                <span className="px-3 py-1 rounded-full text-[11px]"
                  style={{ background: 'rgba(138,158,141,0.12)', color: '#8a9e8d' }}>
                  14h00
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Overlay de Desbloqueio de Áudio ─── */}
        {showOverlay && (
          <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center p-8"
            style={{ background: 'rgba(250,246,241,0.97)', backdropFilter: 'blur(12px)' }}>

            {/* Logo / Branding */}
            <div className="mb-8 text-center">
              <div className="text-xs uppercase tracking-[0.35em] mb-3"
                style={{ fontFamily: "'Cormorant Garamond', serif", color: '#9a8a7e' }}>
                Myka Home SPA
              </div>
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, #f0d4dc, #f3ece3)',
                  border: '2px solid #fffdf9',
                  boxShadow: '0 4px 20px rgba(212,132,154,0.25)',
                }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: '#b5637a' }}>M</span>
              </div>
            </div>

            <h2 className="text-2xl font-medium mb-2 text-center"
              style={{ fontFamily: "'Cormorant Garamond', serif", color: '#2a2420' }}>
              Rastreamento Premium
            </h2>
            <p className="text-sm text-center mb-8 max-w-xs leading-relaxed" style={{ color: '#9a8a7e' }}>
              Acompanhe em tempo real a chegada da sua profissional com alertas sonoros e visuais.
            </p>

            <button
              onClick={unlockAudio}
              className="px-10 py-4 rounded-2xl text-sm font-semibold uppercase tracking-[0.12em] transition-all"
              style={{
                background: 'linear-gradient(135deg, #c9a96e, #b8935a)',
                color: '#2a2420',
                border: 'none',
                animation: 'overlay-btn-glow 2.5s ease-in-out infinite',
                fontFamily: "'Jost', sans-serif",
                cursor: 'pointer',
              }}>
              Acompanhar Deslocamento
            </button>

            <div className="mt-4 text-[11px]" style={{ color: '#bfb3a6', letterSpacing: '0.04em' }}>
              Você receberá um alerta quando Mykaele chegar
            </div>
          </div>
        )}

        {/* ─── Modal de Chegada ─── */}
        {showArrivalModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            style={{ background: 'rgba(42,36,32,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowArrivalModal(false)}>
            <div className="w-full max-w-sm rounded-3xl p-8 text-center"
              style={{
                background: '#fffdf9',
                boxShadow: '0 24px 80px rgba(42,36,32,0.25)',
                animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onClick={e => e.stopPropagation()}>

              {/* Confetti decorativo */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                {['#c9a96e', '#d4849a', '#e8d5b0', '#b5637a', '#8a9e8d', '#f0d4dc'].map((c, i) => (
                  <div key={i} className="absolute w-2 h-2 rounded-full"
                    style={{
                      background: c,
                      left: `${15 + i * 14}%`,
                      top: '5%',
                      animation: `confetti-fall ${1.5 + i * 0.2}s ease-out ${i * 0.15}s forwards`,
                    }} />
                ))}
              </div>

              {/* Ícone de chegada animado */}
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #c9a96e, #b8935a)',
                    animation: 'arrival-glow 1.5s ease-in-out infinite',
                  }} />
                <div className="absolute inset-0 rounded-full flex items-center justify-center text-4xl">
                  ✦
                </div>
                {/* Sparkles */}
                {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                  <div key={i} className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      background: '#c9a96e',
                      top: '50%', left: '50%',
                      transform: `rotate(${deg}deg) translateY(-48px)`,
                      animation: `sparkle 1.8s ease-in-out ${i * 0.3}s infinite`,
                    }} />
                ))}
                {/* Rings pulsantes */}
                <div className="absolute -inset-4 rounded-full border-2"
                  style={{ borderColor: 'rgba(201,169,110,0.3)', animation: 'pulse-ring-arrival 2s ease-out infinite' }} />
                <div className="absolute -inset-8 rounded-full border"
                  style={{ borderColor: 'rgba(201,169,110,0.15)', animation: 'pulse-ring-arrival 2s ease-out 0.5s infinite' }} />
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

              <button
                onClick={() => setShowArrivalModal(false)}
                className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #c9a96e, #b8935a)',
                  color: '#2a2420',
                  boxShadow: '0 4px 16px rgba(201,169,110,0.35)',
                  letterSpacing: '0.1em',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif",
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
