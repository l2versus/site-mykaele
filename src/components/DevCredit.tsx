// src/components/DevCredit.tsx
'use client'

import Image from 'next/image'

interface DevCreditProps {
  /** Variante de cor para se adaptar ao fundo */
  variant?: 'dark' | 'light'
}

export function DevCredit({ variant = 'dark' }: DevCreditProps) {
  const isDark = variant === 'dark'

  return (
    <div className={`w-full py-6 ${isDark ? 'bg-[#0a0a0a]' : 'bg-stone-50'}`}>
      <a
        href="https://www.instagram.com/emmanuelbezerra_"
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center gap-3 group"
      >
        {/* Linha decorativa superior */}
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-8 h-[1px] ${isDark ? 'bg-white/10' : 'bg-stone-200'}`} />
          <svg
            className={`w-3.5 h-3.5 ${isDark ? 'text-rose-400/50' : 'text-rose-400/70'} group-hover:text-rose-400 transition-colors duration-500`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <div className={`w-8 h-[1px] ${isDark ? 'bg-white/10' : 'bg-stone-200'}`} />
        </div>

        {/* Texto */}
        <span
          className={`text-[11px] tracking-[0.2em] uppercase font-light ${
            isDark ? 'text-white/35 group-hover:text-white/55' : 'text-stone-400 group-hover:text-stone-500'
          } transition-colors duration-500`}
        >
          Desenvolvido com amor por
        </span>

        {/* Logo do desenvolvedor */}
        <div className={`mt-0.5 px-6 py-3 rounded-xl border ${
          isDark
            ? 'border-white/[0.06] bg-white/[0.02] group-hover:border-white/[0.12] group-hover:bg-white/[0.04]'
            : 'border-stone-200 bg-white group-hover:border-stone-300 group-hover:shadow-sm'
        } transition-all duration-500`}>
          <Image
            src="/media/logo-branding/logo-emmanuel.png"
            alt="Emmanuel Bezerra — Desenvolvedor Full Stack"
            width={220}
            height={55}
            className={`h-11 w-auto object-contain ${
              isDark ? 'brightness-200 opacity-70 group-hover:opacity-95' : 'opacity-75 group-hover:opacity-100'
            } transition-all duration-500`}
          />
        </div>
      </a>
    </div>
  )
}
