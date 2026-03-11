'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from 'recharts'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

interface LeadInsight {
  id: string
  name: string
  phone: string
  status: 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST'
  stageId: string
  stageName: string
  stageColor: string | null
  expectedValue: number | null
  aiScore: number | null
  aiScoreLabel: string | null
  churnRisk: number | null
  bestContactDays: string | null
  bestContactHours: string | null
  bestContactBasis: number | null
  lastInteractionAt: string | null
  createdAt: string
  tags: string[]
}

interface StageInfo { id: string; name: string; color: string | null; order: number; cachedLeadCount: number; cachedTotalValue: number }

const STATUS_COLORS: Record<string, string> = {
  HOT: '#FF6B4A', WARM: '#F0A500', COLD: '#4A7BFF', WON: '#2ECC8A', LOST: '#8B8A94',
}

const STATUS_LABELS: Record<string, string> = {
  HOT: 'Quente', WARM: 'Morno', COLD: 'Frio', WON: 'Ganho', LOST: 'Perdido',
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 30) return `Há ${days}d`
  return `Há ${Math.floor(days / 30)}m`
}

// ━━━ Custom Tooltip ━━━
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-xl" style={{ background: '#1A1A1F', border: '1px solid #2A2A32' }}>
      <p className="font-medium mb-1" style={{ color: '#F0EDE8' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: '#D4AF37' }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

// ━━━ Skeleton ━━━
function IntelligenceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
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

// ━━━ Score Ring ━━━
function ScoreRing({ value, size = 48, color }: { value: number; size?: number; color: string }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1A1A1F" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
    </svg>
  )
}

// ━━━ Heatmap ━━━
const DAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const HOURS = ['06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h']

function MessageHeatmap({ leads }: { leads: LeadInsight[] }) {
  // Build heatmap from lastInteractionAt + createdAt dates
  const grid = useMemo(() => {
    const data: number[][] = Array.from({ length: 7 }, () => Array(9).fill(0))
    for (const lead of leads) {
      const dateStr = lead.lastInteractionAt ?? lead.createdAt
      if (!dateStr) continue
      const d = new Date(dateStr)
      const day = (d.getDay() + 6) % 7 // Monday=0
      const hour = d.getHours()
      const hourIdx = Math.max(0, Math.min(8, Math.floor((hour - 6) / 2)))
      if (hour >= 6 && hour < 24) data[day][hourIdx]++
    }
    return data
  }, [leads])

  const maxVal = Math.max(1, ...grid.flat())

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--crm-text)' }}>
        <svg width="14" height="14" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" /><rect x="7" y="7" width="3" height="3" /><rect x="14" y="7" width="3" height="3" /><rect x="7" y="14" width="3" height="3" />
        </svg>
        Mapa de Calor — Interações
      </h3>
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Hour labels */}
          <div className="flex ml-10 mb-1">
            {HOURS.map(h => (
              <div key={h} className="flex-1 text-center text-[9px]" style={{ color: '#8B8A94' }}>{h}</div>
            ))}
          </div>
          {/* Grid */}
          {DAYS_PT.map((day, di) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="w-9 text-right text-[10px] shrink-0" style={{ color: '#8B8A94' }}>{day}</span>
              {grid[di].map((val, hi) => {
                const intensity = val / maxVal
                return (
                  <div
                    key={hi}
                    className="flex-1 h-6 rounded-sm"
                    style={{
                      background: val === 0
                        ? '#1A1A1F'
                        : `rgba(212, 175, 55, ${0.15 + intensity * 0.85})`,
                    }}
                    title={`${day} ${HOURS[hi]}: ${val} interações`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <span className="text-[9px]" style={{ color: '#8B8A94' }}>Menos</span>
        {[0.15, 0.35, 0.55, 0.75, 1].map((op, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ background: `rgba(212,175,55,${op})` }} />
        ))}
        <span className="text-[9px]" style={{ color: '#8B8A94' }}>Mais</span>
      </div>
    </div>
  )
}

// ━━━ Main Page ━━━
export default function IntelligencePage() {
  const [leads, setLeads] = useState<LeadInsight[]>([])
  const [stages, setStages] = useState<StageInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'score' | 'window' | 'churn'>('score')
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const addToast = useToastStore(s => s.addToast)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('admin_token')

      const pipelineRes = await fetch(`/api/admin/crm/pipeline?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!pipelineRes.ok) throw new Error('Falha ao carregar pipeline')
      const pipelineData = await pipelineRes.json()

      const stageMap: Record<string, { name: string; color: string | null }> = {}
      const stageList: StageInfo[] = []
      for (const stage of pipelineData.stages) {
        stageMap[stage.id] = { name: stage.name, color: stage.color }
        stageList.push(stage)
      }
      setStages(stageList.sort((a, b) => a.order - b.order))

      const leadsRes = await fetch(`/api/admin/crm/leads?tenantId=${TENANT_ID}&pipelineId=${pipelineData.pipeline.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!leadsRes.ok) throw new Error('Falha ao carregar leads')
      const leadsData = await leadsRes.json()

      setLeads(leadsData.leads.map((l: LeadInsight & { stageId: string }) => ({
        ...l,
        stageName: stageMap[l.stageId]?.name ?? '—',
        stageColor: stageMap[l.stageId]?.color ?? null,
      })))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      addToast('Erro ao carregar dados', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [addToast])

  useEffect(() => { fetchData() }, [fetchData])

  // Derived metrics
  const activeLeads = useMemo(() => leads.filter(l => l.status !== 'LOST'), [leads])
  const scoredLeads = useMemo(() => activeLeads.filter(l => l.aiScore != null), [activeLeads])
  const avgScore = useMemo(() =>
    scoredLeads.length > 0
      ? Math.round(scoredLeads.reduce((acc, l) => acc + (l.aiScore ?? 0), 0) / scoredLeads.length)
      : 0
  , [scoredLeads])
  const highScoreLeads = useMemo(() => scoredLeads.filter(l => (l.aiScore ?? 0) >= 70), [scoredLeads])
  const atRiskLeads = useMemo(() => activeLeads.filter(l => l.churnRisk != null && l.churnRisk >= 70), [activeLeads])
  const goldenWindowLeads = useMemo(() => activeLeads.filter(l => l.bestContactDays && l.bestContactHours), [activeLeads])
  const totalPipeline = useMemo(() => activeLeads.reduce((acc, l) => acc + (l.expectedValue ?? 0), 0), [activeLeads])

  // Funnel data (from stages)
  const funnelData = useMemo(() =>
    stages.map(s => ({
      name: s.name,
      value: s.cachedLeadCount,
      total: currencyFmt.format(s.cachedTotalValue),
      fill: s.color ?? '#D4AF37',
    }))
  , [stages])

  // Leads by day (line chart)
  const leadsByDay = useMemo(() => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const data: { date: string; leads: number }[] = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = period === '90d'
        ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : period === '30d'
          ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : d.toLocaleDateString('pt-BR', { weekday: 'short' })

      const count = leads.filter(l => l.createdAt.slice(0, 10) === key).length
      data.push({ date: label, leads: count })
    }

    // For 30d/90d, aggregate by week
    if (period === '90d') {
      const weekly: { date: string; leads: number }[] = []
      for (let i = 0; i < data.length; i += 7) {
        const slice = data.slice(i, i + 7)
        weekly.push({
          date: slice[0].date,
          leads: slice.reduce((s, d) => s + d.leads, 0),
        })
      }
      return weekly
    }

    return data
  }, [leads, period])

  // Score distribution (bar chart)
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: '0-20', min: 0, max: 20, count: 0, color: '#FF6B4A' },
      { range: '21-40', min: 21, max: 40, count: 0, color: '#F0A500' },
      { range: '41-60', min: 41, max: 60, count: 0, color: '#F0A500' },
      { range: '61-80', min: 61, max: 80, count: 0, color: '#2ECC8A' },
      { range: '81-100', min: 81, max: 100, count: 0, color: '#2ECC8A' },
    ]
    for (const lead of scoredLeads) {
      const score = lead.aiScore ?? 0
      const bucket = buckets.find(b => score >= b.min && score <= b.max)
      if (bucket) bucket.count++
    }
    return buckets
  }, [scoredLeads])

  // Needs attention list
  const needsAttention = useMemo(() => {
    const now = Date.now()
    return activeLeads
      .filter(l => {
        const lastDate = l.lastInteractionAt ?? l.createdAt
        const daysSince = Math.floor((now - new Date(lastDate).getTime()) / 86400000)
        return daysSince >= 3 || (l.churnRisk != null && l.churnRisk >= 50) || l.status === 'HOT'
      })
      .sort((a, b) => {
        // Prioritize: HOT without recent activity > high churn > inactive
        const aScore = (a.status === 'HOT' ? 100 : 0) + (a.churnRisk ?? 0)
        const bScore = (b.status === 'HOT' ? 100 : 0) + (b.churnRisk ?? 0)
        return bScore - aScore
      })
      .slice(0, 8)
  }, [activeLeads])

  // Top lists
  const topByScore = useMemo(() => [...scoredLeads].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0)).slice(0, 10), [scoredLeads])
  const topGoldenWindow = useMemo(() => goldenWindowLeads.slice(0, 10), [goldenWindowLeads])
  const topAtRisk = useMemo(() =>
    [...activeLeads].filter(l => l.churnRisk != null).sort((a, b) => (b.churnRisk ?? 0) - (a.churnRisk ?? 0)).slice(0, 10)
  , [activeLeads])

  if (isLoading) return <IntelligenceSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm" style={{ color: '#FF6B4A' }}>{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
        >Tentar novamente</button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--crm-text)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
              <svg width="16" height="16" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <line x1="9" y1="21" x2="15" y2="21" />
              </svg>
            </div>
            Inteligência
          </h1>
          <p className="text-xs mt-1 ml-[42px]" style={{ color: 'var(--crm-text-muted)' }}>
            Insights de IA sobre seus {activeLeads.length} leads ativos
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
              style={{
                background: period === p ? 'var(--crm-surface-2)' : 'transparent',
                color: period === p ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Score Médio', value: `${avgScore}`, sublabel: `${scoredLeads.length} avaliados`, color: '#D4AF37', icon: '★' },
          { label: 'Alta Conversão', value: `${highScoreLeads.length}`, sublabel: 'score ≥ 70', color: '#2ECC8A', icon: '↑' },
          { label: 'Em Risco', value: `${atRiskLeads.length}`, sublabel: 'churn ≥ 70%', color: '#FF6B4A', icon: '⚠' },
          { label: 'Pipeline Ativo', value: currencyFmt.format(totalPipeline), sublabel: `${activeLeads.length} leads`, color: '#D4AF37', icon: '◆' },
        ]).map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="rounded-xl p-4 border relative overflow-hidden group"
            style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -1 }}
          >
            <div className="absolute inset-0 opacity-[0.03] transition-opacity group-hover:opacity-[0.05]" style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.color}, transparent 60%)` }} />
            <div className="absolute top-3 right-3 text-lg opacity-15 transition-opacity group-hover:opacity-30" style={{ color: kpi.color }}>{kpi.icon}</div>
            <p className="text-[10px] uppercase tracking-wider font-semibold relative z-10" style={{ color: 'var(--crm-text-muted)' }}>{kpi.label}</p>
            <p className="text-2xl font-bold mt-1.5 relative z-10" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-[10px] mt-0.5 relative z-10" style={{ color: 'var(--crm-text-muted)' }}>{kpi.sublabel}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1: Funnel + Leads by Day */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Funnel (as horizontal bar) */}
        <div className="rounded-xl border p-4" style={{ background: '#111114', borderColor: '#2A2A32' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#F0EDE8' }}>Funil de Vendas</h3>
          {funnelData.length === 0 ? (
            <div className="flex items-center justify-center py-12 opacity-40">
              <p className="text-xs" style={{ color: '#8B8A94' }}>Sem estágios configurados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {funnelData.map((stage, i) => {
                const maxCount = Math.max(1, ...funnelData.map(s => s.value))
                const width = Math.max(8, (stage.value / maxCount) * 100)
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: '#F0EDE8' }}>{stage.name}</span>
                      <span className="text-[10px]" style={{ color: '#8B8A94' }}>{stage.value} leads · {stage.total}</span>
                    </div>
                    <div className="h-6 rounded-lg overflow-hidden" style={{ background: '#1A1A1F' }}>
                      <motion.div
                        className="h-full rounded-lg"
                        style={{ background: stage.fill, width: `${width}%` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Leads by Day (Line Chart) */}
        <div className="rounded-xl border p-4" style={{ background: '#111114', borderColor: '#2A2A32' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#F0EDE8' }}>Leads por Período</h3>
          {leadsByDay.every(d => d.leads === 0) ? (
            <div className="flex items-center justify-center py-12 opacity-40">
              <p className="text-xs" style={{ color: '#8B8A94' }}>Sem leads no período selecionado</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={leadsByDay}>
                <CartesianGrid stroke="#1A1A1F" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="leads" name="Leads" stroke="#D4AF37" strokeWidth={2} dot={{ fill: '#D4AF37', r: 3 }} activeDot={{ r: 5, fill: '#D4AF37' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2: Score Distribution + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Score Distribution */}
        <div className="rounded-xl border p-4" style={{ background: '#111114', borderColor: '#2A2A32' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#F0EDE8' }}>Distribuição de Score IA</h3>
          {scoredLeads.length === 0 ? (
            <div className="flex items-center justify-center py-12 opacity-40">
              <p className="text-xs" style={{ color: '#8B8A94' }}>Scores serão calculados automaticamente</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid stroke="#1A1A1F" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8A94' }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                  {scoreDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Heatmap */}
        <MessageHeatmap leads={leads} />
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <div className="rounded-xl border p-4 mb-6" style={{ background: '#111114', borderColor: '#2A2A32' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#F0EDE8' }}>
            Precisam de Atenção
            <span className="ml-2 text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: '#FF6B4A18', color: '#FF6B4A' }}>
              {needsAttention.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {needsAttention.map((lead, i) => {
              const statusColor = STATUS_COLORS[lead.status] ?? '#8B8A94'
              return (
                <motion.div
                  key={lead.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-white/[0.02]"
                  style={{ border: '1px solid #1A1A1F' }}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ background: `${statusColor}18`, color: statusColor }}
                  >
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: '#F0EDE8' }}>{lead.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: statusColor }}>{STATUS_LABELS[lead.status]}</span>
                      <span className="text-[10px]" style={{ color: '#8B8A94' }}>{timeAgo(lead.lastInteractionAt)}</span>
                      {lead.churnRisk != null && lead.churnRisk >= 50 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#FF6B4A18', color: '#FF6B4A' }}>
                          Risco {lead.churnRisk}%
                        </span>
                      )}
                    </div>
                  </div>
                  {lead.expectedValue != null && lead.expectedValue > 0 && (
                    <span className="text-[10px] font-medium shrink-0" style={{ color: '#D4AF37' }}>
                      {currencyFmt.format(lead.expectedValue)}
                    </span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detail Tabs */}
      <div className="inline-flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
        {([
          { key: 'score' as const, label: 'Score IA', count: scoredLeads.length },
          { key: 'window' as const, label: 'Janela de Ouro', count: goldenWindowLeads.length },
          { key: 'churn' as const, label: 'Radar de Retenção', count: atRiskLeads.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === tab.key ? 'var(--crm-surface-2)' : 'transparent',
              color: activeTab === tab.key ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            {tab.label} <span className="opacity-40 ml-1">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'score' && (
        <div className="space-y-2">
          {topByScore.length === 0 ? (
            <div className="flex flex-col items-center py-16 opacity-40">
              <svg width="32" height="32" fill="none" stroke="#8B8A94" strokeWidth="1.2" viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Scores de IA serão calculados automaticamente</p>
            </div>
          ) : (
            topByScore.map((lead, i) => {
              const scoreColor = (lead.aiScore ?? 0) >= 70 ? '#2ECC8A' : (lead.aiScore ?? 0) >= 40 ? '#F0A500' : '#4A7BFF'
              return (
                <motion.div
                  key={lead.id}
                  className="flex items-center gap-4 p-3 rounded-xl border"
                  style={{ background: '#111114', borderColor: '#2A2A32' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="relative shrink-0">
                    <ScoreRing value={lead.aiScore ?? 0} color={scoreColor} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: scoreColor }}>
                      {lead.aiScore}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>{lead.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: (STATUS_COLORS[lead.status] ?? '#8B8A94') + '18', color: STATUS_COLORS[lead.status] }}
                      >
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>{lead.stageName}</span>
                      {lead.expectedValue != null && lead.expectedValue > 0 && (
                        <span className="text-[11px] font-medium" style={{ color: '#D4AF37' }}>
                          {currencyFmt.format(lead.expectedValue)}
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>{timeAgo(lead.lastInteractionAt)}</span>
                    </div>
                    {lead.aiScoreLabel && (
                      <p className="text-[10px] mt-1" style={{ color: '#8B8A94' }}>{lead.aiScoreLabel}</p>
                    )}
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'window' && (
        <div className="space-y-2">
          {topGoldenWindow.length === 0 ? (
            <div className="flex flex-col items-center py-16 opacity-40">
              <svg width="32" height="32" fill="none" stroke="#D4AF37" strokeWidth="1.2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Janelas de Ouro aparecem após padrões de interação</p>
            </div>
          ) : (
            topGoldenWindow.map((lead, i) => (
              <motion.div
                key={lead.id}
                className="flex items-center gap-4 p-3 rounded-xl border"
                style={{ background: '#111114', borderColor: '#2A2A32' }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(212,175,55,0.08)' }}
                >
                  <svg width="20" height="20" fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>{lead.name}</span>
                    <span className="text-[10px]" style={{ color: '#8B8A94' }}>{lead.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                    >
                      {lead.bestContactDays} · {lead.bestContactHours}
                    </span>
                    {lead.bestContactBasis != null && lead.bestContactBasis > 0 && (
                      <span className="text-[10px]" style={{ color: '#8B8A94' }}>
                        Base: {lead.bestContactBasis} conversões
                      </span>
                    )}
                  </div>
                </div>
                {lead.expectedValue != null && lead.expectedValue > 0 && (
                  <span className="text-xs font-medium shrink-0" style={{ color: '#D4AF37' }}>
                    {currencyFmt.format(lead.expectedValue)}
                  </span>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {activeTab === 'churn' && (
        <div className="space-y-2">
          {topAtRisk.length === 0 ? (
            <div className="flex flex-col items-center py-16 opacity-40">
              <svg width="32" height="32" fill="none" stroke="#2ECC8A" strokeWidth="1.2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Nenhum lead em risco de churn. Excelente!</p>
            </div>
          ) : (
            topAtRisk.map((lead, i) => {
              const riskColor = (lead.churnRisk ?? 0) >= 70 ? '#FF6B4A' : (lead.churnRisk ?? 0) >= 40 ? '#F0A500' : '#2ECC8A'
              return (
                <motion.div
                  key={lead.id}
                  className="flex items-center gap-4 p-3 rounded-xl border"
                  style={{ background: '#111114', borderColor: '#2A2A32' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="relative shrink-0">
                    <ScoreRing value={lead.churnRisk ?? 0} color={riskColor} />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: riskColor }}>
                      {lead.churnRisk}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>{lead.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: riskColor + '18', color: riskColor }}
                      >
                        {(lead.churnRisk ?? 0) >= 70 ? 'ALTO RISCO' : 'ATENÇÃO'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>{lead.stageName}</span>
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>
                        Última interação: {timeAgo(lead.lastInteractionAt)}
                      </span>
                    </div>
                    {lead.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {lead.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[9px] px-1 py-0.5 rounded"
                            style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                          >{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {lead.expectedValue != null && lead.expectedValue > 0 && (
                    <div className="shrink-0 text-right">
                      <span className="text-xs font-medium" style={{ color: '#FF6B4A' }}>
                        {currencyFmt.format(lead.expectedValue)}
                      </span>
                      <p className="text-[9px]" style={{ color: '#8B8A94' }}>em risco</p>
                    </div>
                  )}
                </motion.div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
