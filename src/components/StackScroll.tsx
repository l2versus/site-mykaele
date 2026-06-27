// src/components/StackScroll.tsx
// Stacking "cada dobra sobe sobre a anterior" (Apple-style): a dobra que sai
// escala + escurece conforme a próxima sobe. Só desktop, respeita reduced-motion.
'use client'

import { useEffect } from 'react'

export default function StackScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(min-width: 921px)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cleanup = () => {}

    ;(async () => {
      const gmod = (await import('gsap')) as Record<string, unknown>
      const gsap = (gmod.gsap ?? gmod.default) as typeof import('gsap').gsap
      const stmod = (await import('gsap/ScrollTrigger')) as Record<string, unknown>
      const ScrollTrigger = (stmod.ScrollTrigger ?? stmod.default) as typeof import('gsap/ScrollTrigger').ScrollTrigger
      if (!gsap || !ScrollTrigger) {
        console.error('[StackScroll] gsap/ScrollTrigger não carregaram', { gsap: !!gsap, ScrollTrigger: !!ScrollTrigger })
        return
      }
      gsap.registerPlugin(ScrollTrigger)

      const panels = gsap.utils.toArray<HTMLElement>('.stack-panel')
      const tweens = panels.map((p, i) => {
        if (i === panels.length - 1) return null
        return gsap.to(p, {
          scale: 0.92,
          opacity: 0.45,
          filter: 'blur(3px)',
          transformOrigin: '50% 25%',
          ease: 'none',
          scrollTrigger: {
            trigger: panels[i + 1],
            start: 'top bottom',
            end: 'top top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        })
      })

      const refresh = () => ScrollTrigger.refresh()
      window.addEventListener('load', refresh)
      const t1 = window.setTimeout(refresh, 500)
      const t2 = window.setTimeout(refresh, 1500)

      cleanup = () => {
        window.removeEventListener('load', refresh)
        window.clearTimeout(t1)
        window.clearTimeout(t2)
        tweens.forEach((t) => {
          const st = t && (t.scrollTrigger as { kill?: () => void } | undefined)
          if (st && st.kill) st.kill()
        })
      }
    })()

    return () => cleanup()
  }, [])

  return null
}
