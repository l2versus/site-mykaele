'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell,
} from 'recharts'
import {
  DateRangeFilter, useReportsContext,
  ReportChartCard, ReportChartTooltip,
  ExportCSVButton, ReportSkeleton,
} from '@/components/crm/reports'
import { ReportEmptyChart } from '@/components/crm/reports/ReportEmptyState'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

const TYPE_LABELS: Record<string, string> = {
  LEAD_CREATED: 'Lead criado',
  LEAD_STAGE_CHANGED: 'Lead movido',
  LEAD_WON: 'Lead ganho',
  LEAD_LOST: 'Lead perdido',
  MESSAGE_SENT: 'Mensagem enviada',
  MESSAGE_RECEIVED: 'Mensagem recebida',
  EMAIL_SENT: 'Email enviado',
  TASK_CREATED: 'Tarefa criada',
  TASK_COMPLETED: 'Tarefa concluida',
  PROPOSAL_SENT: 'Proposta enviada',
  PROPOSAL_ACCEPTED: 'Proposta aceita',
  PROPOSAL_REJECTED: 'Proposta recusada',
  NPS_SENT: 'NPS enviado',
  NPS_RESPONDED: 'NPS respondido',
  NOTE_ADDED: 'Nota adicionada',
  BROADCAST_SENT: 'Broadcast enviado',
  // LeadActivity fallback types
  stage_changed: 'Lead movido',
  lead_created: 'Lead criado',
  message_sent: 'Mensagem enviada',
  proposal_created: 'Proposta criada',
  nps_sent: 'NPS enviado',
}

const TYPE_ICONS: Record<string, string> = {
  LEAD_CREATED: '👤', LEAD_STAGE_CHANGED: '↔', LEAD_WON: '🏆', LEAD_LOST: '✕',
  MESSAGE_SENT: '✉', MESSAGE_RECEIVED: '📨', EMAIL_SENT: '📧',
  TASK_CREATED: '📋', TASK_COMPLETED: '✓', PROPOSAL_SENT: '📄',
  PROPOSAL_ACCEPTED: '✓', PROPOSAL_REJECTED: '✕', NPS_SENT: '👍',
  NPS_RESPONDED: '⭐', NOTE_ADDED: '📝', BROADCAST_SENT: '📢',
  stage_changed: '↔', lead_created: '👤', message_sent: '✉',
  proposal_created: '📄', nps_sent: '👍',
}

const TYPE_COLORS: Record<string, string> = {
  LEAD_CREATED: '#D4AF37', LEAD_STAGE_CHANGED: '#4A7BFF', LEAD_WON: '#2ECC8A', LEAD_LOST: '#FF6B4A',
  MESSAGE_SENT: '#D4AF37', MESSAGE_RECEIVED: '#F0A500', TASK_CREATED: '#4A7BFF',
  TASK_COMPLETED: '#2ECC8A', PROPOSAL_SENT: '#D4AF37', NPS_SENT: '#F0A500',
}

interface Activity {
  id: string; type: string; description: string
  leadId: string | null; userId: string | null
  metadata: Record<string, unknown> | null; createdAt: string
}
interface Pagination { total: number; page: number; limit: number; totalPages: number }
interface TypeCount { type: string; count: number }
interface DayCount { day: string; count: number }
interface TeamMember { userId: string; displayName: string }

interface ActivitiesData {
  activities: Activity[]; pagination: Pagination
  charts: { byType: TypeCount[]; byDay: DayCount[] }
  teamMembers: TeamMember[]
}

function formatDayLabel(d: string) {
  const dt = new Date(d + 'T12:00:00')
  const w = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
  return `${w[dt.getDay()]} ${dt.getDate()}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora'
  if (mins < 60) return `Ha ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Ha ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ontem'
  return `Ha ${days}d`
}

export default function ActivitiesReportPage() {
  const { queryString, periodLabel } = useReportsContext()
  const [data, setData] = useState<ActivitiesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const token = localStorage.getItem('admin_token')
      let url = `/api/admin/crm/reports/activities?tenantId=${TENANT_ID}&${queryString}&page=${page}`
      if (filterType) url += `&type=${filterType}`
      if (filterUser) url += `&userId=${filterUser}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [queryString, page, filterType, filterUser])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [filterType, filterUser, queryString])

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

  const { activities, pagination, charts, teamMembers } = data
  const totalActivities = charts.byType.reduce((sum, t) => sum + t.count, 0)

  const csvData = activities.map(a => ({
    Data: new Date(a.createdAt).toLocaleString('pt-BR'),
    Tipo: TYPE_LABELS[a.type] ?? a.type,
    Descricao: a.description,
  }))

  // All types present in data for filter
  const availableTypes = charts.byType.map(t => t.type)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            Atividades
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            {totalActivities} atividades — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeFilter />
          <ExportCSVButton data={csvData} filename={`atividades-${periodLabel}`} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-[11px] font-medium outline-none"
          style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
        >
          <option value="">Todos os tipos</option>
          {availableTypes.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        {teamMembers.length > 0 && (
          <select
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-medium outline-none"
            style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
          >
            <option value="">Todos os usuarios</option>
            {teamMembers.map(m => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
          </select>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ReportChartCard title="Volume de Atividades" subtitle="Por dia no periodo">
          {charts.byDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={charts.byDay}>
                <defs>
                  <linearGradient id="gradAct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="day" tickFormatter={formatDayLabel} tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<ReportChartTooltip />} />
                <Area type="monotone" dataKey="count" name="Atividades" stroke="#D4AF37" fill="url(#gradAct)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Sem atividades no periodo" />
          )}
        </ReportChartCard>

        <ReportChartCard title="Atividades por Tipo" subtitle="Distribuicao">
          {charts.byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.byType.map(t => ({ ...t, label: TYPE_LABELS[t.type] ?? t.type }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip content={<ReportChartTooltip />} />
                <Bar dataKey="count" name="Qtd" radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {charts.byType.map((t, i) => (
                    <Cell key={i} fill={TYPE_COLORS[t.type] ?? '#8B8A94'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ReportEmptyChart message="Sem atividades" />
          )}
        </ReportChartCard>
      </div>

      {/* Timeline */}
      <ReportChartCard title="Timeline de Atividades" subtitle={`Pagina ${pagination.page} de ${pagination.totalPages}`}>
        {activities.length > 0 ? (
          <>
            <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-thin">
              {activities.map((a, i) => (
                <motion.div
                  key={a.id}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs"
                    style={{
                      background: `${TYPE_COLORS[a.type] ?? '#8B8A94'}15`,
                      color: TYPE_COLORS[a.type] ?? '#8B8A94',
                    }}
                  >
                    {TYPE_ICONS[a.type] ?? '●'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium truncate" style={{ color: 'var(--crm-text)' }}>
                        {a.description}
                      </span>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--crm-text-muted)' }}>
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                    <span
                      className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded mt-1"
                      style={{
                        background: `${TYPE_COLORS[a.type] ?? '#8B8A94'}12`,
                        color: TYPE_COLORS[a.type] ?? '#8B8A94',
                      }}
                    >
                      {TYPE_LABELS[a.type] ?? a.type}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-30"
                  style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}
                >
                  Anterior
                </button>
                <span className="text-[11px]" style={{ color: 'var(--crm-text-muted)' }}>
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-30"
                  style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}
                >
                  Proxima
                </button>
              </div>
            )}
          </>
        ) : (
          <ReportEmptyChart message="Nenhuma atividade registrada no periodo" />
        )}
      </ReportChartCard>
    </div>
  )
}
