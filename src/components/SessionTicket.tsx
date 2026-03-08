'use client'

import { useRef, useCallback } from 'react'

/**
 * Mapeia o nome do serviço (vindo do banco) para a imagem de fundo do ticket.
 * As imagens já contêm o design, logo e título do serviço embutidos.
 */
function getTicketBackground(serviceName: string): string {
  const name = serviceName.toLowerCase()
  if (name.includes('método') || name.includes('metodo') || name.includes('mykaele'))
    return '/tickets/ticket_MetoMyka.png'
  if (name.includes('relaxante'))
    return '/tickets/ticket_Relaxante.png'
  if (name.includes('relief'))
    return '/tickets/ticket_Relief.png'
  if (name.includes('ritual') || name.includes('sculpt'))
    return '/tickets/ticket_RitualSculpt.png'
  if (name.includes('wellness') || name.includes('welness'))
    return '/tickets/ticket_Welness.png'
  return '/tickets/ticket_Welness.png'
}

interface SessionTicketProps {
  serviceName: string
  remaining: number
  total: number
  expirationDate?: string
}

export function SessionTicket({ serviceName, remaining, total, expirationDate }: SessionTicketProps) {
  const bg = getTicketBackground(serviceName)
  const validUntil = expirationDate
    ? new Date(expirationDate).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
    : 'Sem expiração'

  const cardRef = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const card = cardRef.current
    const glare = glareRef.current
    if (!card || !glare) return
    const rect = card.getBoundingClientRect()
    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top) / rect.height
    const rotateX = (y - 0.5) * -14
    const rotateY = (x - 0.5) * 14
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03,1.03,1.03)`
    glare.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.25) 0%, transparent 60%)`
    glare.style.opacity = '1'
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY)
  }, [handleMove])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) handleMove(touch.clientX, touch.clientY)
  }, [handleMove])

  const handleLeave = useCallback(() => {
    const card = cardRef.current
    const glare = glareRef.current
    if (card) card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'
    if (glare) glare.style.opacity = '0'
  }, [])

  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleLeave}
      className="relative w-full rounded-2xl overflow-hidden shadow-xl shadow-black/40 cursor-default select-none"
      style={{
        aspectRatio: '16 / 7',
        transition: 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
    >
      {/* Background ticket image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Glare overlay (mouse/touch tracking) */}
      <div
        ref={glareRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0, transition: 'opacity 0.3s ease', mixBlendMode: 'overlay' }}
      />

      {/* Holographic shimmer edge */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: 'inset 0 0 30px rgba(255,255,255,0.05)',
        }}
      />

      {/* Subtle vignette */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      {/* Mini progress bar */}
      <div className="absolute bottom-[44px] left-5 right-5 h-[3px] rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct > 50 ? 'linear-gradient(90deg, #c9a96e, #e8d5b7)' : 'linear-gradient(90deg, #d4849a, #e8b4c0)',
          }}
        />
      </div>

      {/* Dynamic data footer */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-3">
        <span className="text-[#e8d5b7] text-xs sm:text-sm font-semibold drop-shadow-lg tracking-wide">
          {remaining} / {total} {total === 1 ? 'sessão disponível' : 'sessões disponíveis'}
        </span>
        <span className="text-[#e8d5b7]/70 text-[10px] sm:text-xs font-medium drop-shadow-lg">
          Válido até: {validUntil}
        </span>
      </div>
    </div>
  )
}
