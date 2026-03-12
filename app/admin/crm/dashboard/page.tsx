'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area,
} from 'recharts'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// ━━━ Types ━━━

interface DashboardMetrics {
  messagesReceived: number
  messagesSent: number
  openConversations: number
  unansweredChats: number
  avgResponseMinutes: number | null
  wonLeads: number
  wonValue: number
  activeLeads: number
  activeValue: number
  pendingTasks: number
  overdueTasks: number
}

interface SourceData { name: string; count: number }
interface StatusData { status: string; count: number }
interface TimelineData { day: string; received: number; sent: number }
interface RecentLead {
  id: string; name: string; phone: string; status: string
  source: string | null; expectedValue: number | null; createdAt: string
  stage: { name: string; color: string | null }
}

interface DashboardData {
  period: string
  metrics: DashboardMetrics
  charts: {
    sources: SourceData[]
    statusDistribution: StatusData[]
    messagesTimeline: TimelineData[]
  }
  recentLeads: RecentLead[]
}

// ━━━ Constants ━━━

const STATUS_COLORS: Record<string, string> = {
  HOT: '#FF6B4A', WARM: '#F0A500', COLD: '#4A7BFF', WON: '#2ECC8A', LOST: '#8B8A94',
}

const STATUS_LABELS: Record<string, string> = {
  HOT: 'Quente', WARM: 'Morno', COLD: 'Frio', WON: 'Ganho', LOST: 'Perdido',
}

const PIE_COLORS = ['#D4AF37', '#FF6B4A', '#4A7BFF', '#2ECC8A', '#F0A500', '#8B8A94', '#C4A030', '#7B68EE']

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 1) return '<1min'
  if (minutes < 60) return `${Math.round(minutes)}min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatDayLabel(dayStr: string): string {
  const d = new Date(dayStr + 'T12:00:00')
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return `${weekdays[d.getDay()]} ${d.getDate()}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora'
  if (mins < 60) return `Há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ontem'
  return `Há ${days}d`
}

// ━━━ Chart Tooltip ━━━

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-xs shadow-xl" style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)' }}>
      <p className="font-medium mb-1.5" style={{ color: 'var(--crm-text)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color ?? '#D4AF37' }} />
          <span style={{ color: 'var(--crm-text-muted)' }}>{p.name}:</span>
          <span className="font-semibold" style={{ color: 'var(--crm-text)' }}>{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ━━━ Skeleton ━━━

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
    </div>
  )
}

// ━━━ Metric Card ━━━

function MetricCard({ label, value, subValue, icon, accent, trend }: {
  label: string; value: string; subValue?: string; icon: string; accent?: string; trend?: 'up' | 'down' | null
}) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-4 transition-all hover:brightness-110"
      style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.04] -translate-y-6 translate-x-6"
        style={{ background: accent ?? 'var(--crm-gold)' }} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--crm-text-muted)' }}>
          {label}
        </span>
        <span className="text-sm opacity-50">{icon}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ color: accent ?? 'var(--crm-text)' }}>
        {value}
      </p>
      {subValue && (
        <p className="text-[11px] mt-1 font-medium flex items-center gap-1" style={{ color: 'var(--crm-text-muted)' }}>
          {trend === 'up' && <span style={{ color: 'var(--crm-won)' }}>↑</span>}
          {trend === 'down' && <span style={{ color: 'var(--crm-hot)' }}>↓</span>}
          {subValue}
        </p>
      )}
    </motion.div>
  )
}

// ━━━ Chart Card ━━━

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
    >
      <h3 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--crm-text)' }}>{title}</h3>
      {children}
    </motion.div>
  )
}

// ━━━ Main Dashboard ━━━

export default function CrmDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/crm/dashboard?tenantId=${TENANT_ID}&period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const periodLabel = PERIODS.find(p => p.value === period)?.label ?? period

  if (loading && !data) return <DashboardSkeleton />

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

  const { metrics, charts, recentLeads } = data

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            Dashboard
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Visão geral do CRM — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl p-1" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
          {PERIODS.map(p => (
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
      </div>

      {/* Row 1: Comunicação */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MetricCard
          label="Mensagens Recebidas"
          value={String(metrics.messagesReceived)}
          subValue={`${metrics.messagesSent} enviadas`}
          icon="✉"
          accent="var(--crm-gold)"
        />
        <MetricCard
          label="Conversas Abertas"
          value={String(metrics.openConversations)}
          icon="💬"
        />
        <MetricCard
          label="Sem Resposta"
          value={String(metrics.unansweredChats)}
          icon="⏳"
          accent={metrics.unansweredChats > 0 ? 'var(--crm-hot)' : undefined}
        />
        <MetricCard
          label="Tempo de Resposta"
          value={formatResponseTime(metrics.avgResponseMinutes)}
          subValue="média no período"
          icon="⚡"
        />
      </div>

      {/* Row 2: Vendas + Tarefas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Leads Ganhos"
          value={String(metrics.wonLeads)}
          subValue={currencyFmt.format(metrics.wonValue)}
          icon="🏆"
          accent="var(--crm-won)"
          trend={metrics.wonLeads > 0 ? 'up' : null}
        />
        <MetricCard
          label="Leads Ativos"
          value={String(metrics.activeLeads)}
          subValue={currencyFmt.format(metrics.activeValue)}
          icon="◆"
          accent="var(--crm-gold)"
        />
        <MetricCard
          label="Tarefas Pendentes"
          value={String(metrics.pendingTasks)}
          subValue={metrics.overdueTasks > 0 ? `${metrics.overdueTasks} atrasadas` : 'Nenhuma atrasada'}
          icon="📋"
          accent={metrics.overdueTasks > 0 ? 'var(--crm-warm)' : undefined}
          trend={metrics.overdueTasks > 0 ? 'down' : null}
        />
        <MetricCard
          label="Taxa de Resposta"
          value={metrics.messagesReceived > 0
            ? `${Math.round((metrics.messagesSent / metrics.messagesReceived) * 100)}%`
            : '—'}
          icon="📊"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Mensagens por dia */}
        <ChartCard title="Mensagens por Dia">
          {charts.messagesTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={charts.messagesTimeline}>
                <defs>
                  <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ECC8A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2ECC8A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="day" tickFormatter={formatDayLabel} tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="received" name="Recebidas" stroke="#D4AF37" fill="url(#gradReceived)" strokeWidth={2} />
                <Area type="monotone" dataKey="sent" name="Enviadas" stroke="#2ECC8A" fill="url(#gradSent)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Nenhuma mensagem no período" />
          )}
        </ChartCard>

        {/* Fontes de lead */}
        <ChartCard title="Fontes de Lead">
          {charts.sources.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie
                    data={charts.sources}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                    strokeWidth={0}
                  >
                    {charts.sources.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {charts.sources.slice(0, 6).map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate" style={{ color: 'var(--crm-text)' }}>{s.name}</span>
                    </div>
                    <span className="font-semibold ml-2 shrink-0" style={{ color: 'var(--crm-text-muted)' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="Nenhuma fonte de lead cadastrada" />
          )}
        </ChartCard>

        {/* Leads por status */}
        <ChartCard title="Leads por Status">
          {charts.statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.statusDistribution.map(s => ({ ...s, label: STATUS_LABELS[s.status] ?? s.status }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {charts.statusDistribution.map((s, i) => (
                    <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#8B8A94'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Nenhum lead cadastrado" />
          )}
        </ChartCard>

        {/* Leads recentes */}
        <ChartCard title="Leads Recentes">
          {recentLeads.length > 0 ? (
            <div className="space-y-2.5">
              {recentLeads.map(lead => (
                <Link
                  key={lead.id}
                  href={`/admin/crm/pipeline`}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl transition-all hover:brightness-110"
                  style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: `${STATUS_COLORS[lead.status] ?? '#8B8A94'}15`,
                        color: STATUS_COLORS[lead.status] ?? '#8B8A94',
                      }}
                    >
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--crm-text)' }}>{lead.name}</p>
                      <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: lead.stage.color ?? '#8B8A94' }} />
                        {lead.stage.name}
                        {lead.source && <> · {lead.source}</>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {lead.expectedValue != null && lead.expectedValue > 0 && (
                      <p className="text-[11px] font-semibold" style={{ color: 'var(--crm-gold)' }}>
                        {currencyFmt.format(lead.expectedValue)}
                      </p>
                    )}
                    <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>{timeAgo(lead.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyChart message="Nenhum lead cadastrado ainda" />
          )}
        </ChartCard>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickLink href="/admin/crm/pipeline" label="Pipeline" icon="◆" />
        <QuickLink href="/admin/crm/inbox" label="Inbox" icon="✉" />
        <QuickLink href="/admin/crm/contacts" label="Contatos" icon="👤" />
        <QuickLink href="/admin/crm/intelligence" label="Inteligência" icon="🧠" />
      </div>
    </div>
  )
}

// ━━━ Empty State ━━━

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: 'var(--crm-surface-2)', border: '1px dashed var(--crm-border)' }}>
        <svg width="16" height="16" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24" className="opacity-40">
          <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
        </svg>
      </div>
      <span className="text-[11px]" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }}>{message}</span>
    </div>
  )
}

// ━━━ Quick Link ━━━

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 p-3.5 rounded-xl text-xs font-medium transition-all hover:brightness-110"
      style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', color: 'var(--crm-text-muted)' }}
    >
      <span className="opacity-60">{icon}</span>
      {label}
      <svg className="ml-auto opacity-30" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  )
}
