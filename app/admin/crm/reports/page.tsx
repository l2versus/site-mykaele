'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  DateRangeFilter, useReportsContext,
  ReportMetricCard, ReportChartCard, ReportChartTooltip,
  ExportCSVButton, ReportSkeleton,
} from '@/components/crm/reports'
import { ReportEmptyChart } from '@/components/crm/reports/ReportEmptyState'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

const PIE_COLORS = ['#D4AF37', '#FF6B4A', '#4A7BFF', '#2ECC8A', '#F0A500', '#8B8A94', '#C4A030', '#7B68EE']

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pctFmt = (v: number) => `${v.toFixed(1)}%`

// ━━━ Types ━━━

interface OverviewMetrics {
  totalLeads: number
  wonCount: number
  wonValue: number
  lostCount: number
  lostValue: number
  conversionRate: number
  avgTicket: number
  avgCloseDays: number | null
}

interface TimelinePoint { day: string; created: number; won: number }
interface StageData {
  id: string; name: string; color: string | null; type: string
  order: number; leadCount: number; totalValue: number; pipeline: string
}
interface SourceData { name: string; count: number; value: number }

interface OverviewData {
  metrics: OverviewMetrics
  charts: {
    timeline: TimelinePoint[]
    stages: StageData[]
    sources: SourceData[]
  }
}

// ━━━ Helpers ━━━

function formatDayLabel(dayStr: string): string {
  const d = new Date(dayStr + 'T12:00:00')
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  return `${weekdays[d.getDay()]} ${d.getDate()}`
}

// ━━━ Report links ━━━

const REPORT_LINKS = [
  { href: '/admin/crm/reports/roi', label: 'ROI', accent: 'var(--crm-won)' },
  { href: '/admin/crm/reports/wins-losses', label: 'Ganhos e Perdas', accent: 'var(--crm-gold)' },
  { href: '/admin/crm/reports/consolidated', label: 'Consolidado', accent: 'var(--crm-warm)' },
  { href: '/admin/crm/reports/activities', label: 'Atividades', accent: 'var(--crm-cold)' },
  { href: '/admin/crm/reports/communications', label: 'Comunicacoes', accent: 'var(--crm-hot)' },
  { href: '/admin/crm/reports/goals', label: 'Metas', accent: '#D4AF37' },
]

// ━━━ Main ━━━

export default function ReportsOverviewPage() {
  const { queryString, periodLabel } = useReportsContext()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(
        `/api/admin/crm/reports/overview?tenantId=${TENANT_ID}&${queryString}`,
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

  if (loading && !data) return <ReportSkeleton />

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(255,107,74,0.08)', border: '1px solid rgba(255,107,74,0.15)' }}>
          <svg width="24" height="24" fill="none" stroke="#FF6B4A" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--crm-hot)' }}>Erro ao carregar</p>
        <p className="text-xs mb-5" style={{ color: 'var(--crm-text-muted)' }}>{error}</p>
        <button onClick={fetchData} className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-125"
          style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  const { metrics, charts } = data

  // CSV export data
  const csvMetrics = [{
    'Total Leads': metrics.totalLeads,
    'Leads Ganhos': metrics.wonCount,
    'Valor Ganho (R$)': metrics.wonValue,
    'Leads Perdidos': metrics.lostCount,
    'Valor Perdido (R$)': metrics.lostValue,
    'Taxa Conversao (%)': metrics.conversionRate,
    'Ticket Medio (R$)': metrics.avgTicket,
    'Tempo Medio Fechamento (dias)': metrics.avgCloseDays ?? 'N/A',
  }]

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            Painel Geral
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Visao consolidada — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeFilter />
          <ExportCSVButton data={csvMetrics} filename={`relatorio-geral-${periodLabel}`} />
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <ReportMetricCard
          label="Total de Leads"
          value={String(metrics.totalLeads)}
          icon={<span className="text-sm">👥</span>}
          accent="var(--crm-gold)"
        />
        <ReportMetricCard
          label="Leads Ganhos"
          value={String(metrics.wonCount)}
          subValue={currencyFmt.format(metrics.wonValue)}
          icon={<span className="text-sm">🏆</span>}
          accent="var(--crm-won)"
          trend={metrics.wonCount > 0 ? 'up' : null}
        />
        <ReportMetricCard
          label="Leads Perdidos"
          value={String(metrics.lostCount)}
          subValue={currencyFmt.format(metrics.lostValue)}
          icon={<span className="text-sm">✕</span>}
          accent="var(--crm-hot)"
          trend={metrics.lostCount > 0 ? 'down' : null}
        />
        <ReportMetricCard
          label="Taxa Conversao"
          value={pctFmt(metrics.conversionRate)}
          subValue={`${metrics.wonCount} de ${metrics.wonCount + metrics.lostCount} fechados`}
          icon={<span className="text-sm">📊</span>}
          accent={metrics.conversionRate >= 30 ? 'var(--crm-won)' : metrics.conversionRate >= 15 ? 'var(--crm-warm)' : 'var(--crm-hot)'}
        />
        <ReportMetricCard
          label="Ticket Medio"
          value={metrics.avgTicket > 0 ? currencyFmt.format(metrics.avgTicket) : '—'}
          icon={<span className="text-sm">💎</span>}
          accent="var(--crm-gold)"
        />
        <ReportMetricCard
          label="Tempo Fechamento"
          value={metrics.avgCloseDays !== null ? `${metrics.avgCloseDays}d` : '—'}
          subValue="media em dias"
          icon={<span className="text-sm">⏱</span>}
          accent="var(--crm-cold)"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Leads criados vs ganhos */}
        <ReportChartCard title="Leads Criados vs Ganhos" subtitle="Evolucao ao longo do periodo">
          {charts.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={charts.timeline}>
                <defs>
                  <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradWon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ECC8A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2ECC8A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatDayLabel}
                  tick={{ fontSize: 10, fill: '#8B8A94' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#8B8A94' }}
                  axisLine={false} tickLine={false} width={30}
                  allowDecimals={false}
                />
                <Tooltip content={<ReportChartTooltip />} />
                <Area type="monotone" dataKey="created" name="Criados" stroke="#D4AF37" fill="url(#gradCreated)" strokeWidth={2} />
                <Area type="monotone" dataKey="won" name="Ganhos" stroke="#2ECC8A" fill="url(#gradWon)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Nenhum lead no periodo" />
          )}
        </ReportChartCard>

        {/* Leads por estágio */}
        <ReportChartCard title="Leads por Estagio" subtitle="Distribuicao atual no pipeline">
          {charts.stages.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.stages}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#8B8A94' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#8B8A94' }}
                  axisLine={false} tickLine={false} width={30}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ReportChartTooltip formatter={(v, name) =>
                    name === 'Valor' ? currencyFmt.format(v) : String(v)
                  } />}
                />
                <Bar dataKey="leadCount" name="Leads" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {charts.stages.map((s, i) => (
                    <Cell key={i} fill={s.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Nenhum estagio configurado" />
          )}
        </ReportChartCard>

        {/* Leads por fonte */}
        <ReportChartCard title="Leads por Fonte" subtitle="Origem dos leads no periodo">
          {charts.sources.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie
                    data={charts.sources}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={85}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                    strokeWidth={0}
                  >
                    {charts.sources.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ReportChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {charts.sources.slice(0, 7).map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate" style={{ color: 'var(--crm-text)' }}>{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="font-semibold" style={{ color: 'var(--crm-text-muted)' }}>{s.count}</span>
                      {s.value > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--crm-gold)' }}>
                          {currencyFmt.format(s.value)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ReportEmptyChart message="Nenhuma fonte de lead cadastrada" />
          )}
        </ReportChartCard>

        {/* Quick links to other reports */}
        <ReportChartCard title="Relatorios Detalhados" subtitle="Acesse relatorios especificos">
          <div className="grid grid-cols-2 gap-2">
            {REPORT_LINKS.map((r, i) => (
              <motion.div
                key={r.href}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.03 }}
              >
                <Link
                  href={r.href}
                  className="flex items-center gap-2 p-3 rounded-xl text-[11px] font-medium transition-all hover:brightness-110"
                  style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text-muted)' }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.accent }} />
                  {r.label}
                  <svg className="ml-auto opacity-30" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              </motion.div>
            ))}
          </div>
        </ReportChartCard>
      </div>
    </div>
  )
}
