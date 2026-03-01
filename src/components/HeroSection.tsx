// src/components/HeroSection.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const HERO_VIDEOS = [
  '/media/videos/clinica-tour.mp4',
  '/media/videos/clinica-tour-2.mp4',
]

const HERO_PHOTO = '/media/profissionais/mykaele-principal.png'

// Timings do carrossel de video (desktop)
const MAX_DURATION = 18000
const MIN_DURATION = 6000
const FADE_MS = 1800

export function HeroSection() {
  const [loaded, setLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showA, setShowA] = useState(true)
  const [opacityA, setOpacityA] = useState(1)
  const [opacityB, setOpacityB] = useState(0)
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadingRef = useRef(false)

  useEffect(() => {
    setLoaded(true)
    // iPhone 16 Pro Max = 440pt, iPhone 17 Pro Max ~440pt
    // Detect mobile: < 768px (md breakpoint)
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile, { passive: true })
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const getVideos = useCallback(() => {
    const active = showA ? videoARef.current : videoBRef.current
    const next = showA ? videoBRef.current : videoARef.current
    return { active, next }
  }, [showA])

  const startTransition = useCallback((toIdx?: number) => {
    if (fadingRef.current) return
    fadingRef.current = true
    const nextIdx = toIdx !== undefined ? toIdx : (currentIdx + 1) % HERO_VIDEOS.length
    const { next } = getVideos()
    if (next) { next.src = HERO_VIDEOS[nextIdx]; next.currentTime = 0; next.play().catch(() => {}) }
    if (showA) { setOpacityA(0); setOpacityB(1) } else { setOpacityB(0); setOpacityA(1) }
    setTimeout(() => { setShowA(prev => !prev); setCurrentIdx(nextIdx); fadingRef.current = false }, FADE_MS)
  }, [currentIdx, getVideos, showA])

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const { active } = getVideos()
    if (!active) return
    const setupSchedule = () => {
      const dur = active.duration
      if (!dur || !isFinite(dur)) { timerRef.current = setTimeout(() => startTransition(), MAX_DURATION); return }
      const rawMs = dur * 1000
      const clampedMs = Math.max(MIN_DURATION, Math.min(rawMs, MAX_DURATION))
      timerRef.current = setTimeout(() => startTransition(), Math.max(clampedMs - FADE_MS, 3000))
    }
    if (active.readyState >= 1 && isFinite(active.duration)) { setupSchedule() }
    else { const onMeta = () => { active.removeEventListener('loadedmetadata', onMeta); setupSchedule() }; active.addEventListener('loadedmetadata', onMeta) }
  }, [getVideos, startTransition])

  useEffect(() => {
    if (isMobile) return // No video on mobile
    const vid = videoARef.current
    if (vid) { vid.src = HERO_VIDEOS[0]; vid.play().catch(() => {}); setOpacityA(1); setOpacityB(0) }
  }, [isMobile])

  useEffect(() => {
    if (isMobile) return
    scheduleNext()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [currentIdx, scheduleNext, isMobile])

  const goTo = useCallback((idx: number) => {
    if (idx === currentIdx || fadingRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    startTransition(idx)
  }, [currentIdx, startTransition])

  return (
    <section id="hero" className="relative h-[100dvh] flex items-end overflow-hidden bg-[#0a0a0a]">

      {/* ═══ MOBILE: Foto retrato imersiva da Mykaele ═══ */}
      <div className="md:hidden absolute inset-0">
        <img
          src={HERO_PHOTO}
          alt="Mykaele Procopio - Fisioterapeuta Dermatofuncional"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 20%' }}
          fetchPriority="high"
          draggable={false}
        />
        {/* Gradientes sobrepostos para legibilidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
        {/* Leve sutil rosado no bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-[#b76e79]/8 to-transparent" />
      </div>

      {/* ═══ DESKTOP: Video background com crossfade ═══ */}
      <div className="hidden md:block absolute inset-0">
        <div className="absolute inset-0">
          <video ref={videoARef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(2px) saturate(1.2) contrast(1.1) brightness(0.92)', opacity: opacityA, transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` }}
            muted autoPlay loop playsInline preload="auto" />
          <video ref={videoBRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(2px) saturate(1.2) contrast(1.1) brightness(0.92)', opacity: opacityB, transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` }}
            muted autoPlay loop playsInline preload="none" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
      </div>

      {/* Noise texture overlay (both) */}
      <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

      {/* Video indicators — Desktop only */}
      <div className={`hidden md:flex absolute bottom-8 right-8 z-20 gap-1.5 transition-opacity duration-1000 delay-[2s] ${loaded ? 'opacity-100' : 'opacity-0'}`}>
        {HERO_VIDEOS.map((_, i) => (
          <button key={i} onClick={() => goTo(i)}
            className={`h-[2px] rounded-full transition-all duration-700 ${currentIdx === i ? 'bg-[#b76e79] w-10' : 'bg-white/25 w-6 hover:bg-white/50'}`} />
        ))}
      </div>

      {/* ═══ Content ═══ */}
      <div className="relative z-10 w-full pb-[max(5rem,calc(env(safe-area-inset-bottom,0px)+3.5rem))] md:pb-28">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="max-w-[680px]">
            {/* Mobile: Nome e titulo sobre a foto */}
            <div className={`md:hidden transition-all duration-1000 delay-300 ${loaded ? 'opacity-100' : 'opacity-0 translate-y-3'}`}>
              {/* Logo pequena */}
              <img src="/media/logo-branding/logocorreta.png" alt="" className="w-6 h-6 object-contain invert brightness-200 mb-6 opacity-50" draggable={false} />
            </div>

            <div className={`transition-all duration-1000 delay-500 ${loaded ? 'opacity-100' : 'opacity-0 translate-y-3'}`}>
              <span className="text-[10px] font-medium tracking-[0.4em] uppercase text-white/35 block mb-4 md:mb-10">
                Fisioterapia Dermatofuncional
              </span>
            </div>

            {/* Mobile: Nome grande sobre a foto */}
            <div className={`md:hidden transition-all duration-[1200ms] delay-700 ${loaded ? 'opacity-100' : 'opacity-0 translate-y-5'}`}>
              <h1 className="text-[clamp(2.8rem,10vw,3.8rem)] font-extralight leading-[1.05] tracking-[-0.02em] text-white mb-3">
                Mykaele
                <br /><span className="font-light text-[#d4a0a7]">Procopio</span>
              </h1>
              <div className="w-10 h-[1px] bg-[#b76e79]/40 mb-4" />
              <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-white/30 mb-3">
                Home Spa Premium
              </p>
              <p className="text-[13px] text-white/40 font-light leading-[1.8] mb-8 max-w-[340px]">
                Fisioterapeuta Dermatofuncional &middot; Arquitetura Corporal
              </p>
            </div>

            {/* Desktop: Headline original */}
            <div className={`hidden md:block transition-all duration-[1200ms] delay-700 ${loaded ? 'opacity-100' : 'opacity-0 translate-y-5'}`}>
              <h1 className="text-[clamp(2rem,5vw,4.2rem)] font-extralight leading-[1.12] tracking-[-0.02em] text-white mb-8">
                A convergência entre
                <br />a ciência anatômica e a
                <br />mais alta <span className="font-normal text-[#d4a0a7]">sofisticação.</span>
              </h1>
            </div>

            <div className={`hidden md:block transition-all duration-1000 delay-[900ms] ${loaded ? 'opacity-100' : 'opacity-0 translate-y-3'}`}>
              <p className="text-[14px] text-white/40 font-light leading-[1.9] max-w-[480px] mb-14">
                No Mykaele Procopio Home Spa, a fisioterapia estetica
                e elevada ao status de arquitetura corporal — transformações
                precisas com absoluta privacidade.
              </p>
            </div>

            {/* CTAs — ambos, mas layout adaptado */}
            <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 transition-all duration-1000 delay-[1100ms] ${loaded ? 'opacity-100' : 'opacity-0 translate-y-3'}`}>
              <a href="#agendamento"
                className="group inline-flex items-center justify-center gap-3 sm:gap-4 px-6 sm:px-7 py-3.5 bg-white text-[#1a1a1a] text-[10px] font-semibold tracking-[0.25em] uppercase hover:bg-[#b76e79] hover:text-white transition-all duration-500 rounded-sm">
                Agendar Avaliação
                <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </a>
              <a href="https://wa.me/5585999086924" target="_blank" rel="noopener noreferrer"
                className="md:hidden inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-[10px] font-medium tracking-[0.2em] uppercase text-[#25D366]/80 border border-[#25D366]/20 hover:bg-[#25D366]/10 transition-all duration-500 rounded-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Fale Comigo
              </a>
              <a href="#metodo"
                className="hidden md:inline-flex items-center px-7 py-3.5 text-[10px] font-medium tracking-[0.25em] uppercase text-white/50 border border-white/10 hover:border-white/30 hover:text-white/80 transition-all duration-500">
                Conhecer o Método
              </a>
            </div>

            {/* Mobile: Dev credit discreto */}
            <div className={`md:hidden mt-6 transition-all duration-1000 delay-[1300ms] ${loaded ? 'opacity-100' : 'opacity-0'}`}>
              <a href="https://www.instagram.com/emmanuelbezerra_" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
                <span className="text-[9px] text-white/50 tracking-wider font-light">dev</span>
                <span className="text-[8px] text-rose-400/50">&#9829;</span>
                <img src="/media/logo-branding/logo-emmanuel.png" alt="Emmanuel Bezerra" className="h-4 w-auto object-contain brightness-200 opacity-60" draggable={false} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
