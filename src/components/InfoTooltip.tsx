'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP_W = 224 // w-56 = 14rem = 224px
const MARGIN = 16     // margem de segurança das bordas da viewport

/** Tooltip de informação com ícone "?" que exibe texto explicativo ao clicar/hover.
 *  Renderiza via Portal para não ser cortado por overflow:hidden dos containers pais.
 *  Clamp horizontal: nunca vaza pelas laterais da tela. */
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, arrowOffset: 0 })

  const updatePos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const vw = window.innerWidth

    const top = r.top + window.scrollY - 8

    // Centro ideal do tooltip alinhado ao botão
    let left = r.left + r.width / 2 - TOOLTIP_W / 2

    // Clamp: não deixar vazar pela esquerda
    if (left < MARGIN) left = MARGIN
    // Clamp: não deixar vazar pela direita
    if (left + TOOLTIP_W > vw - MARGIN) left = vw - MARGIN - TOOLTIP_W

    // Seta sempre aponta para o centro do botão
    const btnCenter = r.left + r.width / 2
    const arrowOffset = Math.max(12, Math.min(TOOLTIP_W - 12, btnCenter - left))

    setPos({ top, left, arrowOffset })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  return (
    <span className="relative inline-flex ml-1">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full bg-white/10 text-white/30 text-[9px] font-bold flex items-center justify-center hover:bg-white/20 hover:text-white/50 transition-colors cursor-help"
      >
        ?
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={tipRef}
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            transform: 'translateY(-100%)',
            width: TOOLTIP_W,
            zIndex: 9999,
          }}
          className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-white/90 text-[11px] text-center leading-relaxed shadow-2xl pointer-events-none animate-[fadeIn_0.15s_ease-out]"
        >
          {text}
          <div
            className="absolute top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#1a1a1a]"
            style={{ left: pos.arrowOffset, transform: 'translateX(-50%)' }}
          />
        </div>,
        document.body
      )}
    </span>
  )
}
