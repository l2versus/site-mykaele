      // src/components/AppShowcase.tsx
'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

const APP_VIDEOS = [
  '/media/videos/app-showcase-1.mp4',
  '/media/videos/app-showcase-2.mp4',
  '/media/videos/app-showcase-3.mp4',
]

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Agendamento em tempo real',
    desc: 'Escolha serviço, dia e horário em segundos',
    details: [
      'Veja todos os horários disponíveis em tempo real',
      'Escolha o serviço, profissional e horário com poucos toques',
      'Confirmação instantânea por notificação e e-mail',
      'Reagende ou cancele direto pelo app sem ligar',
      'Histórico completo de todos os seus agendamentos',
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Evolução corporal',
    desc: '13 medidas com gráficos sessão a sessão',
    details: [
      '13 medidas corporais registradas a cada sessão',
      'Gráficos interativos mostrando sua evolução ao longo do tempo',
      'Compare resultados entre sessões de forma visual',
      'Acompanhe cintura, quadril, braços, coxas e muito mais',
      'Dados salvos com segurança — acesse de qualquer dispositivo',
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'PDF pós-sessão',
    desc: 'Relatório personalizado com suas medidas',
    details: [
      'PDF gerado automaticamente ao final de cada sessão',
      'Inclui todas as medidas atualizadas e comparativo',
      'Gráficos de evolução embutidos no documento',
      'Baixe ou compartilhe direto pelo WhatsApp',
      'Registro profissional de cada atendimento',
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    title: 'Indique e ganhe',
    desc: 'Até 15% de desconto por indicações',
    details: [
      'Compartilhe seu link exclusivo com amigas',
      '5% de desconto na 1ª indicação confirmada',
      '10% com 3 indicações — descontos acumulam',
      'Até 15% de desconto permanente com 5+ indicações',
      'Acompanhe suas indicações e recompensas no painel',
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: 'Programa de fidelidade',
    desc: 'Bronze → Prata → Ouro → Diamante',
    details: [
      '4 níveis: Bronze, Prata, Ouro e Diamante',
      'Acumule pontos a cada sessão realizada',
      'Resgate recompensas exclusivas como descontos e brindes',
      'Benefícios especiais nos níveis mais altos',
      'Acompanhe seus pontos e nível em tempo real no app',
    ],
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: 'Notificações',
    desc: 'Lembretes automáticos no celular',
    details: [
      'Lembretes 24h e 1h antes do seu horário',
      'Notificação de confirmação ao agendar',
      'Avisos de promoções e ofertas exclusivas',
      'Alerta quando seu PDF de sessão está pronto',
      'Funciona mesmo com o app fechado (push notification)',
    ],
  },
]

export default function AppShowcase() {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const sectionRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [activeVideo, setActiveVideo] = useState(0)
  const [progress, setProgress] = useState(0)
  const [modalIdx, setModalIdx] = useState<number | null>(null)

  // Fechar modal com ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalIdx(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Bloquear scroll quando modal está aberto
  useEffect(() => {
    if (modalIdx !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [modalIdx])

  // Intersection observer — play/pause
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
        if (entry.isIntersecting) {
          videoRefs.current[activeVideo]?.play().catch(() => {})
        } else {
          videoRefs.current.forEach(v => v?.pause())
        }
      },
      { threshold: 0.15 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [activeVideo])

  // Autoplay carousel: troca de vídeo quando o atual termina
  const handleVideoEnd = useCallback(() => {
    const next = (activeVideo + 1) % APP_VIDEOS.length
    setActiveVideo(next)
    setProgress(0)
    setTimeout(() => videoRefs.current[next]?.play().catch(() => {}), 100)
  }, [activeVideo])

  // Progress bar
  useEffect(() => {
    const video = videoRefs.current[activeVideo]
    if (!video) return
    const update = () => {
      if (video.duration) setProgress((video.currentTime / video.duration) * 100)
    }
    video.addEventListener('timeupdate', update)
    return () => video.removeEventListener('timeupdate', update)
  }, [activeVideo])

  const goToVideo = (idx: number) => {
    videoRefs.current[activeVideo]?.pause()
    setActiveVideo(idx)
    setProgress(0)
    setTimeout(() => {
      const v = videoRefs.current[idx]
      if (v) { v.currentTime = 0; v.play().catch(() => {}) }
    }, 100)
  }

  return (
    <section
      ref={sectionRef}
      id="app"
      className="relative bg-[#0c0c0c] overflow-hidden"
    >
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }}
      />

      {/* Glow orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-[#b76e79]/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-[#b76e79]/5 rounded-full blur-[120px]" />

      <div className="relative py-16 md:py-28 lg:py-36">
        <div className="max-w-[1400px] mx-auto px-5 md:px-10">

          {/* ── MOBILE LAYOUT (< lg) ── */}
          <div className="lg:hidden">

            {/* Header */}
            <div className={`text-center mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <span className="text-[10px] font-medium tracking-[0.35em] uppercase text-[#b76e79] block mb-4">
                Experiência Digital
              </span>
              <h2 className="text-[1.6rem] font-extralight text-white leading-[1.25]">
                Seu tratamento
                <span className="font-normal text-[#d4a0a7]"> na palma da mão</span>
              </h2>
            </div>

            {/* Phone with video */}
            <div className={`relative mx-auto w-[240px] mb-8 transition-all duration-1000 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
              style={{ transitionDelay: '200ms' }}>
              {/* Phone frame */}
              <div className="relative rounded-[2rem] overflow-hidden border-[5px] border-[#222] bg-black shadow-2xl shadow-[#b76e79]/10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-b-xl z-20" />
                <div className="relative aspect-[9/19.5] overflow-hidden bg-[#111]">
                  {APP_VIDEOS.map((src, i) => (
                    <video
                      key={i}
                      ref={el => { videoRefs.current[i] = el }}
                      src={src}
                      muted
                      playsInline
                      preload={i === 0 ? 'auto' : 'metadata'}
                      onEnded={handleVideoEnd}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === activeVideo ? 'opacity-100' : 'opacity-0'}`}
                    />
                  ))}
                  {/* Progress dots overlay */}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                    {APP_VIDEOS.map((_, i) => (
                      <button key={i} onClick={() => goToVideo(i)}
                        className="relative w-6 h-1 rounded-full overflow-hidden bg-white/20 transition-all">
                        {i === activeVideo && (
                          <div className="absolute inset-0 bg-white rounded-full origin-left"
                            style={{ transform: `scaleX(${progress / 100})` }} />
                        )}
                        {i < activeVideo && <div className="absolute inset-0 bg-white/60 rounded-full" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -inset-6 bg-[#b76e79]/8 rounded-[3rem] blur-3xl -z-10" />
            </div>

            {/* Features — 2 cols compact */}
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {FEATURES.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setModalIdx(i)}
                  className={`p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-left cursor-pointer active:scale-[0.97] transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: `${400 + i * 80}ms` }}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#b76e79]/10 flex items-center justify-center text-[#b76e79] mb-2">
                    {f.icon}
                  </div>
                  <h3 className="text-[12px] font-medium text-white leading-snug">{f.title}</h3>
                  <p className="text-[10px] text-[#777] font-light leading-relaxed mt-0.5">{f.desc}</p>
                  <span className="text-[9px] text-[#b76e79]/60 mt-1.5 block">Toque para saber mais →</span>
                </button>
              ))}
            </div>

            {/* CTA mobile */}
            <div className={`text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '900ms' }}>
              <a href="https://mykaprocopio.com.br"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-white text-[13px] font-semibold shadow-lg shadow-[#b76e79]/20 transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Instalar App Grátis
              </a>
              <p className="text-[10px] text-[#555] mt-3 font-light">Sem loja de apps · Celular, tablet ou PC</p>
            </div>
          </div>

          {/* ── DESKTOP LAYOUT (>= lg) ── */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-12 gap-16 items-center">

              {/* Left — Features */}
              <div className="col-span-7">
                <div className={`mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                  <span className="text-[10px] font-medium tracking-[0.35em] uppercase text-[#b76e79] block mb-5">
                    Experiência Digital
                  </span>
                  <h2 className="text-[clamp(2rem,3.5vw,2.8rem)] font-extralight text-white leading-[1.15]">
                    Seu tratamento inteiro
                    <br />
                    <span className="font-normal text-[#d4a0a7]">na palma da mão.</span>
                  </h2>
                  <p className="mt-5 text-[15px] text-[#777] font-light max-w-lg leading-relaxed">
                    Agende, acompanhe sua evolução e ganhe recompensas —
                    tudo em um aplicativo elegante que funciona direto do navegador.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {FEATURES.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setModalIdx(i)}
                      className={`group p-5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-[#b76e79]/15 text-left cursor-pointer transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                      style={{ transitionDelay: `${200 + i * 100}ms` }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#b76e79]/10 flex items-center justify-center text-[#b76e79] mb-3 group-hover:bg-[#b76e79]/15 transition-colors">
                        {f.icon}
                      </div>
                      <h3 className="text-sm font-medium text-white mb-1">{f.title}</h3>
                      <p className="text-xs text-[#777] font-light leading-relaxed">{f.desc}</p>
                      <span className="text-[10px] text-[#b76e79]/50 mt-2 block group-hover:text-[#b76e79]/80 transition-colors">Clique para saber mais →</span>
                    </button>
                  ))}
                </div>

                <div className={`mt-8 flex items-center gap-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: '900ms' }}>
                  <a href="https://mykaprocopio.com.br"
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-white text-sm font-semibold shadow-lg shadow-[#b76e79]/20 transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Instalar App Grátis
                  </a>
                  <span className="text-xs text-[#555] font-light">Sem loja de apps · Celular, tablet ou PC</span>
                </div>
              </div>

              {/* Right — Phone with carousel */}
              <div className="col-span-5">
                <div className={`relative mx-auto max-w-[300px] transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                  style={{ transitionDelay: '300ms' }}>
                  {/* Phone frame */}
                  <div className="relative rounded-[2.8rem] overflow-hidden border-[6px] border-[#1a1a1a] bg-black shadow-2xl shadow-black/60">
                    {/* Dynamic Island */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[90px] h-[26px] bg-black rounded-full z-20" />

                    <div className="relative aspect-[9/19.5] overflow-hidden bg-[#0a0a0a]">
                      {APP_VIDEOS.map((src, i) => (
                        <video
                          key={i}
                          ref={el => { videoRefs.current[i] = el }}
                          src={src}
                          muted
                          playsInline
                          preload={i === 0 ? 'auto' : 'metadata'}
                          onEnded={handleVideoEnd}
                          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === activeVideo ? 'opacity-100' : 'opacity-0'}`}
                        />
                      ))}

                      {/* Story-style progress bars */}
                      <div className="absolute top-6 left-4 right-4 flex gap-1 z-10">
                        {APP_VIDEOS.map((_, i) => (
                          <div key={i} className="flex-1 h-[2px] rounded-full overflow-hidden bg-white/15">
                            {i === activeVideo && (
                              <div className="h-full bg-white/80 rounded-full transition-transform duration-100 origin-left"
                                style={{ transform: `scaleX(${progress / 100})` }} />
                            )}
                            {i < activeVideo && <div className="h-full bg-white/50 rounded-full" />}
                          </div>
                        ))}
                      </div>

                      {/* Tap zones */}
                      <div className="absolute inset-0 flex z-10">
                        <div className="w-1/3 h-full" onClick={() => goToVideo(Math.max(0, activeVideo - 1))} />
                        <div className="w-1/3 h-full" />
                        <div className="w-1/3 h-full" onClick={() => goToVideo(Math.min(APP_VIDEOS.length - 1, activeVideo + 1))} />
                      </div>
                    </div>

                    {/* Home indicator */}
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/20 rounded-full z-20" />
                  </div>

                  {/* Glow effect */}
                  <div className="absolute -inset-8 bg-[#b76e79]/6 rounded-[4rem] blur-3xl -z-10" />
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-[#b76e79]/10 blur-2xl -z-10 rounded-full" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── MODAL ── */}
      {modalIdx !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => setModalIdx(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_200ms_ease]" />

          {/* Modal card */}
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md bg-[#141414] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl shadow-black/50 animate-[modalIn_300ms_ease]"
          >
            {/* Header gradient */}
            <div className="relative px-6 pt-7 pb-5"
              style={{ background: 'linear-gradient(135deg, rgba(183,110,121,0.15), rgba(183,110,121,0.03))' }}>
              {/* Close button */}
              <button
                onClick={() => setModalIdx(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="w-12 h-12 rounded-2xl bg-[#b76e79]/15 flex items-center justify-center text-[#b76e79] mb-4">
                {FEATURES[modalIdx].icon}
              </div>
              <h3 className="text-xl font-medium text-white">{FEATURES[modalIdx].title}</h3>
              <p className="text-sm text-[#999] font-light mt-1">{FEATURES[modalIdx].desc}</p>
            </div>

            {/* Details list */}
            <div className="px-6 py-5 space-y-3">
              {FEATURES[modalIdx].details.map((item, i) => (
                <div key={i} className="flex items-start gap-3 animate-[fadeSlideIn_400ms_ease_both]"
                  style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-[#b76e79]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-[#b76e79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-[13px] text-[#ccc] font-light leading-relaxed">{item}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2">
              <button
                onClick={() => setModalIdx(null)}
                className="w-full py-3 rounded-xl text-white text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px) }
          to { opacity: 1; transform: scale(1) translateY(0) }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-8px) }
          to { opacity: 1; transform: translateX(0) }
        }
      `}</style>
    </section>
  )
}
