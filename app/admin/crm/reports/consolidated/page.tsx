'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import {
  DateRangeFilter, useReportsContext,
  ReportChartCard, ReportChartTooltip,
  ExportCSVButton, ReportSkeleton,
} from '@/components/crm/reports'
import { ReportEmptyChart } from '@/components/crm/reports/ReportEmptyState'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`)

interface StageRow {
  id: string; name: string; color: string | null; type: string; order: number
  pipeline: string; leadCount: number; totalValue: number; avgDays: number | null
  conversionToNext: number | null
}
interface PipelineOption { id: string; name: string; isDefault: boolean }
interface TeamMember { userId: string; displayName: string }

interface ConsolidatedData {
  pipelines: PipelineOption[]
  stages: StageRow[]
  wonLostStages: StageRow[]
  heatmap: number[][]
  teamMembers: TeamMember[]
}

export default function ConsolidatedReportPage() {
  const { queryString, periodLabel } = useReportsContext()
  const [data, setData] = useState<ConsolidatedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pipelineId, setPipelineId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const token = localStorage.getItem('admin_token')
      let url = `/api/admin/crm/reports/consolidated?tenantId=${TENANT_ID}&${queryString}`
      if (pipelineId) url += `&pipelineId=${pipelineId}`
      if (assignedTo) url += `&assignedTo=${assignedTo}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [queryString, pipelineId, assignedTo])

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

  const { pipelines, stages, wonLostStages, heatmap, teamMembers } = data
  const heatmapMax = Math.max(...heatmap.flat(), 1)

  const csvData = stages.map(s => ({
    Estagio: s.name, Pipeline: s.pipeline, Leads: s.leadCount,
    'Valor Total': s.totalValue, 'Tempo Medio (dias)': s.avgDays ?? 'N/A',
    'Conversao Proximo (%)': s.conversionToNext ?? 'N/A',
  }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            Consolidado do Pipeline
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Metricas por estagio — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeFilter />
          <ExportCSVButton data={csvData} filename={`consolidado-${periodLabel}`} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {pipelines.length > 1 && (
          <select
            value={pipelineId}
            onChange={e => setPipelineId(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-medium outline-none"
            style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
          >
            <option value="">Todos os pipelines</option>
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {teamMembers.length > 0 && (
          <select
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-medium outline-none"
            style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
          >
            <option value="">Todos os responsaveis</option>
            {teamMembers.map(m => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
          </select>
        )}
      </div>

      {/* Stage metrics table */}
      <ReportChartCard title="Metricas por Estagio" className="mb-4">
        {stages.length > 0 ? (
          <div className="space-y-2">
            {stages.map((s, i) => {
              const maxCount = Math.max(...stages.map(x => x.leadCount), 1)
              const widthPct = Math.max((s.leadCount / maxCount) * 100, 5)
              return (
                <div key={s.id}>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color ?? '#D4AF37' }} />
                      <span className="font-semibold" style={{ color: 'var(--crm-text)' }}>{s.name}</span>
                    </div>
                    <div className="flex items-center gap-4" style={{ color: 'var(--crm-text-muted)' }}>
                      <span>{s.leadCount} leads</span>
                      <span className="font-medium" style={{ color: 'var(--crm-gold)' }}>{currencyFmt.format(s.totalValue)}</span>
                      <span>{s.avgDays !== null ? `${s.avgDays}d medio` : '—'}</span>
                    </div>
                  </div>
                  <div className="relative h-6 rounded-lg overflow-hidden" style={{ background: 'var(--crm-bg)' }}>
                    <motion.div
                      className="h-full rounded-lg flex items-center justify-end pr-2"
                      style={{ background: s.color ?? '#D4AF37', opacity: 0.6 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06 }}
                    />
                  </div>
                  {s.conversionToNext !== null && (
                    <div className="flex items-center justify-center my-1.5">
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}>
                        ↓ {s.conversionToNext}% avancam para proximo estagio
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
            {/* Won/Lost summary */}
            {wonLostStages.length > 0 && (
              <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--crm-border)' }}>
                {wonLostStages.map(s => (
                  <div key={s.id} className="flex-1 p-2.5 rounded-lg text-center"
                    style={{ background: s.type === 'WON' ? 'rgba(46,204,138,0.06)' : 'rgba(255,107,74,0.06)' }}>
                    <p className="text-lg font-bold" style={{ color: s.type === 'WON' ? 'var(--crm-won)' : 'var(--crm-hot)' }}>
                      {s.leadCount}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                      {s.name} · {currencyFmt.format(s.totalValue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <ReportEmptyChart message="Nenhum estagio configurado" />
        )}
      </ReportChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Bar chart: leads + value by stage */}
        <ReportChartCard title="Leads e Valor por Estagio" subtitle="Distribuicao atual">
          {stages.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stages}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<ReportChartTooltip formatter={(v, name) =>
                  name === 'Valor' ? currencyFmt.format(v) : String(v)
                } />} />
                <Bar dataKey="leadCount" name="Leads" radius={[6, 6, 0, 0]} maxBarSize={35}>
                  {stages.map((s, i) => (
                    <Cell key={i} fill={s.color ?? '#D4AF37'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Sem dados" />
          )}
        </ReportChartCard>

        {/* Heatmap: when leads advance */}
        <ReportChartCard title="Quando Leads Avancam" subtitle="Movimentacoes por dia e hora">
          {heatmap.flat().some(v => v > 0) ? (
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                {/* Hour labels */}
                <div className="flex items-center mb-1 pl-10">
                  {[0, 4, 8, 12, 16, 20].map(h => (
                    <span key={h} className="text-[9px] flex-1 text-center" style={{ color: 'var(--crm-text-muted)' }}>
                      {HOUR_LABELS[h]}
                    </span>
                  ))}
                </div>
                {/* Grid */}
                {DOW_LABELS.map((day, dow) => (
                  <div key={dow} className="flex items-center gap-0.5 mb-0.5">
                    <span className="text-[9px] w-8 text-right pr-1.5 shrink-0" style={{ color: 'var(--crm-text-muted)' }}>
                      {day}
                    </span>
                    {heatmap[dow].map((count, hour) => {
                      const intensity = count / heatmapMax
                      return (
                        <div
                          key={hour}
                          className="flex-1 h-5 rounded-sm transition-all"
                          style={{
                            background: count > 0
                              ? `rgba(212, 175, 55, ${0.1 + intensity * 0.8})`
                              : 'var(--crm-bg)',
                          }}
                          title={`${day} ${hour}h: ${count} movimentacoes`}
                        />
                      )
                    })}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-2">
                  <span className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Menos</span>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map(o => (
                    <div key={o} className="w-3 h-3 rounded-sm" style={{ background: `rgba(212, 175, 55, ${o})` }} />
                  ))}
                  <span className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Mais</span>
                </div>
              </div>
            </div>
          ) : (
            <ReportEmptyChart message="Sem movimentacoes de estagio no periodo" />
          )}
        </ReportChartCard>
      </div>
    </div>
  )
}
