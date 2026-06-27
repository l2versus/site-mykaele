// src/components/Preloader.tsx
// Abertura do site v2 — contador 0→100% e sobe revelando o hero. Respeita reduced-motion.
'use client'

import { useEffect, useState } from 'react'

export default function Preloader() {
  const [pct, setPct] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHidden(true)
      return
    }
    // trava o scroll enquanto a abertura roda
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    let v = 0
    const id = window.setInterval(() => {
      v += Math.random() * 9 + 4
      if (v >= 100) {
        v = 100
        window.clearInterval(id)
        setPct(100)
        window.setTimeout(() => setLeaving(true), 300)
        window.setTimeout(() => {
          setHidden(true)
          document.body.style.overflow = prevOverflow
        }, 1300)
      } else {
        setPct(Math.round(v))
      }
    }, 95)

    return () => {
      window.clearInterval(id)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  if (hidden) return null

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] bg-espresso grid place-items-center transition-transform duration-[1000ms] ${leaving ? '-translate-y-full' : 'translate-y-0'}`}
      style={{ transitionTimingFunction: 'cubic-bezier(.76,0,.24,1)' }}
    >
      <div className="text-center px-6">
        <div className="font-[family-name:var(--font-display)] text-porcelain leading-tight" style={{ fontSize: 'clamp(1.7rem,4.2vw,2.8rem)' }}>
          Mykaele <em className="italic text-champagne-lt">Procópio</em>
        </div>
        <div className="mx-auto mt-6 h-px overflow-hidden bg-porcelain/20" style={{ width: 'min(260px,62vw)' }}>
          <div className="h-full bg-champagne-lt transition-[width] duration-100 ease-linear" style={{ width: pct + '%' }} />
        </div>
        <div className="mt-4 text-champagne-lt text-[12px] tracking-[0.4em] font-[family-name:var(--font-body)] font-medium">
          {pct}%
        </div>
      </div>
    </div>
  )
}
