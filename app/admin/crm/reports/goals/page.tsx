'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import {
  ReportChartCard, ReportChartTooltip, ExportCSVButton, ReportSkeleton,
} from '@/components/crm/reports'
import { ReportEmptyChart } from '@/components/crm/reports/ReportEmptyState'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

interface GoalResult {
  id: string | null; type: string; label: string; unit: string
  targetValue: number; currentValue: number; progress: number
  projected: number | null; willHitTarget: boolean | null; isConfigured: boolean
}
interface DailyPoint { day: string; count: number; cumulative: number }
interface GoalType { key: string; label: string; unit: string }

interface GoalsData {
  month: number; year: number; daysInMonth: number; daysElapsed: number
  goals: GoalResult[]; dailyProgress: DailyPoint[]; goalTypes: GoalType[]
}

function formatValue(value: number, unit: string): string {
  if (unit === 'currency') return currencyFmt.format(value)
  if (unit === 'minutes') return `${Math.round(value)}min`
  return String(Math.round(value))
}

function formatDayLabel(d: string) {
  return new Date(d + 'T12:00:00').getDate().toString()
}

export default function GoalsReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<GoalsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(
        `/api/admin/crm/reports/goals?tenantId=${TENANT_ID}&month=${month}&year=${year}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [month, year])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSaveGoal(type: string, targetValue: number) {
    const token = localStorage.getItem('admin_token')
    await fetch('/api/admin/crm/reports/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenantId: TENANT_ID, type, targetValue, month, year }),
    })
    fetchData()
  }

  if (loading && !data) return <ReportSkeleton />
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--crm-hot)' }}>Erro ao carregar</p>
        <p className="text-xs mb-5" style={{ color: 'var(--crm-text-muted)' }}>{error}</p>
        <button onClick={fetchData} className="px-5 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}>
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!data) return null

  const { goals, dailyProgress, daysInMonth, daysElapsed } = data
  const configuredGoals = goals.filter(g => g.isConfigured)
  const leadsGoal = goals.find(g => g.type === 'leads_generated')

  const csvData = goals.map(g => ({
    Meta: g.label, Alvo: g.targetValue, Atual: g.currentValue,
    'Progresso (%)': g.progress, Projecao: g.projected ?? 'N/A',
    'Vai bater?': g.willHitTarget === null ? 'N/A' : g.willHitTarget ? 'Sim' : 'Nao',
  }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            Metas
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Objetivos de {MONTH_NAMES[month]} {year} — Dia {daysElapsed} de {daysInMonth}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Month selector */}
          <div className="flex items-center gap-1.5 rounded-xl p-1" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
            <button
              onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
              className="px-2 py-1 rounded-lg text-[11px]" style={{ color: 'var(--crm-text-muted)' }}
            >
              ←
            </button>
            <span className="px-2 text-[11px] font-medium min-w-[100px] text-center" style={{ color: 'var(--crm-text)' }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
              className="px-2 py-1 rounded-lg text-[11px]" style={{ color: 'var(--crm-text-muted)' }}
            >
              →
            </button>
          </div>
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:brightness-125"
            style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            Configurar Metas
          </button>
          <ExportCSVButton data={csvData} filename={`metas-${MONTH_NAMES[month]}-${year}`} />
        </div>
      </div>

      {/* Goal progress cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {goals.map((goal, i) => {
          const progressColor = !goal.isConfigured ? 'var(--crm-text-muted)'
            : goal.progress >= 100 ? 'var(--crm-won)'
            : goal.progress >= 70 ? 'var(--crm-gold)'
            : goal.progress >= 40 ? 'var(--crm-warm)'
            : 'var(--crm-hot)'

          return (
            <motion.div
              key={goal.type}
              className="rounded-2xl p-5 relative overflow-hidden"
              style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {!goal.isConfigured && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] rounded-2xl z-10">
                  <span className="text-[11px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--crm-surface)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}>
                    Meta nao configurada
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--crm-text-muted)' }}>
                    {goal.label}
                  </p>
                  <p className="text-xl font-bold mt-1" style={{ color: progressColor }}>
                    {formatValue(goal.currentValue, goal.unit)}
                  </p>
                </div>
                {goal.isConfigured && (
                  <div className="text-right">
                    <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Meta</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                      {formatValue(goal.targetValue, goal.unit)}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--crm-bg)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: progressColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(goal.progress, 100)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold" style={{ color: progressColor }}>
                  {goal.progress}%
                </span>
                {goal.projected !== null && goal.isConfigured && (
                  <span style={{ color: 'var(--crm-text-muted)' }}>
                    Projecao: {formatValue(goal.projected, goal.unit)}
                    {goal.willHitTarget !== null && (
                      <span className="ml-1" style={{ color: goal.willHitTarget ? 'var(--crm-won)' : 'var(--crm-hot)' }}>
                        {goal.willHitTarget ? '✓' : '✕'}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Evolution chart */}
      <ReportChartCard
        title="Evolucao de Leads no Mes"
        subtitle={leadsGoal?.isConfigured ? `Meta: ${leadsGoal.targetValue} leads` : 'Configure a meta de leads para ver a linha de referencia'}
      >
        {dailyProgress.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyProgress}>
              <defs>
                <linearGradient id="gradCum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
              <XAxis dataKey="day" tickFormatter={formatDayLabel} tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <Tooltip content={<ReportChartTooltip />} />
              {leadsGoal?.isConfigured && (
                <ReferenceLine
                  y={leadsGoal.targetValue}
                  stroke="#2ECC8A"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{ value: 'Meta', position: 'insideTopRight', fill: '#2ECC8A', fontSize: 10 }}
                />
              )}
              <Area type="monotone" dataKey="cumulative" name="Leads Acumulados" stroke="#D4AF37" fill="url(#gradCum)" strokeWidth={2} />
              <Area type="monotone" dataKey="count" name="Leads/Dia" stroke="#4A7BFF" fill="none" strokeWidth={1} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ReportEmptyChart message="Sem dados para o mes selecionado" />
        )}
      </ReportChartCard>

      {/* Config modal */}
      <AnimatePresence>
        {showConfig && (
          <GoalConfigModal
            goals={goals}
            month={month}
            year={year}
            onClose={() => setShowConfig(false)}
            onSave={handleSaveGoal}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ━━━ Config Modal ━━━

function GoalConfigModal({
  goals, month, year, onClose, onSave,
}: {
  goals: GoalResult[]; month: number; year: number
  onClose: () => void
  onSave: (type: string, targetValue: number) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const g of goals) {
      v[g.type] = g.targetValue > 0 ? String(g.targetValue) : ''
    }
    return v
  })
  const [saving, setSaving] = useState<string | null>(null)

  async function handleSave(type: string) {
    const val = Number(values[type])
    if (!val || val <= 0) return
    setSaving(type)
    await onSave(type, val)
    setSaving(null)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
      >
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--crm-text)' }}>
          Configurar Metas
        </h3>
        <p className="text-[11px] mb-5" style={{ color: 'var(--crm-text-muted)' }}>
          {MONTH_NAMES[month]} {year}
        </p>

        <div className="space-y-3">
          {goals.map(g => (
            <div key={g.type} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] uppercase tracking-wider font-medium block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                  {g.label}
                </label>
                <input
                  type="number"
                  step={g.unit === 'currency' ? '100' : '1'}
                  min="0"
                  value={values[g.type] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [g.type]: e.target.value }))}
                  placeholder={g.unit === 'currency' ? 'Ex: 50000' : g.unit === 'minutes' ? 'Ex: 15' : 'Ex: 100'}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
                />
              </div>
              <button
                onClick={() => handleSave(g.type)}
                disabled={saving === g.type || !values[g.type]}
                className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 mt-4"
                style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}
              >
                {saving === g.type ? '...' : 'Salvar'}
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
