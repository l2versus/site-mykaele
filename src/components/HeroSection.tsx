// src/components/HeroSection.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const HERO_VIDEOS = [
  '/media/videos/clinica-tour.mp4',
  '/media/videos/clinica-tour-2.mp4',
]

// Máximo que qualquer vídeo fica na tela (se for muito longo)
const MAX_DURATION = 18000
// Mínimo que qualquer vídeo fica na tela (evita transições rápidas)
const MIN_DURATION = 6000
// Tempo do crossfade (ms)
const FADE_MS = 1800

export function HeroSection() {
  const [loaded, setLoaded] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showA, setShowA] = useState(true)
  const [opacityA, setOpacityA] = useState(1)
  const [opacityB, setOpacityB] = useState(0)
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadingRef = useRef(false)

  useEffect(() => { setLoaded(true) }, [])

  // Retorna o vídeo ativo e o de fundo
  const getVideos = useCallback(() => {
    const active = showA ? videoARef.current : videoBRef.current
    const next = showA ? videoBRef.current : videoARef.current
    return { active, next }
  }, [showA])

  // Inicia a transição crossfade para o próximo vídeo
  const startTransition = useCallback((toIdx?: number) => {
    if (fadingRef.current) return
    fadingRef.current = true

    const nextIdx = toIdx !== undefined ? toIdx : (currentIdx + 1) % HERO_VIDEOS.length
    const { next } = getVideos()

    // Prepara o próximo vídeo invisível
    if (next) {
      next.src = HERO_VIDEOS[nextIdx]
      next.currentTime = 0
      next.play().catch(() => {})
    }

    // Fade out do atual, fade in do próximo
    if (showA) {
      setOpacityA(0)
      setOpacityB(1)
    } else {
      setOpacityB(0)
      setOpacityA(1)
    }

    // Após o fade completo, troca o slot ativo
    setTimeout(() => {
      setShowA(prev => !prev)
      setCurrentIdx(nextIdx)
      fadingRef.current = false
    }, FADE_MS)
  }, [currentIdx, getVideos, showA])

  // Quando o vídeo ativo muda, programa quando transicionar
  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const { active } = getVideos()
    if (!active) return

    const setupSchedule = () => {
      const dur = active.duration
      if (!dur || !isFinite(dur)) {
        // Duração desconhecida — usa fallback
        timerRef.current = setTimeout(() => startTransition(), MAX_DURATION)
        return
      }

      // Usa a duração real do vídeo, capped entre min e max
      const rawMs = dur * 1000
      const clampedMs = Math.max(MIN_DURATION, Math.min(rawMs, MAX_DURATION))
      const waitMs = clampedMs - FADE_MS
      timerRef.current = setTimeout(() => startTransition(), Math.max(waitMs, 3000))
    }

    if (active.readyState >= 1 && isFinite(active.duration)) {
      setupSchedule()
    } else {
      // Espera os metadados carregarem
      const onMeta = () => {
        active.removeEventListener('loadedmetadata', onMeta)
        setupSchedule()
      }
      active.addEventListener('loadedmetadata', onMeta)
    }
  }, [getVideos, startTransition])

  // Carrega o primeiro vídeo e agenda
  useEffect(() => {
    const vid = videoARef.current
    if (vid) {
      vid.src = HERO_VIDEOS[0]
      vid.play().catch(() => {})
      setOpacityA(1)
      setOpacityB(0)
    }
  }, [])

  // Re-agenda sempre que o vídeo ativo muda
  useEffect(() => {
    scheduleNext()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [currentIdx, scheduleNext])

  // Clique manual nos indicators
  const goTo = useCallback((idx: number) => {
    if (idx === currentIdx || fadingRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    startTransition(idx)
  }, [currentIdx, startTransition])

  return (
    <section id="hero" className="relative h-[100dvh] flex items-end overflow-hidden bg-[#0a0a0a]">
      {/* VIDEO BACKGROUND */}
      <div className="absolute inset-0">
        <div className="absolute inset-[-5%] w-[110%] h-[110%]">
          <video ref={videoARef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: 'blur(2px) saturate(1.2) contrast(1.1) brightness(0.92)',
              opacity: opacityA,
              transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
            muted autoPlay loop playsInline preload="auto" />
          <video ref={videoBRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: 'blur(2px) saturate(1.2) contrast(1.1) brightness(0.92)',
              opacity: opacityB,
              transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
            muted autoPlay loop playsInline preload="auto" />
        </div>
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
      </div>

      {/* Video indicators */}
      <div className={`absolute bottom-8 right-8 z-20 flex gap-1.5 transition-opacity duration-1000 delay-[2s] ${loaded ? 'opacity-100' : 'opacity-0'}`}>
        {HERO_VIDEOS.map((_, i) => (
          <button key={i}
            onClick={() => goTo(i)}
            className={`h-[2px] rounded-full transition-all duration-700 ${currentIdx === i ? 'bg-[#b76e79] w-10' : 'bg-white/25 w-6 hover:bg-white/50'}`} />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 w-full pb-20 md:pb-28">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="max-w-[680px]">
            <div className={`transition-all duration-1000 delay-500 ${loaded ? 'opacity-100' : 'opacity-0 translate-y-3'}`}>
              <span className="text-[10px] font-medium tracking-[0.4em] uppercase text-white/35 block mb-10">
                Fisioterapia Estética de Alta Performance
              </span>
            </div>

            <div className={`transition-all duration-[1200ms] delay-700 ${loaded ? 'opacity-100' : 'opacity-0 translate-y-5'}`}>
              <h1 className="text-[clamp(2rem,5vw,4.2rem)] font-extralight leading-[1.12] tracking-[-0.02em] text-white mb-8">
                A convergência entre
                <br />a ciência anatômica e a
                <br />mais alta <span className="font-normal text-[#d4a0a7]">sofisticação.</span>
              </h1>
            </div>

            <div className={`transition-all duration-1000 delay-[900ms] ${loaded ? 'opacity-100' : 'opacity-0 translate-y-3'}`}>
              <p className="text-[14px] text-white/40 font-light leading-[1.9] max-w-[480px] mb-14">
                No Mykaele Procópio Home Spa, a fisioterapia estética
                é elevada ao status de arquitetura corporal — transformações
                precisas com absoluta privacidade.
              </p>
            </div>

            <div className={`flex gap-4 transition-all duration-1000 delay-[1100ms] ${loaded ? 'opacity-100' : 'opacity-0 translate-y-3'}`}>
              <a href="#agendamento"
                className="group inline-flex items-center gap-4 px-7 py-3.5 bg-white text-[#1a1a1a] text-[10px] font-semibold tracking-[0.25em] uppercase hover:bg-[#b76e79] hover:text-white transition-all duration-500">
                Agendar Avaliação
                <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </a>
              <a href="#metodo"
                className="inline-flex items-center px-7 py-3.5 text-[10px] font-medium tracking-[0.25em] uppercase text-white/50 border border-white/10 hover:border-white/30 hover:text-white/80 transition-all duration-500">
                Conhecer o Método
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
