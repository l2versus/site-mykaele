// src/components/ResultadosReais.tsx
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// Fotos compostas: antes (metade de cima) + depois (metade de baixo) na mesma imagem
// O slider mostra SÓ o antes e ao arrastar revela SÓ o depois
const RESULTADOS = [
  { id: 1, src: '/media/antes-depois/compostos/resultado-1.jpg', titulo: 'Remodelação Abdominal', protocolo: 'Método Mykaele Procópio' },
  { id: 2, src: '/media/antes-depois/compostos/resultado-2.jpg', titulo: 'Escultura Corporal', protocolo: 'Arquitetura Corporal' },
  { id: 3, src: '/media/antes-depois/compostos/resultado-3.jpg', titulo: 'Contorno Corporal', protocolo: 'Método Mykaele Procópio' },
  { id: 4, src: '/media/antes-depois/compostos/resultado-4.jpg?v=2', titulo: 'Definição Abdominal', protocolo: 'Alta Performance' },
]

// ━━━ Card com efeito slider: mostra ANTES, arrasta pra revelar DEPOIS ━━━
// Usa a foto composta e object-position para exibir apenas metade por vez
function BeforeAfterCard({ resultado, size = 'normal' }: { resultado: typeof RESULTADOS[0]; size?: 'normal' | 'large' }) {
  // sliderY = 100 → mostra 100% ANTES (tudo coberto pelo antes)
  // sliderY = 0 → mostra 100% DEPOIS (antes sumiu, depois aparece)
  const [sliderY, setSliderY] = useState(100)
  const [isDragging, setIsDragging] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [imgError, setImgError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const updateSlider = useCallback((clientY: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = ((clientY - rect.top) / rect.height) * 100
    setSliderY(Math.max(2, Math.min(98, pct)))
    if (!hasInteracted) setHasInteracted(true)
  }, [hasInteracted])

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (isDragging) { e.preventDefault(); updateSlider(e.clientY) } }
    const onTouchMove = (e: TouchEvent) => { if (isDragging) { e.preventDefault(); updateSlider(e.touches[0].clientY) } }
    const onEnd = () => setIsDragging(false)
    if (isDragging) {
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onEnd)
      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onEnd)
    }
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [isDragging, updateSlider])

  if (imgError) return null

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className={`relative w-full aspect-[3/4] overflow-hidden rounded-md bg-[#1a1a1a] select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); updateSlider(e.clientY) }}
        onTouchStart={(e) => { setIsDragging(true); updateSlider(e.touches[0].clientY) }}
      >
        {/* ━━ Camada de baixo: DEPOIS (metade inferior da foto composta) ━━ */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={resultado.src}
            alt={`${resultado.titulo} - Depois`}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '200%',
              bottom: 0,
              left: 0,
              objectFit: 'cover',
              objectPosition: 'center bottom',
            }}
          />
        </div>

        {/* ━━ Camada de cima: ANTES (metade superior da foto composta) — clipa com slider ━━ */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 ${100 - sliderY}% 0)`, zIndex: 2 }}
        >
          <img
            src={resultado.src}
            alt={`${resultado.titulo} - Antes`}
            style={{
              position: 'absolute',
              width: '100%',
              height: '200%',
              top: 0,
              left: 0,
              objectFit: 'cover',
              objectPosition: 'center top',
            }}
          />
        </div>

        {/* ━━ Linha do slider + handle arrastável ━━ */}
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: `${sliderY}%`, transform: 'translateY(-50%)' }}
        >
          <div className="h-[2px] bg-white/80 shadow-lg" />
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-2xl flex items-center justify-center transition-transform duration-150 ${isDragging ? 'scale-110' : 'scale-100'}`}>
            <svg className="w-4 h-4 text-[#2d2d2d] rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4" />
            </svg>
          </div>
        </div>

        {/* ━━ Label ANTES (fixo no topo) ━━ */}
        {sliderY > 15 && (
          <span className="absolute top-4 left-4 text-xs font-semibold tracking-[0.15em] uppercase text-white bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded z-20 pointer-events-none">
            Antes
          </span>
        )}

        {/* ━━ Label DEPOIS (fixo embaixo) ━━ */}
        {sliderY < 85 && (
          <span className="absolute bottom-16 left-4 text-xs font-semibold tracking-[0.15em] uppercase text-white bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded z-20 pointer-events-none">
            Depois
          </span>
        )}

        {/* ━━ Dica de arraste (some após primeira interação) ━━ */}
        {!hasInteracted && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
            <div className="flex flex-col items-center animate-bounce">
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              <span className="text-[10px] text-white/50 tracking-wider uppercase mt-1">Arraste</span>
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* ━━ Info no rodapé ━━ */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-20">
          <p className="text-sm font-light text-white">{resultado.titulo}</p>
          <p className="text-[11px] text-[#d4a0a7] tracking-[0.15em] uppercase mt-1">{resultado.protocolo}</p>
        </div>
      </div>
    </div>
  )
}

export default function ResultadosReais() {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <section id="resultados" className="relative bg-nude overflow-hidden">
      {/* Header */}
      <div className="pt-28 pb-8 md:pt-32 md:pb-10 border-b border-champagne/15">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="reveal-blur">
              <span className="text-xs font-medium tracking-[0.3em] uppercase text-champagne block mb-8">
                Antes & Depois
              </span>
              <h2 className="text-[clamp(2rem,4.4vw,3.4rem)] font-[family-name:var(--font-display)] font-medium leading-[1.08] tracking-[-0.02em] text-espresso">
                Transformações que
                <br />falam por si.
              </h2>
              <div className="flex items-center gap-2 mt-6">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-taupe">Clientes atendidas em casa</span>
              </div>
            </div>
            <div className="reveal-blur delay-300 flex items-end">
              <p className="text-[16px] text-taupe leading-[1.85] max-w-md">
                Cada transformação nasceu no conforto da casa da cliente — o Método Mykaele Procópio levado até você, com privacidade absoluta.
                Redução de medidas perceptível desde a primeira sessão.
                <br />
                <span className="text-[13px] font-medium text-champagne mt-2.5 block">↕ Arraste para comparar antes e depois</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-16 md:py-20">
        {selectedIdx !== null ? (
          /* ━━━ MODO AMPLIADO ━━━ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <BeforeAfterCard resultado={RESULTADOS[selectedIdx]} size="large" />
              <div className="flex items-center justify-between mt-6">
                <div>
                  <p className="text-base font-light text-white">{RESULTADOS[selectedIdx].titulo}</p>
                  <p className="text-xs text-[#d4a0a7] tracking-wider uppercase mt-1">{RESULTADOS[selectedIdx].protocolo}</p>
                </div>
                <button onClick={() => setSelectedIdx(null)}
                  className="text-xs text-white/50 tracking-[0.15em] uppercase hover:text-white/80 transition-colors">
                  ← Ver todos
                </button>
              </div>
            </div>
            <div className="lg:col-span-4">
              <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                {RESULTADOS.map((r, idx) => (
                  <button key={r.id} onClick={() => setSelectedIdx(idx)}
                    className={`relative aspect-[3/4] overflow-hidden rounded-sm transition-all duration-300 ${
                      selectedIdx === idx ? 'ring-1 ring-[#b76e79] opacity-100' : 'opacity-40 hover:opacity-70'
                    }`}>
                    <img src={r.src} alt={r.titulo} className="w-full h-full object-cover object-top" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ━━━ GALERIA COM SLIDER ━━━ */
          <div>
            <div ref={scrollRef}
              className="stagger-scale grid grid-cols-2 md:grid-cols-4 gap-4">
              {RESULTADOS.map((r, idx) => (
                <div key={r.id} onDoubleClick={() => setSelectedIdx(idx)}>
                  <BeforeAfterCard resultado={r} />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-8">
              <p className="text-xs text-taupe tracking-[0.15em] uppercase">
                {RESULTADOS.length} transformações reais
              </p>
              <p className="text-xs text-taupe font-light">
                Arraste ↕ para comparar · Duplo clique para ampliar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="border-t border-champagne/15 py-16">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 text-center">
          <a href="#agendamento"
            className="reveal-blur inline-flex items-center gap-4 px-8 py-4 bg-espresso text-porcelain text-xs font-medium tracking-[0.2em] uppercase hover:bg-champagne transition-all duration-500 rounded-sm">
            Agendar minha avaliação em casa
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
