'use client'

import { useState, useEffect, useRef } from 'react'
import { useAdmin } from './AdminContext'
import Link from 'next/link'

/* ─── Types ─── */
interface Stats {
  totalClients: number; appointmentsThisMonth: number; appointmentsLastMonth: number
  revenueThisMonth: number; revenueLastMonth: number; revenueGrowth: number; appointmentGrowth: number
  pendingAppointments: number; expensesThisMonth: number; profit: number
  averageTicket: number; ltv: number; mrr: number; occupancyRate: number
  noShowRate: number; cancellationRate: number; conversionRate: number
}
interface StatusCounts { pending: number; confirmed: number; completed: number; cancelled: number; noShow: number }
interface WeekDay { day: string; count: number }
interface TopSvc { name: string; count: number; price: number }
interface Apt { id: string; scheduledAt: string; status: string; type: string; user: { name: string; phone?: string }; service: { name: string; duration?: number }; price: number }
interface Payment { id: string; amount: number; method: string; description?: string; createdAt: string; user?: { name: string } }
interface FollowUp { patientName: string; patientPhone?: string; lastService: string; lastDate: string }

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtCurShort = (v: number) => {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`
  return fmtCur(v)
}
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const ST: Record<string, { label: string; cls: string; dot: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
  COMPLETED: { label: 'Realizado', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20', dot: 'bg-blue-400' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-red-500/15 text-red-400 border-red-500/20', dot: 'bg-red-400' },
  NO_SHOW: { label: 'Faltou', cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20', dot: 'bg-zinc-400' },
}

/* ─── Animated Value Counter ─── */
function AnimatedValue({ to, duration = 1200, format }: { to: number; duration?: number; format: (v: number) => string }) {
  const [val, setVal] = useState(0)
  const prevRef = useRef(0)
  useEffect(() => {
    const from = prevRef.current
    const diff = to - from
    const t0 = performance.now()
    let raf: number
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      const cur = from + diff * ease
      setVal(cur)
      if (p < 1) raf = requestAnimationFrame(step)
      else prevRef.current = to
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])
  return <>{format(val)}</>
}

/* ─── Animated Bar (Service Mix) ─── */
function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(pct), 100 + delay); return () => clearTimeout(t) }, [pct, delay])
  return (
    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: color, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
    </div>
  )
}

/* ─── Info Tooltip (i) — Power BI style ─── */
function Tip({ children, variant = 'default' }: { children: string; variant?: 'default' | 'light' }) {
  const [show, setShow] = useState(false)
  const isLight = variant === 'light'
  return (
    <span className="relative inline-flex ml-1.5 cursor-help align-middle"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
        isLight
          ? 'bg-white/20 hover:bg-white/35 shadow-sm shadow-white/10'
          : 'bg-gradient-to-br from-white/10 to-white/15 hover:from-[#b76e79]/20 hover:to-[#b76e79]/30 shadow-sm'
      }`}>
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="opacity-80">
          <circle cx="12" cy="12" r="10" stroke={isLight ? 'white' : '#b76e79'} strokeWidth="2"/>
          <path d="M12 16v-4M12 8h.01" stroke={isLight ? 'white' : '#b76e79'} strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 px-4 py-3 bg-stone-900/95 backdrop-blur-md text-white text-[11px] leading-relaxed rounded-xl animate-in fade-in zoom-in-95 duration-200 origin-bottom shadow-2xl shadow-black/50 z-[9999] text-center border border-white/10">
          {children}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-stone-900/95" />
        </span>
      )}
    </span>
  )
}

/* ─── SVG Icons ─── */
const I = {
  revenue: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  ticket: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><path d="M6 16h2m4 0h6"/></svg>,
  ltv: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  mrr: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  users: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  cal: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  phone: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  arrow: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  up: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1 L9 6 L1 6 Z" fill="currentColor"/></svg>,
  down: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 9 L9 4 L1 4 Z" fill="currentColor"/></svg>,
  bell: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
}

/* ─── Donut Chart (animated) ─── */
function DonutChart({ segments, size = 140 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t) }, [])
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div style={{ width: size, height: size }} className="rounded-full bg-white/[0.04] flex items-center justify-center text-white/30 text-[10px]">Sem dados</div>
  const cx = size / 2; const cy = size / 2; const r = size * 0.35; const sw = size * 0.11
  const circ = 2 * Math.PI * r
  const filtered = segments.filter(s => s.value > 0)
  const arcs = filtered.map((s, i) => {
    const startAngle = -90 + filtered.slice(0, i).reduce((acc, prev) => acc + (prev.value / total) * 360, 0)
    const arcLen = (s.value / total) * circ
    return { ...s, startAngle, arcLen, pct: Math.round((s.value / total) * 100) }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth={sw} />
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${animated ? a.arcLen : 0} ${circ}`}
          style={{ transform: `rotate(${a.startAngle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: `stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.12}s` }} />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="700">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="currentColor" fillOpacity="0.5" fontSize="9">total</text>
    </svg>
  )
}

/* ─── Bar Chart (animated) ─── */
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 250); return () => clearTimeout(t) }, [])
  const max = Math.max(...data.map(d => d.value), 1)
  const h = 120
  const barW = data.length > 0 ? Math.min(28, Math.floor(200 / data.length)) : 20
  const gap = 6
  const totalW = data.length * (barW + gap)
  return (
    <div className="flex flex-col items-center">
      <svg width={totalW} height={h + 24} viewBox={`0 0 ${totalW} ${h + 24}`}>
        {[0.25, 0.5, 0.75, 1].map((pct, i) => (
          <line key={i} x1="0" y1={h - h * pct} x2={totalW} y2={h - h * pct} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const barH = max > 0 ? (d.value / max) * (h - 10) : 0
          const x = i * (barW + gap) + gap / 2
          return (
            <g key={i}>
              <rect x={x} y={h - barH} width={barW} height={Math.max(barH, 0)} rx="3" fill="url(#barGrad)"
                opacity={animated ? 0.5 + (d.value / max) * 0.5 : 0}
                style={{ transform: `scaleY(${animated ? 1 : 0})`, transformOrigin: `${x + barW / 2}px ${h}px`, transition: `transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.08}s, opacity 0.4s ease ${i * 0.08}s` }} />
              <text x={x + barW / 2} y={h + 14} textAnchor="middle" fill="currentColor" fillOpacity="0.5" fontSize="9">{d.label}</text>
              {d.value > 0 && <text x={x + barW / 2} y={h - barH - 4} textAnchor="middle" fill="currentColor" fillOpacity="0.5" fontSize="9"
                style={{ opacity: animated ? 1 : 0, transition: `opacity 0.5s ease ${0.7 + i * 0.08}s` }}>{d.value}</text>}
            </g>
          )
        })}
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b76e79" />
            <stop offset="100%" stopColor="#d4a0a7" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

/* ─── Gauge / Metric Ring (animated) ─── */
function MetricRing({ value, max, label, color, size = 64 }: { value: number; max: number; label: string; color: string; size?: number }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 400); return () => clearTimeout(t) }, [])
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const r = size / 2 - 5; const circ = 2 * Math.PI * r
  const offset = animated ? circ * (1 - pct) : circ
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="4" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/85 text-xs font-bold">
            <AnimatedValue to={pct * 100} duration={1200} format={v => `${Math.round(v)}%`} />
          </span>
        </div>
      </div>
      <span className="text-white/35 text-[9px] font-medium text-center leading-tight">{label}</span>
    </div>
  )
}

/* ─── Health Indicator ─── */
function HealthBadge({ stats }: { stats: Stats }) {
  // Green: profit positive, occupancy > 40%, cancellation < 20%
  // Yellow: some concerns
  // Red: negative profit or high cancellation
  let level: 'green' | 'yellow' | 'red' = 'green'
  if (stats.profit < 0 || stats.cancellationRate > 30) level = 'red'
  else if (stats.profit === 0 || stats.occupancyRate < 30 || stats.cancellationRate > 15) level = 'yellow'

  const colors = { green: 'bg-emerald-400', yellow: 'bg-amber-400', red: 'bg-red-400' }
  const labels = { green: 'Saudável', yellow: 'Atenção', red: 'Crítico' }
  const borders = { green: 'border-emerald-500/20 bg-emerald-500/8', yellow: 'border-amber-500/20 bg-amber-500/8', red: 'border-red-500/20 bg-red-500/8' }
  const texts = { green: 'text-emerald-400', yellow: 'text-amber-400', red: 'text-red-400' }

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${borders[level]}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${colors[level]} animate-pulse`} />
      <span className={`text-[10px] font-semibold ${texts[level]}`}>{labels[level]}</span>
    </div>
  )
}

export default function AdminDashboard() {
  const { fetchWithAuth, user } = useAdmin()
  const [stats, setStats] = useState<Stats | null>(null)
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null)
  const [weeklyActivity, setWeeklyActivity] = useState<WeekDay[]>([])
  const [topServices, setTopServices] = useState<TopSvc[]>([])
  const [upcoming, setUpcoming] = useState<Apt[]>([])
  const [todayApts, setTodayApts] = useState<Apt[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/api/admin/dashboard')
        if (res.ok) {
          const d = await res.json()
          setStats(d.stats)
          setStatusCounts(d.appointmentsByStatus)
          setWeeklyActivity(d.weeklyActivity || [])
          setTopServices(d.topServices || [])
          setUpcoming(d.upcomingAppointments || [])
          setTodayApts(d.todayAppointments || [])
          setPayments(d.recentPayments || [])
          setFollowUps(d.followUpAlerts || [])
        }
      } catch {}
      setLoading(false)
    })()
  }, [fetchWithAuth])

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>

  if (!stats) return <div className="text-white/40 text-center py-12 text-sm">Erro ao carregar dados</div>

  const statusSegments = statusCounts ? [
    { value: statusCounts.completed, color: '#60a5fa', label: 'Realizados' },
    { value: statusCounts.confirmed, color: '#34d399', label: 'Confirmados' },
    { value: statusCounts.pending, color: '#fbbf24', label: 'Pendentes' },
    { value: statusCounts.cancelled, color: '#f87171', label: 'Cancelados' },
    { value: statusCounts.noShow, color: '#71717a', label: 'Faltaram' },
  ] : []

  const totalSvcCount = topServices.reduce((s, t) => s + t.count, 0)

  /* ─── Dynamic Tooltip Messages ─── */
  const tip = {
    revenue: `Total de receitas do mês atual. ${stats.revenueGrowth >= 0 ? '📈 Crescendo vs mês anterior — ótimo sinal!' : '📉 Queda vs mês anterior — analise as causas.'}`,
    ticket: `Valor médio por atendimento. ${stats.averageTicket >= 250 ? '✅ Valor saudável para o segmento.' : '💡 Considere estratégias de upsell.'}`,
    ltv: `Lifetime Value — receita total por cliente. ${stats.ltv >= 1000 ? '✅ Boa retenção de clientes.' : '💡 Trabalhe a fidelização com pacotes.'}`,
    mrr: `Receita Recorrente Mensal — pacotes ativos. ${stats.mrr > 0 ? '✅ Base recorrente ativa.' : '💡 Venda mais pacotes para previsibilidade.'}`,
    profit: `Faturamento menos despesas. ${stats.profit >= 0 ? '✅ Operação lucrativa!' : '🚨 Despesas excedem receitas — revise custos.'}`,
    occupancy: `% de horários ocupados na agenda. ${stats.occupancyRate >= 70 ? '✅ Excelente aproveitamento!' : stats.occupancyRate >= 40 ? '💡 Há espaço para mais clientes.' : '⚠️ Agenda ociosa — invista em captação.'}`,
    conversion: `% de agendamentos realizados vs total. ${stats.conversionRate >= 80 ? '✅ Alta taxa de comparecimento!' : stats.conversionRate >= 60 ? 'Dentro da média.' : '⚠️ Muitas desistências — use lembretes.'}`,
    noshow: `Taxa de faltas sem aviso. ${stats.noShowRate <= 5 ? '✅ Praticamente zero faltas!' : stats.noShowRate <= 15 ? 'Dentro do aceitável.' : '🚨 Alta — ative lembretes automáticos.'}`,
  }

  const cardShadow = 'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]'

  return (
    <div className="space-y-5 lg:space-y-6 animate-[fadeIn_0.4s_ease-out]">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white/90 tracking-tight">{greeting()}, {user?.name?.split(' ')[0]}</h1>
          <p className="text-white/40 text-xs lg:text-sm mt-0.5 capitalize">Visão geral · {currentMonth}</p>
        </div>
        <HealthBadge stats={stats} />
      </div>

      {/* ═══ KPIs Financeiros — Power BI Style ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {/* Faturamento */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35 hover:-translate-y-0.5 transition-all relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-white text-[9px] font-semibold uppercase tracking-wider">Faturamento</span>
                <Tip variant="light">{tip.revenue}</Tip>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold tracking-tight"><AnimatedValue to={stats.revenueThisMonth ?? 0} format={fmtCurShort} /></div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded ${stats.revenueGrowth >= 0 ? 'bg-white/20' : 'bg-red-400/30'}`}>
                  {stats.revenueGrowth >= 0 ? I.up : I.down} {Math.abs(stats.revenueGrowth ?? 0)}%
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">{I.revenue}</div>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/35 hover:-translate-y-0.5 transition-all relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-white text-[9px] font-semibold uppercase tracking-wider">Ticket Médio</span>
                <Tip variant="light">{tip.ticket}</Tip>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold tracking-tight"><AnimatedValue to={stats.averageTicket ?? 0} format={fmtCurShort} /></div>
              <div className="text-white/80 text-[9px] mt-1.5">por paciente/mês</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">{I.ticket}</div>
          </div>
        </div>

        {/* LTV */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35 hover:-translate-y-0.5 transition-all relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-white text-[9px] font-semibold uppercase tracking-wider">LTV</span>
                <Tip variant="light">{tip.ltv}</Tip>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold tracking-tight"><AnimatedValue to={stats.ltv ?? 0} format={fmtCurShort} /></div>
              <div className="text-white/80 text-[9px] mt-1.5">valor vitalício</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">{I.ltv}</div>
          </div>
        </div>

        {/* MRR */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/35 hover:-translate-y-0.5 transition-all relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-white text-[9px] font-semibold uppercase tracking-wider">MRR</span>
                <Tip variant="light">{tip.mrr}</Tip>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold tracking-tight"><AnimatedValue to={stats.mrr ?? 0} format={fmtCurShort} /></div>
              <div className="text-white/80 text-[9px] mt-1.5">receita recorrente</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">{I.mrr}</div>
          </div>
        </div>

        {/* Lucro */}
        <div className={`rounded-2xl p-4 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all relative ${
          stats.profit >= 0
            ? 'bg-gradient-to-br from-[#b76e79] to-[#9a5b64] shadow-[#b76e79]/25 hover:shadow-[#b76e79]/35'
            : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/25 hover:shadow-red-500/35'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-white text-[9px] font-semibold uppercase tracking-wider">Lucro Líquido</span>
                <Tip variant="light">{tip.profit}</Tip>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold tracking-tight"><AnimatedValue to={stats.profit ?? 0} format={fmtCurShort} /></div>
              {stats.revenueThisMonth > 0 && (
                <div className="text-white/80 text-[9px] mt-1.5 font-medium">
                  Margem: {Math.round(((stats.profit ?? 0) / (stats.revenueThisMonth ?? 1)) * 100)}%
                </div>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">{I.revenue}</div>
          </div>
        </div>
      </div>

      {/* ═══ Gráficos — Power BI Tiles ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        {/* Status dos Agendamentos (Donut) */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] shadow-none hover:bg-white/[0.06] transition-all overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-cyan-400" />
          <div className="p-5 lg:p-6">
            <h3 className="text-sm font-semibold text-white/85 mb-5">Status dos Agendamentos</h3>
            <div className="flex items-center gap-4 lg:gap-6">
              <DonutChart segments={statusSegments} size={130} />
              <div className="space-y-2.5 flex-1">
                {statusSegments.filter(s => s.value > 0).map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: s.color }} />
                      <span className="text-white/40 text-[11px]">{s.label}</span>
                    </div>
                    <span className="text-white/70 text-xs font-bold">{s.value}</span>
                  </div>
                ))}
                {statusSegments.every(s => s.value === 0) && <p className="text-white/20 text-xs">Nenhum agendamento</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Atividade Semanal (Bar) */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] shadow-none hover:bg-white/[0.06] transition-all overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#b76e79] to-[#d4a0a7]" />
          <div className="p-5 lg:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white/85">Atividade Semanal</h3>
              <span className="text-white/35 text-[10px] bg-white/[0.04] px-2 py-0.5 rounded-md">Semana atual</span>
            </div>
            <BarChart data={weeklyActivity.map(w => ({ label: w.day, value: w.count }))} />
          </div>
        </div>

        {/* Mix de Serviços */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] shadow-none hover:bg-white/[0.06] transition-all overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <div className="p-5 lg:p-6">
            <h3 className="text-sm font-semibold text-white/85 mb-5">Mix de Serviços</h3>
          {topServices.length === 0 ? (
            <p className="text-white/20 text-xs py-8 text-center">Nenhum serviço registrado</p>
          ) : (
            <div className="space-y-4">
              {topServices.map((s, i) => {
                const pct = totalSvcCount > 0 ? Math.round((s.count / totalSvcCount) * 100) : 0
                const colors = ['#b76e79', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa']
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white/60 text-[11px] font-medium truncate max-w-[160px]">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/35 text-[10px]">{s.count}x</span>
                        <span className="text-white/70 text-[11px] font-bold w-10 text-right">{pct}%</span>
                      </div>
                    </div>
                    <AnimatedBar pct={pct} color={colors[i % colors.length]} delay={i * 150} />
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ═══ Métricas de Performance ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="bg-gradient-to-br from-[#b76e79]/[0.08] to-white/[0.02] rounded-2xl border border-white/[0.06] p-5 shadow-none transition-all">
          <div className="flex items-center gap-4">
            <MetricRing value={stats.occupancyRate} max={100} label="Ocupação" color="#b76e79" size={72} />
            <div className="flex-1">
              <div className="flex items-center mb-0.5">
                <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Ocupação</span>
                <Tip>{tip.occupancy}</Tip>
              </div>
              <div className="text-white/90 text-xl font-extrabold"><AnimatedValue to={stats.occupancyRate} format={v => `${Math.round(v)}%`} /></div>
              <div className={`text-[10px] font-medium mt-0.5 ${stats.occupancyRate >= 75 ? 'text-emerald-500' : stats.occupancyRate >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                {stats.occupancyRate >= 75 ? '● Ótimo nível' : stats.occupancyRate >= 50 ? '● Pode melhorar' : '● Agenda ociosa'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] rounded-2xl border border-white/[0.06] p-5 shadow-none transition-all">
          <div className="flex items-center gap-4">
            <MetricRing value={stats.conversionRate} max={100} label="Conversão" color="#34d399" size={72} />
            <div className="flex-1">
              <div className="flex items-center mb-0.5">
                <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Conversão</span>
                <Tip>{tip.conversion}</Tip>
              </div>
              <div className="text-white/90 text-xl font-extrabold"><AnimatedValue to={stats.conversionRate} format={v => `${Math.round(v)}%`} /></div>
              <div className={`text-[10px] font-medium mt-0.5 ${stats.conversionRate >= 80 ? 'text-emerald-500' : stats.conversionRate >= 60 ? 'text-amber-500' : 'text-red-400'}`}>
                {stats.conversionRate >= 80 ? '● Excelente' : stats.conversionRate >= 60 ? '● Dentro da média' : '● Atenção'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500/[0.08] to-white/[0.02] rounded-2xl border border-white/[0.06] p-5 shadow-none transition-all">
          <div className="flex items-center gap-4">
            <MetricRing value={stats.noShowRate} max={100} label="No-Show" color={stats.noShowRate <= 10 ? '#a3a3a3' : '#f87171'} size={72} />
            <div className="flex-1">
              <div className="flex items-center mb-0.5">
                <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">No-Show</span>
                <Tip>{tip.noshow}</Tip>
              </div>
              <div className="text-white/90 text-xl font-extrabold"><AnimatedValue to={stats.noShowRate} format={v => `${Math.round(v)}%`} /></div>
              <div className={`text-[10px] font-medium mt-0.5 ${stats.noShowRate <= 5 ? 'text-emerald-500' : stats.noShowRate <= 15 ? 'text-amber-500' : 'text-red-400'}`}>
                {stats.noShowRate <= 5 ? '● Excelente' : stats.noShowRate <= 15 ? '● Aceitável' : '● Alto — Agir!'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/[0.08] to-white/[0.02] rounded-2xl border border-white/[0.06] p-5 shadow-none transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400">{I.users}</div>
            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Resumo Mês</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-white/90 text-lg font-extrabold"><AnimatedValue to={stats.totalClients} format={v => String(Math.round(v))} /></div>
              <div className="text-white/35 text-[10px]">Clientes</div>
            </div>
            <div>
              <div className="text-white/90 text-lg font-extrabold"><AnimatedValue to={stats.appointmentsThisMonth} format={v => String(Math.round(v))} /></div>
              <div className="text-white/35 text-[10px]">Agendamentos</div>
            </div>
            <div>
              <div className="text-amber-500 text-lg font-extrabold"><AnimatedValue to={stats.pendingAppointments} format={v => String(Math.round(v))} /></div>
              <div className="text-white/35 text-[10px]">Pendentes</div>
            </div>
            <div>
              <div className={`text-lg font-extrabold ${stats.appointmentGrowth >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                <AnimatedValue to={stats.appointmentGrowth} format={v => `${v >= 0 ? '+' : ''}${Math.round(v)}%`} />
              </div>
              <div className="text-stone-400 text-[10px]">Crescimento</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Operação Diária ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Agenda do Dia */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] shadow-none hover:bg-white/[0.06] transition-all overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#b76e79] to-[#d4a0a7]" />
          <div className="flex items-center justify-between px-4 lg:px-6 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-white/85 flex items-center gap-2">{I.cal} Agenda do Dia</h3>
            <Link href="/admin/agenda" className="text-[#b76e79] text-[11px] font-medium hover:underline flex items-center gap-1">Ver agenda {I.arrow}</Link>
          </div>
          <div className="px-5 pb-5 max-h-80 overflow-y-auto">
            {todayApts.length === 0 && upcoming.length === 0 ? (
              <p className="text-white/20 text-sm py-8 text-center">Nenhum agendamento hoje</p>
            ) : (
              <div>
                {/* Today's */}
                {todayApts.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    <div className="text-white/30 text-[9px] font-semibold uppercase tracking-widest px-1">Hoje</div>
                    {todayApts.map(apt => {
                      const st = ST[apt.status] || ST.PENDING
                      return (
                        <div key={apt.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5">
                          <div className="text-[#b76e79] text-[11px] font-bold w-11 text-center">{fmtTime(apt.scheduledAt)}</div>
                          <div className="w-px h-7 bg-white/10" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-white/85 text-[11px] font-medium truncate">{apt.user.name}</div>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} title={st.label} />
                            </div>
                            <div className="text-white/35 text-[10px] truncate">{apt.service.name}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-medium border ${st.cls}`}>{st.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Upcoming */}
                {upcoming.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-white/30 text-[9px] font-semibold uppercase tracking-widest px-1">Próximos</div>
                    {upcoming.slice(0, 5).map(apt => {
                      const st = ST[apt.status] || ST.PENDING
                      return (
                        <div key={apt.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
                          <div className="text-white/35 text-[10px] font-medium w-11 text-center">{fmtDate(apt.scheduledAt)}</div>
                          <div className="w-px h-6 bg-white/[0.04]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-white/70 text-[11px] font-medium truncate">{apt.user.name}</div>
                            <div className="text-white/35 text-[10px] truncate">{apt.service.name} · {fmtTime(apt.scheduledAt)}</div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${st.cls}`}>{st.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Follow-up Alerts + Recent Payments */}
        <div className="space-y-4">
          {/* Follow-up Alerts */}
          <div className="bg-gradient-to-br from-amber-500/[0.08] to-white/[0.02] rounded-2xl border border-amber-500/10 p-6 shadow-none transition-all">
            <h3 className="text-xs font-semibold text-amber-400 flex items-center gap-2 mb-3">
              {I.bell} <span>Alertas de Follow-up</span>
              {followUps.length > 0 && <span className="bg-amber-500/15 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{followUps.length}</span>}
            </h3>
            {followUps.length === 0 ? (
              <p className="text-amber-400/40 text-[10px] py-4 text-center">Nenhum follow-up pendente. Todas as pacientes estão em dia!</p>
            ) : (
              <div className="space-y-2">
                {followUps.slice(0, 5).map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-amber-400 text-[11px] font-medium truncate">{f.patientName}</div>
                      <div className="text-amber-500/50 text-[10px] truncate">{f.lastService} · Último: {fmtDate(f.lastDate)}</div>
                    </div>
                    {f.patientPhone && (
                      <a href={`https://wa.me/55${f.patientPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20 transition-all flex-shrink-0">
                        {I.phone} Contatar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] rounded-2xl border border-emerald-500/10 p-6 shadow-none transition-all">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-emerald-400">Últimos Pagamentos</h3>
              <Link href="/admin/financeiro" className="text-[#b76e79] text-[10px] hover:underline flex items-center gap-1">Financeiro {I.arrow}</Link>
            </div>
            {payments.length === 0 ? (
              <p className="text-emerald-400/40 text-[10px] py-4 text-center">Nenhum pagamento registrado</p>
            ) : (
              <div className="space-y-1.5">
                {payments.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-emerald-500/10 last:border-0">
                    <div className="min-w-0">
                      <div className="text-emerald-400 text-[11px] font-medium truncate">{p.user?.name || p.description || 'Pagamento'}</div>
                      <div className="text-emerald-500/40 text-[10px]">{fmtDate(p.createdAt)} · {p.method}</div>
                    </div>
                    <span className="text-emerald-500 text-xs font-semibold flex-shrink-0">+{fmtCur(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Quick Actions Power BI Style ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mt-2">
        {(
          [
            { href: '/admin/agenda', label: 'Agenda', icon: I.cal, grad: 'from-blue-400 to-cyan-400' },
            { href: '/admin/clientes', label: 'Clientes', icon: I.users, grad: 'from-[#b76e79] to-[#d4a0a7]' },
            { href: '/admin/financeiro', label: 'Financeiro', icon: I.revenue, grad: 'from-emerald-400 to-teal-400' },
            { href: '/admin/configuracoes', label: 'Configurações', icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, grad: 'from-amber-400 to-orange-400' },
          ]
        ).map(a => (
          <Link key={a.href} href={a.href} className={`rounded-2xl p-4 text-center shadow-md shadow-black/20 hover:shadow-lg transition-all group bg-gradient-to-br ${a.grad} text-white`}>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2 text-white group-hover:bg-white/30 transition-all">{a.icon}</div>
            <div className="text-white/90 text-[11px] font-medium group-hover:text-white transition-colors">{a.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
