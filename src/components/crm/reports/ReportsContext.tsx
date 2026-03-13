'use client'

import { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react'

export type PeriodValue = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom'

export interface DateRange {
  start: Date
  end: Date
}

interface ReportsContextValue {
  period: PeriodValue
  customStart: string
  customEnd: string
  setPeriod: (p: PeriodValue) => void
  setCustomRange: (start: string, end: string) => void
  dateRange: DateRange
  periodLabel: string
  /** Query string fragment: &period=7d or &start=...&end=... */
  queryString: string
}

const ReportsContext = createContext<ReportsContextValue | null>(null)

export function useReportsContext() {
  const ctx = useContext(ReportsContext)
  if (!ctx) throw new Error('useReportsContext must be used within ReportsProvider')
  return ctx
}

function computeDateRange(period: PeriodValue, customStart: string, customEnd: string): DateRange {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1)

  switch (period) {
    case 'today':
      return { start: todayStart, end: todayEnd }
    case 'yesterday': {
      const ys = new Date(todayStart.getTime() - 86400000)
      return { start: ys, end: new Date(todayStart.getTime() - 1) }
    }
    case '7d':
      return { start: new Date(todayStart.getTime() - 7 * 86400000), end: todayEnd }
    case '30d':
      return { start: new Date(todayStart.getTime() - 30 * 86400000), end: todayEnd }
    case '90d':
      return { start: new Date(todayStart.getTime() - 90 * 86400000), end: todayEnd }
    case 'custom': {
      const s = customStart ? new Date(customStart + 'T00:00:00') : new Date(todayStart.getTime() - 30 * 86400000)
      const e = customEnd ? new Date(customEnd + 'T23:59:59') : todayEnd
      return { start: s, end: e }
    }
  }
}

const PERIOD_LABELS: Record<PeriodValue, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  custom: 'Personalizado',
}

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodRaw] = useState<PeriodValue>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const setPeriod = useCallback((p: PeriodValue) => setPeriodRaw(p), [])
  const setCustomRange = useCallback((start: string, end: string) => {
    setCustomStart(start)
    setCustomEnd(end)
    setPeriodRaw('custom')
  }, [])

  const dateRange = useMemo(
    () => computeDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  )

  const periodLabel = period === 'custom' && customStart && customEnd
    ? `${new Date(customStart + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${new Date(customEnd + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
    : PERIOD_LABELS[period]

  const queryString = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) {
      return `period=custom&start=${customStart}&end=${customEnd}`
    }
    return `period=${period}`
  }, [period, customStart, customEnd])

  const value = useMemo(
    () => ({ period, customStart, customEnd, setPeriod, setCustomRange, dateRange, periodLabel, queryString }),
    [period, customStart, customEnd, setPeriod, setCustomRange, dateRange, periodLabel, queryString]
  )

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
}
