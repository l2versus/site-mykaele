'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import {
  DateRangeFilter, useReportsContext,
  ReportMetricCard, ReportChartCard, ReportChartTooltip,
  ExportCSVButton, ReportSkeleton,
} from '@/components/crm/reports'
import { ReportEmptyChart } from '@/components/crm/reports/ReportEmptyState'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const PIE_COLORS = ['#D4AF37', '#FF6B4A', '#4A7BFF', '#2ECC8A', '#F0A500', '#8B8A94', '#C4A030', '#7B68EE']

const INVESTMENT_SOURCES = [
  'Google Ads', 'Instagram Ads', 'Facebook Ads', 'TikTok Ads',
  'Indicacao', 'Organico', 'WhatsApp', 'Outro',
]

// ━━━ Types ━━━

interface RoiMetrics {
  totalInvestment: number
  totalRevenue: number
  roi: number | null
  costPerLead: number | null
  costPerConversion: number | null
  totalLeads: number
  wonCount: number
}

interface MonthlyData { label: string; investment: number; revenue: number; roi: number | null }
interface SourceBreakdown { source: string; amount: number }
interface SpendItem {
  id: string; month: number; year: number; monthLabel: string
  amount: number; source: string; notes: string | null
}

interface RoiData {
  metrics: RoiMetrics
  charts: { monthly: MonthlyData[]; sourceBreakdown: SourceBreakdown[] }
  spendList: SpendItem[]
}

// ━━━ Main ━━━

export default function RoiReportPage() {
  const { queryString, periodLabel } = useReportsContext()
  const [data, setData] = useState<RoiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(
        `/api/admin/crm/reports/roi?tenantId=${TENANT_ID}&${queryString}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAddSpend(form: { month: number; year: number; amount: number; source: string; notes: string }) {
    const token = localStorage.getItem('admin_token')
    const res = await fetch('/api/admin/crm/reports/roi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenantId: TENANT_ID, ...form }),
    })
    if (res.ok) {
      setShowAddForm(false)
      fetchData()
    }
  }

  async function handleDeleteSpend(id: string) {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`/api/admin/crm/reports/roi?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) fetchData()
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
  const { metrics, charts, spendList } = data

  const csvData = spendList.map(s => ({
    Mes: s.monthLabel, Fonte: s.source, Investimento: s.amount, Notas: s.notes ?? '',
  }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            ROI — Retorno sobre Investimento
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Analise de retorno — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeFilter />
          <ExportCSVButton data={csvData} filename={`roi-${periodLabel}`} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <ReportMetricCard
          label="Investimento"
          value={currencyFmt.format(metrics.totalInvestment)}
          icon={<span className="text-sm">💰</span>}
          accent="var(--crm-warm)"
        />
        <ReportMetricCard
          label="Receita"
          value={currencyFmt.format(metrics.totalRevenue)}
          subValue={`${metrics.wonCount} leads ganhos`}
          icon={<span className="text-sm">💎</span>}
          accent="var(--crm-won)"
          trend={metrics.totalRevenue > metrics.totalInvestment ? 'up' : metrics.totalInvestment > 0 ? 'down' : null}
        />
        <ReportMetricCard
          label="ROI"
          value={metrics.roi !== null ? `${metrics.roi}%` : '—'}
          subValue={metrics.roi !== null ? (metrics.roi > 0 ? 'Lucro' : 'Prejuizo') : 'Sem investimento'}
          icon={<span className="text-sm">📈</span>}
          accent={metrics.roi !== null ? (metrics.roi > 0 ? 'var(--crm-won)' : 'var(--crm-hot)') : 'var(--crm-text-muted)'}
          trend={metrics.roi !== null ? (metrics.roi > 0 ? 'up' : 'down') : null}
        />
        <ReportMetricCard
          label="Custo por Lead"
          value={metrics.costPerLead !== null ? currencyFmt.format(metrics.costPerLead) : '—'}
          subValue={`${metrics.totalLeads} leads`}
          icon={<span className="text-sm">👤</span>}
          accent="var(--crm-cold)"
        />
        <ReportMetricCard
          label="Custo por Conversao"
          value={metrics.costPerConversion !== null ? currencyFmt.format(metrics.costPerConversion) : '—'}
          subValue={`${metrics.wonCount} conversoes`}
          icon={<span className="text-sm">🎯</span>}
          accent="var(--crm-gold)"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Investimento vs Receita */}
        <ReportChartCard title="Investimento vs Receita" subtitle="Comparativo mensal">
          {charts.monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={50}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ReportChartTooltip formatter={(v) => currencyFmt.format(v)} />} />
                <Bar dataKey="investment" name="Investimento" fill="#F0A500" radius={[4, 4, 0, 0]} maxBarSize={35} />
                <Bar dataKey="revenue" name="Receita" fill="#2ECC8A" radius={[4, 4, 0, 0]} maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Sem dados mensais no periodo" />
          )}
        </ReportChartCard>

        {/* Tendência do ROI */}
        <ReportChartCard title="Tendencia do ROI" subtitle="Evolucao do retorno (%)">
          {charts.monthly.some(m => m.roi !== null) ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.monthly.filter(m => m.roi !== null)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<ReportChartTooltip formatter={(v) => `${v}%`} />} />
                <Line
                  type="monotone" dataKey="roi" name="ROI"
                  stroke="#D4AF37" strokeWidth={2.5} dot={{ r: 4, fill: '#D4AF37' }}
                  activeDot={{ r: 6, fill: '#D4AF37', stroke: '#0A0A0B', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Registre investimentos para ver o ROI" />
          )}
        </ReportChartCard>

        {/* Investimento por fonte */}
        <ReportChartCard title="Investimento por Fonte" subtitle="Distribuicao por canal">
          {charts.sourceBreakdown.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="45%" height={220}>
                <PieChart>
                  <Pie
                    data={charts.sourceBreakdown}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    paddingAngle={3}
                    dataKey="amount"
                    nameKey="source"
                    strokeWidth={0}
                  >
                    {charts.sourceBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ReportChartTooltip formatter={(v) => currencyFmt.format(v)} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {charts.sourceBreakdown.map((s, i) => (
                  <div key={s.source} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate" style={{ color: 'var(--crm-text)' }}>{s.source}</span>
                    </div>
                    <span className="font-semibold ml-2 shrink-0" style={{ color: 'var(--crm-text-muted)' }}>
                      {currencyFmt.format(s.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ReportEmptyChart message="Nenhum investimento registrado" />
          )}
        </ReportChartCard>

        {/* Tabela de investimentos */}
        <ReportChartCard
          title="Investimentos Registrados"
          subtitle="Gerenciar gastos em marketing"
          actions={
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-125"
              style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar
            </button>
          }
        >
          {spendList.length > 0 ? (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-thin">
              {spendList.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-lg text-xs"
                  style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}
                >
                  <div className="min-w-0">
                    <p className="font-medium" style={{ color: 'var(--crm-text)' }}>{s.source}</p>
                    <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                      {s.monthLabel}{s.notes ? ` — ${s.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-semibold" style={{ color: 'var(--crm-warm)' }}>
                      {currencyFmt.format(s.amount)}
                    </span>
                    <button
                      onClick={() => handleDeleteSpend(s.id)}
                      className="p-1 rounded-md transition-all hover:brightness-150 opacity-40 hover:opacity-100"
                      style={{ color: 'var(--crm-hot)' }}
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ReportEmptyChart message="Nenhum investimento registrado. Clique em Adicionar." />
          )}
        </ReportChartCard>
      </div>

      {/* Add Spend Modal */}
      <AnimatePresence>
        {showAddForm && (
          <AddSpendModal
            onClose={() => setShowAddForm(false)}
            onSave={handleAddSpend}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ━━━ Add Spend Modal ━━━

function AddSpendModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (form: { month: number; year: number; amount: number; source: string; notes: string }) => void
}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState(INVESTMENT_SOURCES[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    await onSave({ month, year, amount: Number(amount), source, notes })
    setSaving(false)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
      >
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--crm-text)' }}>Registrar Investimento</h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium mb-1 block" style={{ color: 'var(--crm-text-muted)' }}>
              Mes
            </label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
            >
              {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium mb-1 block" style={{ color: 'var(--crm-text-muted)' }}>
              Ano
            </label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-wider font-medium mb-1 block" style={{ color: 'var(--crm-text-muted)' }}>
            Fonte
          </label>
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
          >
            {INVESTMENT_SOURCES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-wider font-medium mb-1 block" style={{ color: 'var(--crm-text-muted)' }}>
            Valor (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Ex: 5000"
            className="w-full px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
            required
          />
        </div>

        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider font-medium mb-1 block" style={{ color: 'var(--crm-text-muted)' }}>
            Observacoes (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Campanha de verao"
            className="w-full px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
          />
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ color: 'var(--crm-text-muted)' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !amount}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--crm-gold)', color: '#0A0A0B' }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}
