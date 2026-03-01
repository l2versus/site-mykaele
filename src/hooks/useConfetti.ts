'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Confetti — Celebration animation for milestones
 * Triggers on treatment completion, package milestones, etc.
 * Zero-dependency, canvas-based for 60fps performance
 */

interface ConfettiOptions {
  count?: number
  colors?: string[]
  duration?: number
}

const DEFAULT_COLORS = ['#b76e79', '#d4a0a7', '#8a4f5a', '#e8c4c8', '#f5f0eb', '#FFD700', '#FF69B4']

export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animRef = useRef<number>(0)

  // Ensure canvas exists
  useEffect(() => {
    let canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.id = 'confetti-canvas'
      canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;width:100%;height:100%'
      document.body.appendChild(canvas)
    }
    canvasRef.current = canvas
    return () => {
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  const fire = useCallback(({ count = 80, colors = DEFAULT_COLORS, duration = 3000 }: ConfettiOptions = {}) => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    interface Particle {
      x: number; y: number; vx: number; vy: number
      w: number; h: number; color: string
      rotation: number; rotationSpeed: number
      opacity: number; gravity: number
      shape: 'rect' | 'circle' | 'star'
    }

    const particles: Particle[] = Array.from({ length: count }, () => {
      const shapes: Particle['shape'][] = ['rect', 'circle', 'star']
      return {
        x: window.innerWidth * 0.5 + (Math.random() - 0.5) * 200,
        y: window.innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 15,
        vy: Math.random() * -18 - 5,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
        gravity: 0.4 + Math.random() * 0.2,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      }
    })

    const startTime = Date.now()

    const draw = () => {
      const elapsed = Date.now() - startTime
      if (elapsed > duration) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        p.x += p.vx
        p.vy += p.gravity
        p.y += p.vy
        p.vx *= 0.99
        p.rotation += p.rotationSpeed
        p.opacity = Math.max(0, 1 - elapsed / duration)

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color

        if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        } else if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // Star
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
            const r = i === 0 ? p.w : p.w
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
          }
          ctx.fill()
        }

        ctx.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
  }, [])

  return { fire }
}
