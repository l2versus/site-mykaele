// src/components/StarRatingInput.tsx
// Componente de estrelas interativo estilo iFood
'use client'

import { useState, useCallback } from 'react'

interface StarRatingInputProps {
  value: number
  onChange: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
  showLabel?: boolean
  color?: string
}

const LABELS: Record<number, string> = {
  1: 'Péssimo',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Excelente',
}

const SIZES = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}

export default function StarRatingInput({
  value,
  onChange,
  size = 'md',
  readonly = false,
  showLabel = true,
  color = '#b76e79',
}: StarRatingInputProps) {
  const [hover, setHover] = useState(0)

  const handleClick = useCallback(
    (star: number) => {
      if (!readonly) onChange(star)
    },
    [readonly, onChange]
  )

  const active = hover || value

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`transition-all duration-200 ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-125 active:scale-95'
            } ${star <= active ? 'drop-shadow-[0_2px_4px_rgba(183,110,121,0.4)]' : ''}`}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(0)}
            onClick={() => handleClick(star)}
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
          >
            <svg
              className={`${SIZES[size]} transition-all duration-300 ${
                star <= active
                  ? 'scale-110'
                  : 'scale-100 opacity-30'
              }`}
              fill={star <= active ? color : 'currentColor'}
              viewBox="0 0 24 24"
              style={{
                filter: star <= active ? `drop-shadow(0 0 6px ${color}40)` : 'none',
                color: star <= active ? color : '#94a3b8',
              }}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ))}
      </div>

      {showLabel && active > 0 && (
        <span
          className="text-sm font-medium tracking-wide animate-[fadeIn_0.2s_ease-out]"
          style={{ color }}
        >
          {LABELS[active]}
        </span>
      )}
    </div>
  )
}

/* ─── Versão compacta inline para exibição (readonly) ─── */
export function StarRatingBadge({
  rating,
  count,
  size = 'sm',
}: {
  rating: number
  count?: number
  size?: 'xs' | 'sm'
}) {
  const stars = Math.round(rating)
  const sizeClass = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={`${sizeClass} ${
              i <= stars ? 'text-[#b76e79]' : 'text-[#e8dfd6]'
            }`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <span className="text-[12px] font-semibold text-[#b76e79]">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-[11px] text-[#8a8580]">({count})</span>
      )}
    </div>
  )
}

/* ─── Badge estilo iFood: pill com estrela + nota ─── */
export function IFoodRatingBadge({
  rating,
  count,
  variant = 'light',
}: {
  rating: number
  count?: number
  variant?: 'light' | 'dark'
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
        variant === 'dark'
          ? 'bg-[#2d2d2d] text-white'
          : 'bg-white shadow-sm border border-[#e8dfd6]/60'
      }`}
    >
      <svg className="w-3.5 h-3.5 text-[#b76e79]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span
        className={`text-[12px] font-bold ${
          variant === 'dark' ? 'text-white' : 'text-[#2d2d2d]'
        }`}
      >
        {rating.toFixed(1)}
      </span>
      {count !== undefined && (
        <span
          className={`text-[10px] ${
            variant === 'dark' ? 'text-white/50' : 'text-[#8a8580]'
          }`}
        >
          ({count}+)
        </span>
      )}
    </div>
  )
}
