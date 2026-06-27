// src/components/HeroSection.tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

const WHATSAPP = 'https://wa.me/5585999086924'

export function HeroSection() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(true) }, [])

  const show = (delay: string) =>
    `transition-all duration-1000 ${delay} ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`

  return (
    <section
      id="hero"
      className="stack-panel md:sticky md:top-0 overflow-hidden min-h-[100svh] flex items-center bg-nude"
    >
      {/* ── Atmospheric background (mesh + grain) ── */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-[-20%] blur-[10px]"
          style={{
            background:
              'radial-gradient(40% 50% at 72% 30%, rgba(232,212,168,.55), transparent 60%),' +
              'radial-gradient(35% 45% at 20% 70%, rgba(231,214,203,.45), transparent 62%),' +
              'radial-gradient(50% 60% at 85% 85%, rgba(199,168,120,.28), transparent 60%),' +
              'radial-gradient(45% 55% at 10% 15%, rgba(247,243,238,.7), transparent 55%)',
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.05] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: '200px',
        }}
      />

      {/* ── Photo: full-bleed right (desktop) / top (mobile) ── */}
      <div className="absolute z-[1] md:top-0 md:right-0 md:bottom-0 md:left-auto md:w-1/2 md:h-full top-0 left-0 right-0 h-[52vh] overflow-hidden">
        <Image
          src="/media/profissionais/mykaele-principal.png"
          alt="Mykaele Procópio — Fisioterapeuta Dermatofuncional"
          fill
          priority
          quality={95}
          sizes="(max-width: 768px) 100vw, 55vw"
          className="object-cover object-[50%_18%]"
          style={{ filter: 'sepia(.05) saturate(1.04) contrast(1.03) brightness(1.02)' }}
        />
        {/* warm grade + blend into nude */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, var(--color-nude), rgba(239,232,223,0) 32%),' +
              'linear-gradient(0deg, rgba(42,37,33,.20), transparent 26%),' +
              'radial-gradient(80% 60% at 78% 22%, rgba(232,212,168,.15), transparent 60%)',
          }}
        />
        {/* mobile bottom fade */}
        <div className="md:hidden absolute inset-0" style={{ background: 'linear-gradient(0deg, var(--color-nude), rgba(239,232,223,0) 34%)' }} />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-[1500px] mx-auto px-6 md:px-14 pt-[40vh] md:pt-0">
        <div className="max-w-[600px]">
          {/* kicker */}
          <div className={show('delay-100')}>
            <span className="inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.42em] text-champagne mb-6">
              <span className="inline-block h-px w-10 bg-champagne" />
              Fisioterapia Dermatofuncional
            </span>
          </div>

          {/* headline */}
          <h1
            className="text-espresso font-[family-name:var(--font-display)] font-semibold leading-[0.98] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.9rem, 7vw, 6.4rem)' }}
          >
            <span className="block overflow-hidden py-[0.02em]">
              <span className={`block transition-transform duration-[1200ms] ${loaded ? 'translate-y-0' : 'translate-y-[110%]'}`}>
                Seu spa particular,
              </span>
            </span>
            <span className="block overflow-hidden py-[0.02em]">
              <span className={`block transition-transform duration-[1200ms] delay-100 ${loaded ? 'translate-y-0' : 'translate-y-[110%]'}`}>
                onde <em className="italic text-champagne">você</em> estiver.
              </span>
            </span>
          </h1>

          {/* lede (neuro) */}
          <p className={`mt-7 max-w-[440px] text-[16px] leading-[1.85] text-taupe font-[family-name:var(--font-body)] font-light ${show('delay-300')}`}>
            O spa de luxo vai até você. Resultados reais no conforto e na privacidade
            da sua casa — sem trânsito, sem sala de espera, sem exposição.
          </p>

          {/* CTAs */}
          <div className={`mt-9 flex flex-wrap gap-3.5 ${show('delay-500')}`}>
            <a
              href="#agendamento"
              className="group inline-flex items-center gap-2.5 px-6 py-3.5 bg-espresso text-porcelain text-[10px] font-semibold uppercase tracking-[0.22em] rounded-[3px] transition-colors duration-500 hover:bg-champagne font-[family-name:var(--font-body)]"
            >
              Agendar minha avaliação
              <span className="transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1">↗</span>
            </a>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3.5 text-taupe text-[10px] font-semibold uppercase tracking-[0.22em] rounded-[3px] border border-champagne/30 transition-colors duration-500 hover:text-espresso hover:border-champagne font-[family-name:var(--font-body)]"
            >
              Falar no WhatsApp
            </a>
          </div>

          {/* scarcity */}
          <p className={`mt-4 text-[11px] uppercase tracking-[0.16em] text-champagne ${show('delay-500')}`}>
            ● Agenda exclusiva — poucas vagas por semana
          </p>

          {/* trust */}
          <div className={`mt-7 flex items-center gap-3.5 ${show('delay-700')}`}>
            <span className="flex gap-[3px] text-champagne" aria-label="4,9 de 5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" />
                </svg>
              ))}
            </span>
            <span className="text-[12px] text-taupe font-[family-name:var(--font-body)]">
              <b className="text-espresso font-semibold">4,9</b> · +120 clientes atendidas em casa
            </span>
          </div>
        </div>
      </div>

      {/* ── Rotating seal ── */}
      <div className="absolute z-[4] md:left-1/2 md:-translate-x-[60px] md:bottom-12 right-4 bottom-[calc(52vh-52px)] md:right-auto grid place-items-center w-[120px] h-[120px] rounded-full" style={{ background: 'rgba(247,243,238,.8)', backdropFilter: 'blur(6px)', boxShadow: '0 16px 44px -22px rgba(42,37,33,.55)' }} aria-hidden>
        <svg viewBox="0 0 124 124" className="absolute inset-0 animate-[spin_24s_linear_infinite]">
          <defs><path id="hcirc" d="M62,62 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" /></defs>
          <text className="uppercase" style={{ fontFamily: 'var(--font-body)', fontSize: '10.4px', letterSpacing: '0.32em', fill: 'var(--color-espresso)', fontWeight: 500 }}>
            <textPath href="#hcirc" startOffset="0">HOME SPA · EXCLUSIVO · PRIVATIVO · </textPath>
          </text>
        </svg>
        <svg className="w-6 h-6 text-champagne" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" />
        </svg>
      </div>
    </section>
  )
}
