'use client'

import { useState } from 'react'

/** Tooltip de informação com ícone "?" que exibe texto explicativo ao clicar/hover. */
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex ml-1" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-4 h-4 rounded-full bg-stone-200 text-stone-400 text-[9px] font-bold flex items-center justify-center hover:bg-stone-300 transition-colors cursor-help">
        ?
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-stone-800 text-white text-[11px] leading-relaxed shadow-lg w-56 z-50 pointer-events-none animate-[fadeIn_0.15s_ease-out]">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-stone-800" />
        </div>
      )}
    </span>
  )
}
