'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import {
  DateRangeFilter, useReportsContext,
  ReportMetricCard, ReportChartCard, ReportChartTooltip,
  ExportCSVButton, ReportSkeleton,
} from '@/components/crm/reports'
import { ReportEmptyChart } from '@/components/crm/reports/ReportEmptyState'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const DOW_COLORS = ['#8B8A94', '#D4AF37', '#FF6B4A', '#4A7BFF', '#2ECC8A', '#F0A500', '#8B8A94']
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`)

interface CommMetrics {
  totalSent: number; totalReceived: number; totalMessages: number
  openConversations: number; closedConversations: number
  avgResponseMinutes: number | null
}
interface TimelinePoint { day: string; sent: number; received: number }
interface DowData { dow: number; count: number }
interface TopLead { id: string; name: string; messageCount: number }
interface CommData {
  metrics: CommMetrics
  charts: { timeline: TimelinePoint[]; byDow: DowData[]; heatmap: number[][]; topLeads: TopLead[] }
}

function formatDayLabel(d: string) {
  const dt = new Date(d + 'T12:00:00')
  const w = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
  return `${w[dt.getDay()]} ${dt.getDate()}`
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 1) return '<1min'
  if (minutes < 60) return `${Math.round(minutes)}min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function CommunicationsReportPage() {
  const { queryString, periodLabel } = useReportsContext()
  const [data, setData] = useState<CommData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(
        `/api/admin/crm/reports/communications?tenantId=${TENANT_ID}&${queryString}`,
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
  const { metrics: m, charts } = data

  const csvData = charts.timeline.map(t => ({
    Dia: t.day, Enviadas: t.sent, Recebidas: t.received, Total: t.sent + t.received,
  }))

  const heatmapMax = Math.max(...charts.heatmap.flat(), 1)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            Comunicacoes
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Metricas de mensagens — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeFilter />
          <ExportCSVButton data={csvData} filename={`comunicacoes-${periodLabel}`} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <ReportMetricCard
          label="Total Mensagens"
          value={String(m.totalMessages)}
          icon={<span className="text-sm">💬</span>}
          accent="var(--crm-gold)"
        />
        <ReportMetricCard
          label="Enviadas"
          value={String(m.totalSent)}
          icon={<span className="text-sm">📤</span>}
          accent="var(--crm-won)"
        />
        <ReportMetricCard
          label="Recebidas"
          value={String(m.totalReceived)}
          icon={<span className="text-sm">📥</span>}
          accent="var(--crm-cold)"
        />
        <ReportMetricCard
          label="Tempo Resposta"
          value={formatResponseTime(m.avgResponseMinutes)}
          subValue="media no periodo"
          icon={<span className="text-sm">⚡</span>}
          accent={m.avgResponseMinutes !== null && m.avgResponseMinutes < 30 ? 'var(--crm-won)' : 'var(--crm-warm)'}
        />
        <ReportMetricCard
          label="Conversas Abertas"
          value={String(m.openConversations)}
          icon={<span className="text-sm">📂</span>}
          accent="var(--crm-warm)"
        />
        <ReportMetricCard
          label="Conversas Fechadas"
          value={String(m.closedConversations)}
          subValue="no periodo"
          icon={<span className="text-sm">✓</span>}
          accent="var(--crm-text-muted)"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Timeline */}
        <ReportChartCard title="Volume de Mensagens" subtitle="Enviadas vs recebidas por dia">
          {charts.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={charts.timeline}>
                <defs>
                  <linearGradient id="gradSent2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ECC8A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2ECC8A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRecv2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A7BFF" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4A7BFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="day" tickFormatter={formatDayLabel} tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<ReportChartTooltip />} />
                <Area type="monotone" dataKey="received" name="Recebidas" stroke="#4A7BFF" fill="url(#gradRecv2)" strokeWidth={2} />
                <Area type="monotone" dataKey="sent" name="Enviadas" stroke="#2ECC8A" fill="url(#gradSent2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Sem mensagens no periodo" />
          )}
        </ReportChartCard>

        {/* By day of week */}
        <ReportChartCard title="Mensagens por Dia da Semana" subtitle="Distribuicao semanal">
          {charts.byDow.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.byDow.map(d => ({ ...d, label: DOW_LABELS[d.dow] }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<ReportChartTooltip />} />
                <Bar dataKey="count" name="Mensagens" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {charts.byDow.map((d, i) => (
                    <Cell key={i} fill={DOW_COLORS[d.dow]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Sem dados" />
          )}
        </ReportChartCard>

        {/* Heatmap */}
        <ReportChartCard title="Mapa de Calor" subtitle="Mensagens por hora e dia da semana">
          {charts.heatmap.flat().some(v => v > 0) ? (
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                <div className="flex items-center mb-1 pl-10">
                  {[0, 4, 8, 12, 16, 20].map(h => (
                    <span key={h} className="text-[9px] flex-1 text-center" style={{ color: 'var(--crm-text-muted)' }}>
                      {HOUR_LABELS[h]}
                    </span>
                  ))}
                </div>
                {DOW_LABELS.map((day, dow) => (
                  <div key={dow} className="flex items-center gap-0.5 mb-0.5">
                    <span className="text-[9px] w-8 text-right pr-1.5 shrink-0" style={{ color: 'var(--crm-text-muted)' }}>
                      {day}
                    </span>
                    {charts.heatmap[dow].map((count, hour) => {
                      const intensity = count / heatmapMax
                      return (
                        <div
                          key={hour}
                          className="flex-1 h-5 rounded-sm"
                          style={{
                            background: count > 0
                              ? `rgba(74, 123, 255, ${0.1 + intensity * 0.8})`
                              : 'var(--crm-bg)',
                          }}
                          title={`${day} ${hour}h: ${count} mensagens`}
                        />
                      )
                    })}
                  </div>
                ))}
                <div className="flex items-center justify-end gap-2 mt-2">
                  <span className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Menos</span>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map(o => (
                    <div key={o} className="w-3 h-3 rounded-sm" style={{ background: `rgba(74, 123, 255, ${o})` }} />
                  ))}
                  <span className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Mais</span>
                </div>
              </div>
            </div>
          ) : (
            <ReportEmptyChart message="Sem mensagens no periodo" />
          )}
        </ReportChartCard>

        {/* Top leads by messages */}
        <ReportChartCard title="Leads Mais Ativos" subtitle="Ranking por volume de mensagens">
          {charts.topLeads.length > 0 ? (
            <div className="space-y-1.5">
              {charts.topLeads.map((lead, i) => {
                const maxMsg = charts.topLeads[0].messageCount
                const widthPct = Math.max((lead.messageCount / maxMsg) * 100, 8)
                return (
                  <div key={lead.id} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold w-5 text-right shrink-0" style={{ color: 'var(--crm-text-muted)' }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="font-medium truncate" style={{ color: 'var(--crm-text)' }}>{lead.name}</span>
                        <span className="shrink-0 ml-2" style={{ color: 'var(--crm-text-muted)' }}>{lead.messageCount} msgs</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--crm-bg)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${widthPct}%`, background: i < 3 ? '#D4AF37' : '#4A7BFF', opacity: 1 - i * 0.07 }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <ReportEmptyChart message="Nenhuma conversa no periodo" />
          )}
        </ReportChartCard>
      </div>
    </div>
  )
}
