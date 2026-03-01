'use client'

import { useEffect, useRef, useCallback } from 'react'

// ═══ Main scroll reveal observer (bidirecional: anima ao descer E ao subir) ═══
export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            // Anima apenas uma vez — evita re-paints custosos ao rolar
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )

    const selectors = [
      '.reveal', '.reveal-left', '.reveal-right', '.reveal-scale',
      '.reveal-blur', '.reveal-clip-up', '.reveal-clip-left', '.reveal-clip-right',
      '.reveal-rotate', '.reveal-fade',
      '.stagger-children', '.stagger-left', '.stagger-scale',
      '.img-reveal', '.line-grow', '.line-draw-h', '.line-draw-v',
      '.text-reveal',
    ]
    const elements = document.querySelectorAll(selectors.join(', '))
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])
}

// ═══ Parallax on scroll ═══
export function useParallax() {
  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          document.querySelectorAll<HTMLElement>('.parallax-slow').forEach((el) => {
            const speed = parseFloat(el.dataset.speed || '0.3')
            const rect = el.getBoundingClientRect()
            const center = rect.top + rect.height / 2
            const offset = (center - window.innerHeight / 2) * speed
            el.style.transform = `translateY(${offset}px)`
          })
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
}

// ═══ Counter animation (numbers count up on scroll) ═══
export function useCounterAnimation() {
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const target = parseInt(el.dataset.target || '0', 10)
            const suffix = el.dataset.suffix || ''
            const duration = 2000
            const start = performance.now()

            const animate = (now: number) => {
              const elapsed = now - start
              const progress = Math.min(elapsed / duration, 1)
              // easeOutExpo
              const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
              const current = Math.round(eased * target)
              el.textContent = current + suffix
              if (progress < 1) requestAnimationFrame(animate)
            }
            requestAnimationFrame(animate)
            observerRef.current?.unobserve(el)
          }
        })
      },
      { threshold: 0.5 }
    )

    document.querySelectorAll('[data-counter]').forEach((el) => {
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])
}
