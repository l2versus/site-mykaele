// src/components/EquipeAmbiente.tsx
'use client'

import { useEffect, useRef } from 'react'

// Os 4 passos do atendimento a domicílio — a jornada "o spa vai até você"
const STEPS = [
  {
    n: '01',
    t: 'Você agenda online',
    d: 'Escolha o protocolo, a data e o horário pelo site ou pelo app — em poucos toques, sem ligação e sem espera.',
  },
  {
    n: '02',
    t: 'A Mykaele vai até você',
    d: 'Ela chega no seu endereço com toda a estrutura portátil de alto padrão: maca profissional, aparelhos e materiais esterilizados.',
  },
  {
    n: '03',
    t: 'Seu ritual, no seu espaço',
    d: 'O atendimento acontece no conforto, na intimidade e na privacidade absoluta do seu lar. Sem deslocamento, sem exposição.',
  },
  {
    n: '04',
    t: 'Acompanhamento contínuo',
    d: 'Sua evolução fica registrada no app, com fotos de antes e depois e suporte direto no WhatsApp entre as sessões.',
  },
]

// O que está incluso — substitui o antigo "Ambiente Clínico / Infraestrutura"
const INCLUSO = [
  { t: 'Estrutura portátil', d: 'Maca e equipamentos profissionais levados até você' },
  { t: 'Aparelhos de ponta', d: 'Tecnologia de última geração em cada protocolo' },
  { t: 'Biossegurança', d: 'Materiais esterilizados e protocolos rigorosos' },
  { t: 'Privacidade absoluta', d: 'Atendimento individual, no seu espaço' },
]

function ExperienceVideo({ src, titulo, desc }: { src: string; titulo: string; desc: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // iOS bloqueia autoplay sem contexto — usamos IntersectionObserver pra dar play ao entrar na tela
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {})
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="group relative aspect-[16/10] overflow-hidden bg-[#1a1a1a]">
      <video
        ref={el => {
          videoRef.current = el
          if (el) {
            el.muted = true
            el.defaultMuted = true
            el.setAttribute('muted', '')
            el.setAttribute('playsinline', '')
            el.setAttribute('webkit-playsinline', '')
            el.playsInline = true
            el.play().catch(() => {})
          }
        }}
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-8">
        <p className="text-base font-light text-white mb-1">{titulo}</p>
        <p className="text-sm text-white/60 font-light">{desc}</p>
      </div>
    </div>
  )
}

export default function EquipeAmbiente() {
  return (
    <section id="equipe" className="relative bg-white overflow-hidden">
      <div className="py-28 md:py-36">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">

          {/* ===== Header ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20 md:mb-28">
            <div className="lg:col-span-7 reveal-blur">
              <span className="inline-flex items-center gap-3 mb-7">
                <span className="w-8 h-[1px] bg-[#b76e79]" />
                <span className="text-[10px] font-medium tracking-[0.4em] uppercase text-[#b76e79]">
                  Atendimento a Domicílio · Fortaleza
                </span>
              </span>
              <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-extralight leading-[1.08] tracking-[-0.02em] text-[#2d2d2d]">
                O spa de luxo
                <br />
                que vai até <span className="font-normal italic text-[#b76e79]">você.</span>
              </h2>
            </div>
            <div className="lg:col-span-4 lg:col-start-9 flex items-end reveal-blur delay-300">
              <p className="text-[15px] text-[#6a6560] font-light leading-[1.9]">
                Sem sala de espera, sem deslocamento, sem exposição. A Mykaele leva toda a
                experiência de um spa premium para o conforto e a privacidade da sua casa —
                com a mesma precisão técnica, do começo ao fim.
              </p>
            </div>
          </div>

          {/* ===== Os 4 passos — grade com fios finos ===== */}
          <div className="stagger-children grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#e8dfd6]/50 mb-4">
            {STEPS.map((s, i) => (
              <div key={i} className="group relative bg-white p-9 md:p-10">
                {/* fio dourado que cresce no hover */}
                <span className="absolute top-0 left-0 h-[2px] w-0 bg-[#b76e79]/45 group-hover:w-full transition-all duration-700" />
                <span className="block text-[2.4rem] md:text-[2.8rem] font-extralight leading-none text-[#b76e79]/75 mb-7">
                  {s.n}
                </span>
                <h3 className="text-lg font-light text-[#2d2d2d] mb-3 leading-snug">{s.t}</h3>
                <p className="text-[14px] text-[#6a6560] font-light leading-[1.85]">{s.d}</p>
              </div>
            ))}
          </div>

          {/* ===== A experiência em vídeo (atendimento real, não tour de espaço) ===== */}
          <div className="stagger-scale grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <ExperienceVideo
              src="/media/videos/procedimento-1.mp4"
              titulo="O cuidado, na sua casa"
              desc="Cada sessão conduzida com precisão, onde você se sente bem"
            />
            <ExperienceVideo
              src="/media/videos/procedimento-2.mp4"
              titulo="Estrutura completa, até você"
              desc="Tudo o que o protocolo exige, levado ao seu espaço"
            />
          </div>

          {/* ===== O que está incluso ===== */}
          <div className="stagger-children grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#e8dfd6]/50">
            {INCLUSO.map((f, i) => (
              <div key={i} className="bg-[#faf9f7] p-8 md:p-9 text-center">
                <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#2d2d2d] mb-2">{f.t}</p>
                <p className="text-[13px] text-[#6a6560] font-light leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
