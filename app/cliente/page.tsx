'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClient } from './ClientContext'
import Link from 'next/link'
import { SkeletonBox, SkeletonCard, SkeletonAppointment, SkeletonKPI } from '@/components/Skeleton'
import dynamic from 'next/dynamic'

const FeedbackModal = dynamic(() => import('@/components/FeedbackModal'), { ssr: false })

/* ─── Types ─── */
interface Protocol {
  id: string; name: string; serviceName: string; serviceId: string
  totalSessions: number; usedSessions: number; remaining: number; progressPercent: number
  phase: { number: number; name: string; description: string }
}
interface NextApt { id: string; scheduledAt: string; serviceName: string; duration: number; status: string; type: string; location: string }
interface UpcomingApt { id: string; scheduledAt: string; serviceName: string; status: string; type: string }
interface Session { id: string; date: string; serviceName: string; duration: number; price: number }
interface Stats { totalSessions: number; completedSessions: number; upcomingSessions: number; cancelledSessions: number; activePackages: number; completedPackages: number; totalInvested: number; balance: number }
interface MonthAct { month: string; sessions: number }
interface BodyMetrics {
  hasMeasurements: boolean; totalMeasurements: number
  latest: { date: string; weight?: number; bodyFat?: number; waist?: number; hip?: number; bmi?: number } | null
  deltas: { weight: number | null; waist: number | null; hip: number | null; bodyFat: number | null } | null
}
interface AnamneseStatus { completed: boolean; completedAt?: string; pct: number }
interface PendingReview { id: string; scheduledAt: string; serviceName: string; duration: number }

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtShortDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

/* ─── Micro Icons ─── */
const I = {
  cal: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pin: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  arrow: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  bolt: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  check: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  star: <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
}

const ST: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
}

/* ─── Progress Ring ─── */
function ProgressRing({ percent, size = 80, gradId = 'progressGrad' }: { percent: number; size?: number; gradId?: string }) {
  const r = size / 2 - 6; const circ = 2 * Math.PI * r; const offset = circ * (1 - percent / 100)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b76e79" />
            <stop offset="100%" stopColor="#d4a0a7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white text-lg font-bold">{percent}%</span>
      </div>
    </div>
  )
}

/* ─── Mini Bar Chart ─── */
function MiniBarChart({ data }: { data: MonthAct[] }) {
  const max = Math.max(...data.map(d => d.sessions), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div className="w-full rounded-t" style={{
            height: `${Math.max((d.sessions / max) * 48, 2)}px`,
            background: d.sessions > 0 ? 'linear-gradient(to top, #b76e79, #d4a0a7)' : 'rgba(255,255,255,0.04)',
            opacity: d.sessions > 0 ? 0.5 + (d.sessions / max) * 0.5 : 1,
          }} />
          <span className="text-white/20 text-[8px]">{d.month}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Mini Week Calendar ─── */
function MiniCalendar({ nextDate }: { nextDate?: string }) {
  const today = new Date()
  const next = nextDate ? new Date(nextDate) : null
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); return d
  })
  const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
  return (
    <div className="flex gap-1.5">
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString()
        const isNext = next && d.toDateString() === next.toDateString()
        return (
          <div key={i} className="flex-1 text-center">
            <div className="text-white/15 text-[8px] font-medium mb-1">{dayNames[i]}</div>
            <div className={`w-8 h-8 mx-auto rounded-xl flex items-center justify-center text-[11px] font-medium transition-all ${
              isNext ? 'bg-gradient-to-br from-[#b76e79] to-[#d4a0a7] text-white shadow-lg shadow-[#b76e79]/25' :
              isToday ? 'bg-white/[0.08] text-white/80 ring-1 ring-white/15' :
              'text-white/20'
            }`}>
              {d.getDate()}
            </div>
            {isNext && <div className="w-1 h-1 rounded-full bg-[#d4a0a7] mx-auto mt-1" />}
          </div>
        )
      })}
    </div>
  )
}

export default function ClienteHome() {
  const { fetchWithAuth, user } = useClient()
  const [nextApt, setNextApt] = useState<NextApt | null>(null)
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingApt[]>([])
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [monthlyActivity, setMonthlyActivity] = useState<MonthAct[]>([])
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics | null>(null)
  const [anamnese, setAnamnese] = useState<AnamneseStatus | null>(null)
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [feedbackSession, setFeedbackSession] = useState<PendingReview | null>(null)
  const [loading, setLoading] = useState(true)

  const loadPendingReviews = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/patient/pending-reviews')
      if (res.ok) {
        const data = await res.json()
        setPendingReviews(data.pendingReviews || [])
      }
    } catch { /* */ }
  }, [fetchWithAuth])

  useEffect(() => {
    (async () => {
      try {
        const [dashRes, anamRes] = await Promise.all([
          fetchWithAuth('/api/patient/dashboard'),
          fetchWithAuth('/api/patient/anamnese'),
        ])
        if (dashRes.ok) {
          const d = await dashRes.json()
          setNextApt(d.nextAppointment)
          setProtocol(d.protocolProgress)
          setUpcoming(d.upcomingAppointments || [])
          setRecentSessions(d.recentSessions || [])
          setStats(d.stats)
          setMonthlyActivity(d.monthlyActivity || [])
          setBodyMetrics(d.bodyMetrics || null)
        }
        if (anamRes.ok) {
          const a = await anamRes.json()
          if (a.anamnese) {
            setAnamnese({ completed: !!a.anamnese.completedAt, completedAt: a.anamnese.completedAt, pct: 100 })
          } else {
            setAnamnese({ completed: false, pct: 0 })
          }
        }
      } catch { /* */ }
      setLoading(false)
    })()
    loadPendingReviews()
  }, [fetchWithAuth, loadPendingReviews])

  const handleSubmitFeedback = useCallback(async (data: { appointmentId: string; score: number; comment: string; categories: string[] }) => {
    const res = await fetchWithAuth('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Erro ao enviar')
    // Atualizar lista de pendentes
    setPendingReviews(prev => prev.filter(r => r.id !== data.appointmentId))
  }, [fetchWithAuth])

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }

  if (loading) return (
    <div className="space-y-5 animate-fadeIn">
      {/* Welcome skeleton */}
      <SkeletonBox className="h-24 w-full rounded-2xl" />
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <SkeletonKPI />
        <SkeletonKPI />
      </div>
      {/* Next appointment */}
      <SkeletonAppointment />
      <SkeletonAppointment />
      {/* Cards */}
      <div className="grid grid-cols-1 gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )

  return (
    <div className="space-y-5 animate-[fadeIn_0.6s_ease-out]">

      {/* ═══ Welcome Banner ═══ */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-[#b76e79]/35 via-[#9e6670]/25 to-purple-500/15" />
        <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-radial from-[#d4a0a7]/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-radial from-purple-500/12 to-transparent rounded-full translate-y-16 -translate-x-8" />
        <div className="relative border border-[#b76e79]/20 rounded-3xl p-8">
          <p className="text-[#d4a0a7]/70 text-[10px] font-bold tracking-[0.2em] uppercase mb-2">🌿 Arquitetura Corporal</p>
          <h1 className="text-3xl lg:text-4xl font-light text-white/98 tracking-tight leading-tight">
            {greeting()}, <span className="font-bold bg-gradient-to-r from-[#d4a0a7] to-[#ffdddd] bg-clip-text text-transparent">{user?.name?.split(' ')[0]}</span> ✨
          </h1>
          <p className="text-white/60 text-sm mt-3">Sua jornada de transformação com Mykaele Procópio</p>

          {/* Quick Stats Inline */}
          <div className="flex gap-3 mt-6">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.10] border border-white/[0.15]">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-white/80 text-[12px] font-semibold">{stats?.completedSessions || 0} sessões</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.10] border border-white/[0.15]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#d4a0a7]" />
              <span className="text-white/80 text-[12px] font-semibold">{stats?.activePackages || 0} protocolos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Mini Calendar ═══ */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/8 to-blue-500/3" />
        <div className="relative border border-indigo-500/8 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">📅</span>
              <h3 className="text-sm font-medium text-white/70">Esta Semana</h3>
            </div>
            {nextApt && (
              <span className="text-[9px] px-2.5 py-1 rounded-full bg-[#b76e79]/10 text-[#d4a0a7]/70 font-medium border border-[#b76e79]/10">
                Próxima sessão {fmtShortDate(nextApt.scheduledAt)}
              </span>
            )}
          </div>
          <MiniCalendar nextDate={nextApt?.scheduledAt} />
        </div>
      </div>

      {/* ═══ Next Appointment Card ═══ */}
      {nextApt ? (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#b76e79]/20 via-[#9e6670]/12 to-[#d4a0a7]/8" />
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-radial from-[#d4a0a7]/8 to-transparent rounded-full -translate-y-10 translate-x-10" />
          <div className="relative border border-[#b76e79]/15 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-[#d4a0a7] animate-pulse" />
              <span className="text-[#d4a0a7]/60 text-[9px] font-semibold tracking-[0.2em] uppercase">Próxima Sessão</span>
            </div>
            <div className="text-white font-medium text-lg tracking-tight">{nextApt.serviceName}</div>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-white/35 text-xs">
              <span className="flex items-center gap-1.5">{I.cal} {fmtDate(nextApt.scheduledAt)}</span>
              <span className="flex items-center gap-1.5">{I.clock} {fmtTime(nextApt.scheduledAt)}</span>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <span className="flex items-center gap-1.5 text-white/25 text-[11px]">{I.pin} {nextApt.location === 'CLINIC' ? 'Clínica' : 'Home Spa'}</span>
              <span className="text-white/10">|</span>
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border ${ST[nextApt.status]?.cls || ST.PENDING.cls}`}>
                {ST[nextApt.status]?.label || 'Pendente'}
              </span>
              <span className="text-white/15 text-[10px]">{nextApt.duration}min</span>
            </div>
          </div>
        </div>
      ) : (
        <Link href="/cliente/agendar" className="group block relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#b76e79]/12 to-[#d4a0a7]/6 group-hover:from-[#b76e79]/20 transition-all duration-500" />
          <div className="relative border border-[#b76e79]/10 group-hover:border-[#b76e79]/25 rounded-3xl p-6 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#b76e79]/25 to-[#d4a0a7]/15 flex items-center justify-center text-[#d4a0a7] shadow-lg shadow-[#b76e79]/10">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14v4m-2-2h4"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-white/80 font-medium text-sm group-hover:text-white transition-colors">Agendar sua primeira sessão</div>
                <div className="text-[#c28a93]/30 text-[11px] mt-0.5">Inicie sua transformação</div>
              </div>
              <div className="text-white/10 group-hover:text-[#d4a0a7]/40 group-hover:translate-x-1 transition-all">{I.arrow}</div>
            </div>
          </div>
        </Link>
      )}

      {/* ═══ Credits / Balance Banner ═══ */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-[#d4a0a7]/40 via-[#b76e79]/30 to-[#8b4a52]/25 transition-all duration-500" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl opacity-60 transition-opacity" />
        <div className="relative border border-white/15 rounded-3xl p-6 transition-all">
          <div className="text-[#d4a0a7]/40 text-[9px] font-semibold tracking-[0.3em] uppercase mb-3">SALDO DE CRÉDITOS</div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-white font-bold text-4xl tracking-tight">
                {fmtCur(stats?.balance || 0)}
              </div>
              <div className="text-white/40 text-xs mt-1">
                {(stats?.balance || 0) > 0 ? 'Disponível para uso em sessões' : 'Nenhum saldo disponível'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/cliente/creditos" className="group/btn relative overflow-hidden rounded-2xl px-6 py-3 font-bold text-sm whitespace-nowrap transition-all duration-300 flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] group-hover/btn:from-white group-hover/btn:to-[#d4a0a7] transition-all duration-300" />
                <span className="relative text-white group-hover/btn:text-[#8b4a52] transition-colors duration-300">
                  Comprar mais créditos
                </span>
              </Link>
              <Link href="https://wa.me/5585999999999?text=Olá! Tenho uma dúvida sobre os créditos." target="_blank"
                className="px-4 py-3 rounded-2xl text-sm font-medium bg-white/[0.08] text-white/60 border border-white/10 hover:bg-white/[0.12] hover:text-white/80 transition-all whitespace-nowrap flex items-center gap-1.5">
                💬 Dúvida?
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Colorful Dashboard Cards Grid ═══ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Anamnese Card */}
        <Link href="/cliente/anamnese" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 group-hover:from-emerald-500/25 transition-all duration-500" />
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-400/[0.06] rounded-full -translate-y-6 translate-x-6 blur-xl" />
          <div className="relative border border-emerald-500/10 group-hover:border-emerald-500/20 rounded-2xl p-4 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📋</span>
              {anamnese?.completed ? (
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">{I.check}</span>
              ) : (
                <span className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70 border border-amber-500/10 font-semibold">Pendente</span>
              )}
            </div>
            <div className="text-white/70 text-xs font-semibold group-hover:text-white/90 transition-colors">Anamnese</div>
            <div className="text-white/20 text-[10px] mt-0.5">
              {anamnese?.completed ? 'Ficha completa' : 'Preencha sua ficha'}
            </div>
          </div>
        </Link>

        {/* Evolution Card */}
        <Link href="/cliente/evolucao" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-cyan-500/5 group-hover:from-blue-500/25 transition-all duration-500" />
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-400/[0.06] rounded-full -translate-y-6 translate-x-6 blur-xl" />
          <div className="relative border border-blue-500/10 group-hover:border-blue-500/20 rounded-2xl p-4 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📊</span>
              {bodyMetrics?.hasMeasurements && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/10 font-medium">
                  {bodyMetrics.totalMeasurements} avaliações
                </span>
              )}
            </div>
            <div className="text-white/70 text-xs font-semibold group-hover:text-white/90 transition-colors">Evolução</div>
            <div className="text-white/20 text-[10px] mt-0.5">
              {bodyMetrics?.hasMeasurements ? `${bodyMetrics.latest?.weight || '—'}kg · ${bodyMetrics.latest?.waist || '—'}cm` : 'Medidas corporais'}
            </div>
          </div>
        </Link>

        {/* Schedule Card */}
        <Link href="/cliente/agendar" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#b76e79]/15 to-[#d4a0a7]/5 group-hover:from-[#b76e79]/25 transition-all duration-500" />
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#d4a0a7]/[0.06] rounded-full -translate-y-6 translate-x-6 blur-xl" />
          <div className="relative border border-[#b76e79]/10 group-hover:border-[#b76e79]/20 rounded-2xl p-4 transition-all">
            <span className="text-2xl block mb-3">✨</span>
            <div className="text-white/70 text-xs font-semibold group-hover:text-white/90 transition-colors">Agendar</div>
            <div className="text-white/20 text-[10px] mt-0.5">Nova sessão</div>
          </div>
        </Link>

        {/* Protocols Card */}
        <Link href="/cliente/pacotes" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 to-violet-500/5 group-hover:from-purple-500/25 transition-all duration-500" />
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-400/[0.06] rounded-full -translate-y-6 translate-x-6 blur-xl" />
          <div className="relative border border-purple-500/10 group-hover:border-purple-500/20 rounded-2xl p-4 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">⚡</span>
              {stats && stats.activePackages > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400/70 border border-purple-500/10 font-medium">
                  {stats.activePackages} ativo{stats.activePackages > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-white/70 text-xs font-semibold group-hover:text-white/90 transition-colors">Protocolos</div>
            <div className="text-white/20 text-[10px] mt-0.5">Sua jornada</div>
          </div>
        </Link>
      </div>

      {/* ═══ Protocol Progress ═══ */}
      {protocol && (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" />
          <div className="relative border border-white/[0.06] rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">{I.bolt}</div>
                <h2 className="text-sm font-medium text-white/80">Meu Protocolo</h2>
              </div>
              <Link href="/cliente/pacotes" className="text-[#c28a93]/40 text-[10px] hover:text-[#d4a0a7] flex items-center gap-1 transition-colors">Detalhes {I.arrow}</Link>
            </div>

            <div className="flex items-center gap-6">
              <ProgressRing percent={protocol.progressPercent} />
              <div className="flex-1 min-w-0">
                <div className="text-white/85 font-medium text-[15px] tracking-tight">{protocol.name}</div>
                <div className="text-[#c28a93]/30 text-[11px] mt-0.5">{protocol.serviceName}</div>

                {/* Phases */}
                <div className="mt-4 flex items-center gap-1.5">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                        n < protocol.phase.number ? 'bg-[#b76e79]/20 text-[#d4a0a7] ring-1 ring-[#b76e79]/20' :
                        n === protocol.phase.number ? 'bg-gradient-to-br from-[#b76e79] to-[#d4a0a7] text-white shadow-lg shadow-[#b76e79]/20' :
                        'bg-white/[0.04] text-white/15 ring-1 ring-white/[0.06]'
                      }`}>
                        {n < protocol.phase.number ? I.check : n}
                      </div>
                      {n < 4 && <div className={`w-5 h-[1.5px] rounded-full ${n < protocol.phase.number ? 'bg-[#b76e79]/30' : 'bg-white/[0.05]'}`} />}
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <div className="text-[#d4a0a7]/70 text-[10px] font-semibold">Fase {protocol.phase.number}: {protocol.phase.name}</div>
                  <div className="text-white/15 text-[9px] mt-0.5">{protocol.phase.description}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center justify-between">
              <div className="text-white/20 text-[11px]">
                <span className="text-white/50 font-semibold">{protocol.usedSessions}</span> de <span className="text-white/50 font-semibold">{protocol.totalSessions}</span> sessões
              </div>
              <div className="text-[#d4a0a7]/60 text-[10px] font-semibold">{protocol.remaining} restante(s)</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Stats Grid ═══ */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: stats.completedSessions, label: 'Sessões', color: 'from-emerald-500/12 to-emerald-600/3', borderColor: 'border-emerald-500/10', textColor: 'text-emerald-400', icon: '✅' },
            { value: stats.activePackages, label: 'Protocolos', color: 'from-purple-500/12 to-purple-600/3', borderColor: 'border-purple-500/10', textColor: 'text-purple-400', icon: '⚡' },
            { value: stats.upcomingSessions, label: 'Agendados', color: 'from-amber-500/12 to-amber-600/3', borderColor: 'border-amber-500/10', textColor: 'text-amber-400', icon: '📆' },
          ].map((s, i) => (
            <div key={i} className="relative overflow-hidden rounded-2xl">
              <div className={`absolute inset-0 bg-gradient-to-br ${s.color}`} />
              <div className={`relative border ${s.borderColor} rounded-2xl p-4 text-center`}>
                <div className="text-sm mb-1.5">{s.icon}</div>
                <div className={`text-xl font-bold ${s.textColor}`}>{s.value}</div>
                <div className="text-white/20 text-[9px] mt-1 tracking-wide">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Activity Chart ═══ */}
      {monthlyActivity.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" />
          <div className="relative border border-white/[0.06] rounded-3xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-base">📈</span>
              <h3 className="text-sm font-medium text-white/70 tracking-tight">Sua Evolução</h3>
            </div>
            <MiniBarChart data={monthlyActivity} />
            <div className="text-white/10 text-[9px] mt-3 text-center tracking-wider uppercase">Sessões nos últimos 6 meses</div>
          </div>
        </div>
      )}

      {/* ═══ Body Metrics Widget ═══ */}
      {bodyMetrics && bodyMetrics.hasMeasurements && bodyMetrics.latest && (
        <Link href="/cliente/evolucao" className="group block relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 to-blue-500/3 group-hover:from-cyan-500/15 transition-all duration-500" />
          <div className="relative border border-cyan-500/8 group-hover:border-cyan-500/15 rounded-3xl p-6 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🎯</span>
                <h3 className="text-sm font-medium text-white/70">Últimas Medidas</h3>
              </div>
              <span className="text-cyan-400/30 text-[10px] flex items-center gap-1 group-hover:text-cyan-400/60 transition-colors">Detalhes {I.arrow}</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Peso', value: bodyMetrics.latest.weight, unit: 'kg', delta: bodyMetrics.deltas?.weight, color: 'text-cyan-400' },
                { label: 'Cintura', value: bodyMetrics.latest.waist, unit: 'cm', delta: bodyMetrics.deltas?.waist, color: 'text-blue-400' },
                { label: 'Quadril', value: bodyMetrics.latest.hip, unit: 'cm', delta: bodyMetrics.deltas?.hip, color: 'text-indigo-400' },
                { label: 'Gordura', value: bodyMetrics.latest.bodyFat, unit: '%', delta: bodyMetrics.deltas?.bodyFat, color: 'text-purple-400' },
              ].filter(m => m.value != null).map(m => (
                <div key={m.label} className="text-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.03]">
                  <div className={`text-sm font-bold ${m.color}`}>{m.value}<span className="text-white/20 text-[9px] ml-0.5">{m.unit}</span></div>
                  {m.delta != null && m.delta !== 0 && (
                    <div className={`text-[9px] font-semibold mt-0.5 ${m.delta < 0 ? 'text-emerald-400/70' : 'text-amber-400/70'}`}>
                      {m.delta > 0 ? '+' : ''}{m.delta}
                    </div>
                  )}
                  <div className="text-white/15 text-[8px] mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Link>
      )}

      {/* ═══ Upcoming Appointments ═══ */}
      {upcoming.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" />
          <div className="relative border border-white/[0.06] rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-base">🗓️</span>
                <h3 className="text-sm font-medium text-white/70">Próximas Sessões</h3>
              </div>
              <Link href="/cliente/agendamentos" className="text-[#c28a93]/40 text-[10px] hover:text-[#d4a0a7] flex items-center gap-1 transition-colors">Ver todas {I.arrow}</Link>
            </div>
            <div className="space-y-2.5">
              {upcoming.map(apt => (
                <div key={apt.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl px-4 py-3 hover:bg-white/[0.04] transition-all">
                  <div className="text-center min-w-[40px]">
                    <div className="text-[#d4a0a7]/60 text-[11px] font-semibold">{fmtShortDate(apt.scheduledAt)}</div>
                  </div>
                  <div className="w-px h-7 bg-white/[0.06] rounded-full" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white/70 text-[12px] font-medium truncate">{apt.serviceName}</div>
                    <div className="text-white/20 text-[10px]">{fmtTime(apt.scheduledAt)}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-medium border ${ST[apt.status]?.cls || ST.PENDING.cls}`}>
                    {ST[apt.status]?.label || 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Recent Sessions ═══ */}
      {recentSessions.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" />
          <div className="relative border border-white/[0.06] rounded-3xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-base">🕐</span>
              <h3 className="text-sm font-medium text-white/70">Sessões Recentes</h3>
            </div>
            <div className="space-y-3">
              {recentSessions.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                  <div>
                    <div className="text-white/55 text-[12px] font-medium">{s.serviceName}</div>
                    <div className="text-white/15 text-[10px] mt-0.5">{fmtShortDate(s.date)} · {s.duration}min</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400/60">{I.check}</div>
                    <span className="text-white/25 text-[11px] font-light">{fmtCur(s.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Total Invested ═══ */}
      {stats && stats.totalInvested > 0 && (
        <div className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/8 to-[#b76e79]/5" />
          <div className="relative border border-amber-500/8 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-amber-400/30 text-[8px] font-semibold uppercase tracking-[0.2em]">💎 Investimento Total</div>
              <div className="text-white/70 text-lg font-bold mt-1 tracking-tight">{fmtCur(stats.totalInvested)}</div>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400/40">
              {I.star}
              <span className="text-[9px] font-semibold tracking-wider">VIP</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Pending Reviews — Estilo iFood ═══ */}
      {pendingReviews.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/5" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-amber-400/8 to-transparent rounded-full -translate-y-10 translate-x-10" />
          <div className="relative border border-amber-500/15 rounded-3xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white/80">Avalie suas sessões</h3>
                <p className="text-[10px] text-amber-400/50">Ganhe 30 pontos por avaliação!</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {pendingReviews.map(session => (
                <button
                  key={session.id}
                  onClick={() => setFeedbackSession(session)}
                  className="w-full flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-amber-500/20 rounded-2xl px-4 py-3.5 transition-all group/review"
                >
                  <div className="flex-1 text-left">
                    <div className="text-white/70 text-[12px] font-medium group-hover/review:text-white/90 transition-colors">{session.serviceName}</div>
                    <div className="text-white/20 text-[10px] mt-0.5">
                      {new Date(session.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-3.5 h-3.5 text-white/10 group-hover/review:text-amber-400/40 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <svg className="w-4 h-4 text-white/10 group-hover/review:text-amber-400/50 group-hover/review:translate-x-0.5 transition-all" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Quick Links ═══ */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/cliente/agendamentos" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" />
          <div className="relative border border-white/[0.05] group-hover:border-white/[0.1] rounded-2xl p-4 transition-all flex items-center gap-3">
            <span className="text-lg">📋</span>
            <div className="text-white/30 text-[11px] font-medium group-hover:text-white/50 transition-colors">Minha Agenda</div>
          </div>
        </Link>
        <Link href="/" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#b76e79]/10 to-[#d4a0a7]/5" />
          <div className="relative border border-[#b76e79]/15 group-hover:border-[#b76e79]/30 rounded-2xl p-4 transition-all flex items-center gap-3">
            <span className="text-lg">🏠</span>
            <div className="text-[#d4a0a7]/50 text-[11px] font-medium group-hover:text-[#d4a0a7]/80 transition-colors">Ir para Home</div>
          </div>
        </Link>
      </div>

      {/* ═══ Feedback Modal ═══ */}
      {feedbackSession && (
        <FeedbackModal
          session={feedbackSession}
          onClose={() => setFeedbackSession(null)}
          onSubmit={handleSubmitFeedback}
        />
      )}
    </div>
  )
}
