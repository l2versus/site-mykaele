'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import {
  DateRangeFilter, useReportsContext,
  ReportMetricCard, ReportChartCard, ReportChartTooltip,
  ExportCSVButton, ReportSkeleton,
} from '@/components/crm/reports'
import { ReportEmptyChart } from '@/components/crm/reports/ReportEmptyState'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// ━━━ Types ━━━

interface WlMetrics {
  wonCount: number; wonValue: number; wonAvg: number
  lostCount: number; lostValue: number; lostAvg: number
  winRate: number; totalCreated: number
}
interface TimelinePoint { day: string; won: number; lost: number }
interface FunnelStage { name: string; color: string | null; type: string; order: number; count: number; value: number }
interface LossReason { reason: string; count: number }
interface LeadRow {
  id: string; name: string; expectedValue: number | null; createdAt: string
  closedAt: string | null; source: string | null; lostReason?: string | null
  stage: { name: string }; daysInPipeline: number | null
}

interface WlData {
  metrics: WlMetrics
  charts: { timeline: TimelinePoint[]; funnel: FunnelStage[]; lossReasons: LossReason[] }
  wonLeads: LeadRow[]; lostLeads: LeadRow[]
}

function formatDayLabel(d: string) {
  const dt = new Date(d + 'T12:00:00')
  const w = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
  return `${w[dt.getDay()]} ${dt.getDate()}`
}

// ━━━ Main ━━━

export default function WinsLossesPage() {
  const { queryString, periodLabel } = useReportsContext()
  const [data, setData] = useState<WlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'won' | 'lost'>('won')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(
        `/api/admin/crm/reports/wins-losses?tenantId=${TENANT_ID}&${queryString}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [queryString])

  useEffect(() => { fetchData() }, [fetchData])

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

  const { metrics: m, charts, wonLeads, lostLeads } = data
  const displayLeads = tab === 'won' ? wonLeads : lostLeads

  const csvData = [...wonLeads.map(l => ({
    Nome: l.name, Status: 'Ganho', Valor: l.expectedValue ?? 0,
    Fonte: l.source ?? '', Estagio: l.stage.name, Dias: l.daysInPipeline ?? '',
  })), ...lostLeads.map(l => ({
    Nome: l.name, Status: 'Perdido', Valor: l.expectedValue ?? 0,
    Fonte: l.source ?? '', Estagio: l.stage.name, Dias: l.daysInPipeline ?? '',
    Motivo: l.lostReason ?? '',
  }))]

  // Funil: calcular taxa de conversão entre estágios
  const funnelWithRate = charts.funnel.filter(s => s.type === 'OPEN').map((s, i, arr) => ({
    ...s,
    conversionToNext: i < arr.length - 1 && s.count > 0
      ? Math.round((arr[i + 1].count / s.count) * 100)
      : null,
  }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            Ganhos e Perdas
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Analise de conversao — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeFilter />
          <ExportCSVButton data={csvData} filename={`ganhos-perdas-${periodLabel}`} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <ReportMetricCard
          label="Ganhos"
          value={String(m.wonCount)}
          subValue={currencyFmt.format(m.wonValue)}
          icon={<span className="text-sm">🏆</span>}
          accent="var(--crm-won)"
          trend={m.wonCount > 0 ? 'up' : null}
        />
        <ReportMetricCard
          label="Perdidos"
          value={String(m.lostCount)}
          subValue={currencyFmt.format(m.lostValue)}
          icon={<span className="text-sm">✕</span>}
          accent="var(--crm-hot)"
          trend={m.lostCount > 0 ? 'down' : null}
        />
        <ReportMetricCard
          label="Taxa de Ganho"
          value={`${m.winRate}%`}
          subValue={`${m.wonCount} de ${m.wonCount + m.lostCount} fechados`}
          icon={<span className="text-sm">📊</span>}
          accent={m.winRate >= 30 ? 'var(--crm-won)' : m.winRate >= 15 ? 'var(--crm-warm)' : 'var(--crm-hot)'}
        />
        <ReportMetricCard
          label="Ticket Medio Ganho"
          value={m.wonAvg > 0 ? currencyFmt.format(m.wonAvg) : '—'}
          icon={<span className="text-sm">💎</span>}
          accent="var(--crm-gold)"
        />
        <ReportMetricCard
          label="Ticket Medio Perdido"
          value={m.lostAvg > 0 ? currencyFmt.format(m.lostAvg) : '—'}
          icon={<span className="text-sm">💸</span>}
          accent="var(--crm-text-muted)"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Timeline ganhos vs perdas */}
        <ReportChartCard title="Ganhos vs Perdas ao Longo do Tempo" subtitle="Por dia no periodo">
          {charts.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="day" tickFormatter={formatDayLabel} tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<ReportChartTooltip />} />
                <Bar dataKey="won" name="Ganhos" fill="#2ECC8A" radius={[4, 4, 0, 0]} maxBarSize={20} stackId="stack" />
                <Bar dataKey="lost" name="Perdidos" fill="#FF6B4A" radius={[4, 4, 0, 0]} maxBarSize={20} stackId="stack" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Sem dados no periodo" />
          )}
        </ReportChartCard>

        {/* Funil de conversão */}
        <ReportChartCard title="Funil de Pipeline" subtitle="Leads por estagio com taxa de avanco">
          {funnelWithRate.length > 0 ? (
            <div className="space-y-2">
              {funnelWithRate.map((s, i) => {
                const maxCount = Math.max(...funnelWithRate.map(x => x.count), 1)
                const widthPct = Math.max((s.count / maxCount) * 100, 8)
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-medium" style={{ color: 'var(--crm-text)' }}>{s.name}</span>
                      <span style={{ color: 'var(--crm-text-muted)' }}>
                        {s.count} leads · {currencyFmt.format(s.value)}
                      </span>
                    </div>
                    <div className="relative h-7 rounded-lg overflow-hidden" style={{ background: 'var(--crm-bg)' }}>
                      <motion.div
                        className="h-full rounded-lg"
                        style={{ background: s.color ?? '#D4AF37', opacity: 0.7, width: `${widthPct}%` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.5, delay: i * 0.08 }}
                      />
                    </div>
                    {s.conversionToNext !== null && (
                      <div className="flex items-center justify-center my-1">
                        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}>
                          ↓ {s.conversionToNext}% avancam
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Won + Lost stages */}
              <div className="flex gap-2 mt-3 pt-2" style={{ borderTop: '1px solid var(--crm-border)' }}>
                <div className="flex-1 p-2 rounded-lg text-center" style={{ background: 'rgba(46,204,138,0.08)' }}>
                  <p className="text-lg font-bold" style={{ color: 'var(--crm-won)' }}>{m.wonCount}</p>
                  <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Ganhos</p>
                </div>
                <div className="flex-1 p-2 rounded-lg text-center" style={{ background: 'rgba(255,107,74,0.08)' }}>
                  <p className="text-lg font-bold" style={{ color: 'var(--crm-hot)' }}>{m.lostCount}</p>
                  <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Perdidos</p>
                </div>
              </div>
            </div>
          ) : (
            <ReportEmptyChart message="Nenhum estagio configurado" />
          )}
        </ReportChartCard>

        {/* Motivos de perda */}
        <ReportChartCard title="Motivos de Perda" subtitle="Por que leads foram perdidos">
          {charts.lossReasons.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.lossReasons} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="reason" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip content={<ReportChartTooltip />} />
                <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {charts.lossReasons.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#FF6B4A' : i === 1 ? '#F0A500' : '#8B8A94'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Nenhum motivo de perda registrado" />
          )}
        </ReportChartCard>
      </div>

      {/* Leads table */}
      <ReportChartCard
        title="Detalhamento"
        actions={
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}>
            <button
              onClick={() => setTab('won')}
              className="px-3 py-1 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: tab === 'won' ? 'rgba(46,204,138,0.12)' : 'transparent',
                color: tab === 'won' ? 'var(--crm-won)' : 'var(--crm-text-muted)',
              }}
            >
              Ganhos ({m.wonCount})
            </button>
            <button
              onClick={() => setTab('lost')}
              className="px-3 py-1 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: tab === 'lost' ? 'rgba(255,107,74,0.12)' : 'transparent',
                color: tab === 'lost' ? 'var(--crm-hot)' : 'var(--crm-text-muted)',
              }}
            >
              Perdidos ({m.lostCount})
            </button>
          </div>
        }
      >
        {displayLeads.length > 0 ? (
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto scrollbar-thin">
            {displayLeads.map(lead => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-3 rounded-xl text-xs"
                style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate" style={{ color: 'var(--crm-text)' }}>{lead.name}</p>
                  <p className="text-[10px] flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                    {lead.stage.name}
                    {lead.source && <> · {lead.source}</>}
                    {lead.daysInPipeline !== null && <> · {lead.daysInPipeline}d no pipeline</>}
                    {tab === 'lost' && lead.lostReason && (
                      <span className="px-1.5 py-0.5 rounded text-[9px]"
                        style={{ background: 'rgba(255,107,74,0.1)', color: 'var(--crm-hot)' }}>
                        {lead.lostReason}
                      </span>
                    )}
                  </p>
                </div>
                <span className="font-semibold shrink-0 ml-3" style={{
                  color: tab === 'won' ? 'var(--crm-won)' : 'var(--crm-hot)',
                }}>
                  {lead.expectedValue ? currencyFmt.format(lead.expectedValue) : '—'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <ReportEmptyChart message={`Nenhum lead ${tab === 'won' ? 'ganho' : 'perdido'} no periodo`} />
        )}
      </ReportChartCard>
    </div>
  )
}
