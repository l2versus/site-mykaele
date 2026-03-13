'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReportsContext, PeriodValue } from './ReportsContext'

const PRESETS: { value: PeriodValue; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

export function DateRangeFilter() {
  const { period, setPeriod, customStart, customEnd, setCustomRange } = useReportsContext()
  const [showCustom, setShowCustom] = useState(false)
  const [localStart, setLocalStart] = useState(customStart)
  const [localEnd, setLocalEnd] = useState(customEnd)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showCustom) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowCustom(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCustom])

  function applyCustomRange() {
    if (localStart && localEnd) {
      setCustomRange(localStart, localEnd)
      setShowCustom(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Preset buttons */}
      <div
        className="flex items-center gap-1 rounded-xl p-1"
        style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
      >
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{
              background: period === p.value ? 'var(--crm-gold-subtle)' : 'transparent',
              color: period === p.value ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range trigger */}
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setShowCustom((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all"
          style={{
            background: period === 'custom' ? 'var(--crm-gold-subtle)' : 'var(--crm-surface)',
            color: period === 'custom' ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
            border: '1px solid var(--crm-border)',
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {period === 'custom' && customStart && customEnd
            ? `${formatShort(customStart)} — ${formatShort(customEnd)}`
            : 'Personalizado'}
        </button>

        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 shadow-xl"
              style={{
                background: 'var(--crm-surface)',
                border: '1px solid var(--crm-border)',
                minWidth: 260,
              }}
            >
              <p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--crm-text)' }}>
                Selecionar Periodo
              </p>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-medium mb-1 block" style={{ color: 'var(--crm-text-muted)' }}>
                    Inicio
                  </label>
                  <input
                    type="date"
                    value={localStart}
                    onChange={(e) => setLocalStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none transition-all focus:ring-1"
                    style={{
                      background: 'var(--crm-bg)',
                      border: '1px solid var(--crm-border)',
                      color: 'var(--crm-text)',
                      // @ts-expect-error -- ring color CSS custom property
                      '--tw-ring-color': 'var(--crm-gold)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-medium mb-1 block" style={{ color: 'var(--crm-text-muted)' }}>
                    Fim
                  </label>
                  <input
                    type="date"
                    value={localEnd}
                    onChange={(e) => setLocalEnd(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none transition-all focus:ring-1"
                    style={{
                      background: 'var(--crm-bg)',
                      border: '1px solid var(--crm-border)',
                      color: 'var(--crm-text)',
                      // @ts-expect-error -- ring color CSS custom property
                      '--tw-ring-color': 'var(--crm-gold)',
                    }}
                  />
                </div>
                <button
                  onClick={applyCustomRange}
                  disabled={!localStart || !localEnd}
                  className="w-full py-2 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: 'var(--crm-gold)',
                    color: '#0A0A0B',
                  }}
                >
                  Aplicar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
