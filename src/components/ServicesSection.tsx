// src/components/ServicesSection.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

const METODO_VIDEO = '/media/videos/metodo-banner.mp4'

const FUNDAMENTOS = [
  {
    numero: '01',
    titulo: 'Impacto Fisiológico Imediato',
    corpo: 'Engenharia corporal que proporciona a redução tangível de medidas e do peso sistêmico desde a primeira sessão. Resultados que podem ser visualizados e mensurados imediatamente.',
  },
  {
    numero: '02',
    titulo: 'Ação Metabólica Prolongada',
    corpo: 'A precisão dos estímulos manuais mantém o organismo em processo contínuo de otimização circulatória e metabólica, estendendo a eficácia por até 48 horas após o atendimento.',
  },
  {
    numero: '03',
    titulo: 'Flexibilidade e Exclusividade',
    corpo: 'A excelência do protocolo disponível em instalações de alto padrão ou através do formato Home Spa — a infraestrutura clínica transposta para a privacidade da sua residência.',
  },
]

const STATS = [
  { valor: '2.500+', label: 'Sessões Realizadas' },
  { valor: '98%', label: 'Satisfação' },
  { valor: '-4cm', label: 'Média 1ª Sessão' },
  { valor: '48h', label: 'Ação Prolongada' },
]

export function ServicesSection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
        if (entry.isIntersecting && videoRef.current) {
          videoRef.current.play().catch(() => {})
        }
      },
      { threshold: 0.1 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect()
        setScrollY(-rect.top * 0.15)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section id="metodo" ref={sectionRef} className="relative overflow-hidden">
      
      {/* ===== VIDEO BANNER — Cinematic fullwidth ===== */}
      <div className="relative h-[85vh] min-h-[600px] max-h-[900px] flex items-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0"
            style={{ transform: `translateY(${scrollY}px)` }}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{ filter: 'saturate(1.1) contrast(1.05) brightness(0.85)' }}
              src={METODO_VIDEO}
              muted
              loop
              playsInline
              preload="none"
            />
          </div>
          
          {/* Overlay — mais suave na direita pra mostrar ela */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#faf9f7] to-transparent" />
          
          {/* Rose-gold accent glow */}
          <div className="absolute top-1/4 -left-20 w-[400px] h-[400px] bg-[#b76e79]/8 rounded-full blur-[100px] pointer-events-none" />
          
          {/* Grain */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
        </div>

        {/* Content overlay — lado esquerdo pra não cobrir ela */}
        <div className="relative z-10 w-full">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10">
            <div className="max-w-[560px]">
              {/* Tag */}
              <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <span className="inline-flex items-center gap-3 mb-10">
                  <span className="w-10 h-[1px] bg-[#b76e79]" />
                  <span className="text-[10px] font-medium tracking-[0.4em] uppercase text-[#b76e79]">
                    Protocolo Exclusivo
                  </span>
                </span>
              </div>

              {/* Title */}
              <div className={`transition-all duration-[1200ms] delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                <h2 className="text-[clamp(2rem,5vw,3.6rem)] font-extralight leading-[1.1] tracking-[-0.03em] text-white mb-8">
                  Método
                  <br />
                  <span className="font-light">Mykaele Procópio</span>
                  <br />
                  <span className="font-normal text-[#d4a0a7] italic">
                    Arquitetura Corporal
                  </span>
                </h2>
              </div>

              {/* Description */}
              <div className={`transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <p className="text-[14px] text-white/50 font-light leading-[1.9] max-w-[460px] mb-10">
                  Um protocolo de intervenção estética projetado para pacientes
                  que exigem eficácia imediata. Um sistema de remodelação de alta
                  performance que une a precisão da fisioterapia ao estímulo
                  metabólico profundo.
                </p>
              </div>

              {/* CTA */}
              <div className={`transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <a
                  href="#agendamento"
                  className="group inline-flex items-center gap-4 px-8 py-4 bg-[#b76e79] text-white text-[10px] font-semibold tracking-[0.3em] uppercase hover:bg-[#a05d67] transition-all duration-500"
                >
                  Agendar Avaliação
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="flex flex-col items-center gap-3 animate-bounce">
            <span className="text-[9px] tracking-[0.3em] uppercase text-white/25">Scroll</span>
            <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </div>
        </div>
      </div>

      {/* ===== FUNDAMENTOS — Pilares editoriais (01, 02, 03) ===== */}
      <div className="bg-[#faf9f7] border-t border-[#e8dfd6]/80">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div>
            {FUNDAMENTOS.map((f, idx) => (
              <div key={idx}
                className={`reveal-blur grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 py-16 md:py-20 ${
                  idx < FUNDAMENTOS.length - 1 ? 'border-b border-[#e8dfd6]/60' : ''
                }`}
                style={{ transitionDelay: `${idx * 120}ms` }}
              >
                {/* Número */}
                <div className="md:col-span-1">
                  <span className="text-xs font-medium tracking-[0.2em] text-[#b76e79]">
                    {f.numero}
                  </span>
                </div>
                {/* Título */}
                <div className="md:col-span-4">
                  <h3 className="text-xl md:text-2xl font-light text-[#2d2d2d] leading-snug">
                    {f.titulo}
                  </h3>
                </div>
                {/* Corpo */}
                <div className="md:col-span-6 md:col-start-7">
                  <p className="text-[15px] text-[#6a6560] font-light leading-[1.85]">
                    {f.corpo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== STATS BAR — Números de impacto ===== */}
      <div className="relative bg-[#0a0a0a] border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
            {STATS.map((s, i) => (
              <div key={i} className="py-10 md:py-14 text-center reveal-blur">
                <span className="block text-2xl md:text-3xl font-light text-[#b76e79] mb-2 counter" data-target={s.valor}>
                  {s.valor}
                </span>
                <span className="text-[10px] tracking-[0.25em] uppercase text-white/30 font-medium">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FORMATOS DE ATENDIMENTO ===== */}
      <div className="border-t border-[#e8dfd6]/80 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-24">
          <div className="text-center mb-14 reveal-blur">
            <span className="text-[10px] font-medium tracking-[0.4em] uppercase text-[#b76e79]/60 block mb-5">
              Flexibilidade
            </span>
            <h3 className="text-[clamp(1.4rem,2.5vw,2rem)] font-extralight text-[#2d2d2d] leading-tight tracking-[-0.02em]">
              Escolha o formato <span className="text-[#b76e79] font-light">ideal</span>
            </h3>
          </div>

          <div className="stagger-scale grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="group relative overflow-hidden border border-[#e8dfd6]/60 hover:border-[#b76e79]/30 transition-all duration-700 hover:shadow-lg hover:shadow-[#b76e79]/5">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#b76e79]/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
              <div className="p-10">
                <span className="text-xs font-medium tracking-[0.25em] uppercase text-[#8a8580] block mb-6">Formato I</span>
                <h4 className="text-lg font-light text-[#2d2d2d] mb-4">Atendimento em Clínica</h4>
                <p className="text-sm text-[#6a6560] font-light leading-relaxed mb-5">
                  Instalações de alto padrão projetadas para o conforto
                  e privacidade absoluta durante cada protocolo.
                </p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#2d2d2d] rounded-full">
                  <span className="w-1 h-1 rounded-full bg-[#b76e79] animate-pulse" />
                  <span className="text-[8px] font-medium tracking-[0.2em] uppercase text-white/60">Agenda limitada</span>
                </span>
              </div>
            </div>
            <div className="group relative overflow-hidden border border-[#e8dfd6]/60 hover:border-[#b76e79]/30 transition-all duration-700 hover:shadow-lg hover:shadow-[#b76e79]/5">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#b76e79]/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
              <div className="p-10">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-medium tracking-[0.25em] uppercase text-[#8a8580]">Formato II</span>
                  <span className="text-[8px] font-medium tracking-[0.15em] uppercase text-[#b76e79] border border-[#b76e79]/20 px-2 py-0.5 rounded-sm">Exclusivo</span>
                </div>
                <h4 className="text-lg font-light text-[#2d2d2d] mb-4">Serviço Home Spa</h4>
                <p className="text-sm text-[#6a6560] font-light leading-relaxed mb-5">
                  A infraestrutura clínica transposta para a privacidade
                  e o conforto da sua residência em Fortaleza.
                </p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#2d2d2d] rounded-full">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[8px] font-medium tracking-[0.2em] uppercase text-white/60">Vagas sob consulta</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
