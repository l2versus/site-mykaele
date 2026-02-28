'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClient } from '../ClientContext'
import Link from 'next/link'

/* ═══ Types ═══ */
interface Evolution { key: string; label: string; unit: string; initial: number | null; latest: number | null; delta: number | null; deltaPercent: number | null }
interface GoalItem { target: number; current: number | null; initial: number | null }
interface Goals { weight: GoalItem | null; waist: GoalItem | null; hip: GoalItem | null; bodyFat: GoalItem | null }
interface TimelinePoint { date: string; weight?: number; bodyFat?: number; muscleMass?: number; waist?: number; abdomen?: number; hip?: number; bust?: number; armLeft?: number; armRight?: number; thighLeft?: number; thighRight?: number }
interface Summary { totalMeasurements: number; daysSinceFirst: number; totalLostCm: number; weightChange: number; fatChange: number; bestReduction: { key: string; label: string; delta: number; unit: string } | null }
interface MeasurementData { id: string; date: string; weight?: number; height?: number; bodyFat?: number; muscleMass?: number; bmi?: number; bust?: number; waist?: number; abdomen?: number; hip?: number; armLeft?: number; armRight?: number; thighLeft?: number; thighRight?: number; calfLeft?: number; calfRight?: number; notes?: string; measuredBy?: string }

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtNum = (n: number) => n.toFixed(1)

/* ═══ Progress Ring ═══ */
function ProgressRing({ pct, size = 88, stroke = 5, color = '#b76e79', label, value, unit }: {
  pct: number; size?: number; stroke?: number; color?: string; label: string; value: string | number; unit: string
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const [prog, setProg] = useState(0)
  useEffect(() => { const t = setTimeout(() => setProg(Math.min(pct, 100)), 150); return () => clearTimeout(t) }, [pct])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={c} strokeDashoffset={c * (1 - prog / 100)}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-[1.8s] ease-[cubic-bezier(.4,0,.2,1)]"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white font-semibold text-[15px] leading-none">{value}</span>
          <span className="text-white/25 text-[9px] mt-0.5">{unit}</span>
        </div>
      </div>
      <span className="text-white/35 text-[10px] font-medium tracking-wide">{label}</span>
    </div>
  )
}

/* ═══ Metric Card ═══ */
function MetricCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
      <div className="relative border border-white/[0.06] rounded-2xl overflow-hidden">
      {children}
      </div>
    </div>
  )
}

/* ═══ Sparkline Chart ═══ */
function SparkChart({ data, color = '#b76e79', height = 48 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div className="h-12 flex items-center justify-center text-white/10 text-[10px]">Dados insuficientes</div>
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const w = 200
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: height - ((v - min) / range) * (height - 8) - 4 }))
  const line = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = `0,${height} ${line} ${w},${height}`
  const lastPt = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`fill-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#fill-${color.slice(1)})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r="3" fill={color} stroke="#0a0a0a" strokeWidth="1.5" />
    </svg>
  )
}

/* ═══ Female Body SVG ═══ */
function BodySilhouette({ zones, evolution, compact = false }: {
  zones: { key: string; label: string; cx: number; cy: number; align: 'left' | 'right' }[]
  evolution: Evolution[]
  compact?: boolean
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const getEvo = (key: string) => evolution.find(e => e.key === key)

  return (
    <div className={`relative mx-auto ${compact ? 'max-w-[200px]' : 'max-w-[260px]'}`}>
      <svg viewBox="0 0 200 380" className="w-full" fill="none">
        <defs>
          <linearGradient id="bg" x1="100" y1="0" x2="100" y2="380" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#d4a0a7" stopOpacity="0.30" />
            <stop offset="50%" stopColor="#b76e79" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#d4a0a7" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="st" x1="100" y1="0" x2="100" y2="380" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#d4a0a7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#b76e79" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {/* Head */}
        <ellipse cx="100" cy="30" rx="16" ry="20" fill="url(#bg)" stroke="url(#st)" strokeWidth="0.8" />
        <path d="M88 24 Q88 12 100 10 Q112 12 112 24" fill="none" stroke="#d4a0a7" strokeWidth="0.5" opacity="0.25" />
        {/* Neck */}
        <path d="M94 48 L94 56 Q94 60 98 62 L102 62 Q106 60 106 56 L106 48" fill="url(#bg)" stroke="url(#st)" strokeWidth="0.6" />
        {/* Torso */}
        <path d="M98 62 L72 69 Q60 73 57 78 L57 84 Q59 90 62 92 L64 94
                 Q60 106 58 118 L56 128 Q54 138 58 146 L62 152
                 Q66 158 72 162 L80 166 Q86 168 94 170 L100 172
                 L106 170 Q114 168 120 166 L128 162 Q134 158 138 152
                 L142 146 Q146 138 144 128 L142 118 Q140 106 136 94
                 L138 92 Q141 90 143 84 L143 78 Q140 73 128 69 L102 62"
          fill="url(#bg)" stroke="url(#st)" strokeWidth="0.8" />
        {/* Guide lines */}
        <path d="M70 82 Q85 79 100 78 Q115 79 130 82" fill="none" stroke="#b76e79" strokeWidth="0.4" opacity="0.3" strokeDasharray="2,3" />
        <path d="M64 118 Q82 115 100 114 Q118 115 136 118" fill="none" stroke="#b76e79" strokeWidth="0.4" opacity="0.3" strokeDasharray="2,3" />
        <path d="M64 148 Q82 145 100 144 Q118 145 136 148" fill="none" stroke="#b76e79" strokeWidth="0.4" opacity="0.3" strokeDasharray="2,3" />
        {/* Left Arm */}
        <path d="M57 78 L46 96 Q40 110 38 126 Q36 136 38 148 Q38 152 42 156 Q44 158 46 154 Q46 146 46 138 L50 118 L58 94"
          fill="url(#bg)" stroke="url(#st)" strokeWidth="0.6" />
        {/* Right Arm */}
        <path d="M143 78 L154 96 Q160 110 162 126 Q164 136 162 148 Q162 152 158 156 Q156 158 154 154 Q154 146 154 138 L150 118 L142 94"
          fill="url(#bg)" stroke="url(#st)" strokeWidth="0.6" />
        {/* Left Leg */}
        <path d="M80 166 L76 186 Q72 206 70 226 L68 256 Q66 276 68 296 L70 316 Q70 332 66 340 Q64 346 68 348 L78 348 Q80 346 78 340 Q80 326 80 316 L82 296 Q84 276 84 256 L86 226 Q88 206 88 192 L92 170"
          fill="url(#bg)" stroke="url(#st)" strokeWidth="0.6" />
        {/* Right Leg */}
        <path d="M120 166 L124 186 Q128 206 130 226 L132 256 Q134 276 132 296 L130 316 Q130 332 134 340 Q136 346 132 348 L122 348 Q120 346 122 340 Q120 326 120 316 L118 296 Q116 276 116 256 L114 226 Q112 206 112 192 L108 170"
          fill="url(#bg)" stroke="url(#st)" strokeWidth="0.6" />

        {/* Measurement points */}
        {zones.map(z => {
          const evo = getEvo(z.key)
          if (!evo || evo.latest === null) return null
          const active = hovered === z.key
          return (
            <g key={z.key} onMouseEnter={() => setHovered(z.key)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
              <circle cx={z.cx} cy={z.cy} r={active ? 5 : 3.5} fill="#b76e79" opacity={active ? 0.9 : 0.5}
                className="transition-all duration-200" />
              <circle cx={z.cx} cy={z.cy} r="7" fill="none" stroke="#b76e79" strokeWidth="0.4" opacity={active ? 0.4 : 0.15}>
                <animate attributeName="r" values="5;9;5" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.2;0;0.2" dur="3s" repeatCount="indefinite" />
              </circle>
            </g>
          )
        })}
      </svg>

      {/* Labels */}
      {!compact && zones.map(z => {
        const evo = getEvo(z.key)
        if (!evo || evo.latest === null) return null
        const active = hovered === z.key
        const left = z.align === 'left'
        return (
          <div key={z.key}
            className={`absolute pointer-events-none transition-all duration-200 ${active ? 'opacity-100 scale-105' : 'opacity-70'}`}
            style={{
              top: `${(z.cy / 380) * 100}%`,
              ...(left ? { right: '62%' } : { left: '62%' }),
              transform: 'translateY(-50%)',
            }}>
            <div className={`flex items-center gap-1 ${left ? 'flex-row-reverse' : ''}`}>
              <div className={`h-px w-3 ${left ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-[#b76e79]/40 to-transparent`} />
              <div className="bg-black/50 backdrop-blur-sm border border-white/[0.08] rounded-md px-1.5 py-0.5">
                <div className="text-white/30 text-[7px] font-medium uppercase tracking-wider">{z.label}</div>
                <div className="flex items-center gap-1">
                  <span className="text-white text-[11px] font-semibold">{evo.latest}</span>
                  <span className="text-white/20 text-[8px]">{evo.unit}</span>
                  {evo.delta != null && evo.delta !== 0 && (
                    <span className={`text-[7px] font-bold ${evo.delta < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {evo.delta > 0 ? '+' : ''}{evo.delta}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══ Care Guidelines ═══ */
const CARE = [
  { t: 'Imediato', title: 'Hidratação Intensiva', desc: 'Beba 2L de água nas próximas 4 horas', icon: '💧', color: '#3b82f6' },
  { t: '24h', title: 'Evitar Sol Direto', desc: 'Proteja as áreas tratadas', icon: '☀️', color: '#f59e0b' },
  { t: '24h', title: 'Alimentação Leve', desc: 'Prefira alimentos anti-inflamatórios', icon: '🥗', color: '#10b981' },
  { t: '48h', title: 'Drenagem Linfática', desc: 'Automassagem leve na região', icon: '🤲', color: '#8b5cf6' },
  { t: '7 dias', title: 'Exercício Moderado', desc: 'Caminhada leve potencializa resultados', icon: '🏃‍♀️', color: '#ec4899' },
  { t: 'Contínuo', title: 'Creme Modelador', desc: '2x ao dia com massagem circular', icon: '✨', color: '#d4a0a7' },
]

/* ═══ Body Zone config ═══ */
const BODY_ZONES = [
  { key: 'bust', label: 'Busto', cx: 86, cy: 82, align: 'left' as const },
  { key: 'waist', label: 'Cintura', cx: 68, cy: 118, align: 'left' as const },
  { key: 'abdomen', label: 'Abdômen', cx: 130, cy: 130, align: 'right' as const },
  { key: 'hip', label: 'Quadril', cx: 68, cy: 150, align: 'left' as const },
  { key: 'armRight', label: 'Braço', cx: 154, cy: 100, align: 'right' as const },
  { key: 'thighRight', label: 'Coxa', cx: 128, cy: 210, align: 'right' as const },
  { key: 'calfRight', label: 'Panturrilha', cx: 130, cy: 290, align: 'right' as const },
]

/* ═══ Chart Options ═══ */
const CHART_OPTS: { key: string; label: string; color: string }[] = [
  { key: 'waist', label: 'Cintura', color: '#b76e79' },
  { key: 'abdomen', label: 'Abdômen', color: '#d4a0a7' },
  { key: 'hip', label: 'Quadril', color: '#8b5cf6' },
  { key: 'weight', label: 'Peso', color: '#f59e0b' },
  { key: 'bodyFat', label: 'Gordura', color: '#ef4444' },
  { key: 'bust', label: 'Busto', color: '#ec4899' },
  { key: 'thighRight', label: 'Coxa', color: '#10b981' },
]

/* ═══════════════════════════════════════════ */
/* ═══          MAIN PAGE                ═══ */
/* ═══════════════════════════════════════════ */
export default function EvolucaoPage() {
  const { fetchWithAuth } = useClient()
  const [loading, setLoading] = useState(true)
  const [measurements, setMeasurements] = useState<MeasurementData[]>([])
  const [evolution, setEvolution] = useState<Evolution[]>([])
  const [goals, setGoals] = useState<Goals | null>(null)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [latest, setLatest] = useState<MeasurementData | null>(null)
  const [tab, setTab] = useState<'overview' | 'body' | 'charts' | 'care'>('overview')
  const [chartMetric, setChartMetric] = useState('waist')
  const [npsScore, setNpsScore] = useState<number | null>(null)
  const [npsSubmitted, setNpsSubmitted] = useState(false)

  const submitNps = useCallback(async (score: number) => {
    setNpsScore(score)
    setNpsSubmitted(true)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/api/patient/measurements')
        if (res.ok) {
          const d = await res.json()
          setMeasurements(d.measurements || [])
          setEvolution(d.evolution || [])
          setGoals(d.goals)
          setTimeline(d.timeline || [])
          setSummary(d.summary)
          setLatest(d.latest)
        }
      } catch { /* */ }
      setLoading(false)
    })()
  }, [fetchWithAuth])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getTimelineValues = (key: string): number[] => timeline.map(t => (t as any)[key] as number).filter(v => v != null)

  /* ─── Loading ─── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-[#b76e79]/15" />
        <div className="absolute inset-0 rounded-full border-2 border-[#b76e79] border-t-transparent animate-spin" />
      </div>
      <span className="text-white/15 text-[10px] font-medium tracking-wider animate-pulse">CARREGANDO EVOLUÇÃO</span>
    </div>
  )

  const hasData = measurements.length > 0

  /* ═══════════════════════════════════ */
  /* ═══ EMPTY STATE                ═══ */
  /* ═══════════════════════════════════ */
  if (!hasData) {
    return (
      <div className="space-y-5 animate-[fadeIn_0.6s_ease-out]">
        {/* Header */}
        <div>
          <h1 className="text-xl font-light text-white/90 tracking-tight">Evolução Corporal</h1>
          <p className="text-[#c28a93]/40 text-[10px] mt-0.5 tracking-wide">Acompanhe sua transformação</p>
        </div>

        {/* Body Illustration + Message */}
        <MetricCard>
          <div className="p-6 pb-8">
            <div className="relative max-w-[180px] mx-auto mb-6">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-36 rounded-full bg-[#b76e79]/[0.06] blur-[40px]" />
              <svg viewBox="0 0 200 380" className="w-full relative z-10" fill="none">
                <defs>
                  <linearGradient id="emG" x1="100" y1="0" x2="100" y2="380" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#d4a0a7" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#b76e79" stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                <ellipse cx="100" cy="30" rx="16" ry="20" fill="url(#emG)" stroke="#d4a0a7" strokeWidth="0.4" opacity="0.25" />
                <path d="M94 48 L94 56 Q94 60 98 62 L102 62 Q106 60 106 56 L106 48" fill="url(#emG)" stroke="#d4a0a7" strokeWidth="0.3" opacity="0.25" />
                <path d="M98 62 L72 69 Q60 73 57 78 L57 84 Q59 90 62 92 L64 94 Q60 106 58 118 L56 128 Q54 138 58 146 L62 152 Q66 158 72 162 L80 166 Q86 168 94 170 L100 172 L106 170 Q114 168 120 166 L128 162 Q134 158 138 152 L142 146 Q146 138 144 128 L142 118 Q140 106 136 94 L138 92 Q141 90 143 84 L143 78 Q140 73 128 69 L102 62" fill="url(#emG)" stroke="#d4a0a7" strokeWidth="0.4" opacity="0.25" />
                <path d="M57 78 L46 96 Q40 110 38 126 Q36 136 38 148 Q38 152 42 156 Q44 158 46 154 Q46 146 46 138 L50 118 L58 94" fill="url(#emG)" stroke="#d4a0a7" strokeWidth="0.3" opacity="0.25" />
                <path d="M143 78 L154 96 Q160 110 162 126 Q164 136 162 148 Q162 152 158 156 Q156 158 154 154 Q154 146 154 138 L150 118 L142 94" fill="url(#emG)" stroke="#d4a0a7" strokeWidth="0.3" opacity="0.25" />
                <path d="M80 166 L76 186 Q72 206 70 226 L68 256 Q66 276 68 296 L70 316 Q70 332 66 340 Q64 346 68 348 L78 348 Q80 346 78 340 Q80 326 80 316 L82 296 Q84 276 84 256 L86 226 Q88 206 88 192 L92 170" fill="url(#emG)" stroke="#d4a0a7" strokeWidth="0.3" opacity="0.25" />
                <path d="M120 166 L124 186 Q128 206 130 226 L132 256 Q134 276 132 296 L130 316 Q130 332 134 340 Q136 346 132 348 L122 348 Q120 346 122 340 Q120 326 120 316 L118 296 Q116 276 116 256 L114 226 Q112 206 112 192 L108 170" fill="url(#emG)" stroke="#d4a0a7" strokeWidth="0.3" opacity="0.25" />
                {/* Scan line */}
                <line x1="45" y1="100" x2="155" y2="100" stroke="#b76e79" strokeWidth="0.3" opacity="0.12">
                  <animate attributeName="y1" values="30;340;30" dur="5s" repeatCount="indefinite" />
                  <animate attributeName="y2" values="30;340;30" dur="5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;0.15;0" dur="5s" repeatCount="indefinite" />
                </line>
              </svg>
            </div>

            <div className="text-center">
              <h2 className="text-white/70 font-medium text-sm">Suas medidas serão registradas aqui</h2>
              <p className="text-white/20 text-[11px] mt-2 max-w-[280px] mx-auto leading-relaxed">
                Na sua próxima sessão, a profissional registrará suas medidas corporais. Aqui você acompanhará toda a evolução.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-6">
              {[
                { icon: '📐', label: 'Medidas', desc: 'Circunferências' },
                { icon: '📈', label: 'Evolução', desc: 'Gráficos' },
                { icon: '🎯', label: 'Metas', desc: 'Objetivos' },
              ].map((f, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 text-center">
                  <span className="text-lg block">{f.icon}</span>
                  <div className="text-white/35 text-[10px] font-medium mt-1">{f.label}</div>
                  <div className="text-white/12 text-[8px]">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </MetricCard>

        {/* Care */}
        <MetricCard>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-[#b76e79]/10 flex items-center justify-center">
                <svg width="12" height="12" fill="none" stroke="#d4a0a7" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <h3 className="text-xs font-semibold text-white/70">Cuidados Pós-Sessão</h3>
            </div>
            <div className="space-y-2">
              {CARE.map((g, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${g.color}10` }}>{g.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 text-[11px] font-medium">{g.title}</span>
                      <span className="text-[7px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${g.color}12`, color: g.color }}>{g.t}</span>
                    </div>
                    <p className="text-white/18 text-[10px] mt-0.5">{g.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MetricCard>
      </div>
    )
  }

  /* ═══════════════════════════════════ */
  /* ═══ WITH DATA — DASHBOARD      ═══ */
  /* ═══════════════════════════════════ */
  return (
    <div className="space-y-4 animate-[fadeIn_0.4s_ease-out]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light text-white/90 tracking-tight">Evolução Corporal</h1>
          <p className="text-[#c28a93]/40 text-[10px] mt-0.5 tracking-wide">{summary?.totalMeasurements} avaliações · {summary?.daysSinceFirst} dias de jornada</p>
        </div>
        <Link href="/cliente" className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/20 hover:text-[#d4a0a7] transition-colors">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
      </div>

      {/* Summary Banner */}
      {summary && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#b76e79]/15 via-[#141014] to-[#0a0a0a] border border-[#b76e79]/15 p-5">
          <div className="absolute top-0 right-0 w-28 h-28 bg-[#b76e79]/10 rounded-full blur-[40px]" />
          <div className="relative z-10">
            <div className="text-[#d4a0a7]/50 text-[8px] font-semibold tracking-[0.2em] uppercase mb-3">Resumo da Evolução</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: `${summary.totalLostCm > 0 ? '-' : ''}${summary.totalLostCm}`, u: 'cm total', c: summary.totalLostCm > 0 ? 'text-emerald-400' : 'text-white/25' },
                { v: `${summary.weightChange > 0 ? '+' : ''}${summary.weightChange}`, u: 'kg peso', c: summary.weightChange < 0 ? 'text-emerald-400' : summary.weightChange > 0 ? 'text-amber-400' : 'text-white/25' },
                { v: `${summary.fatChange > 0 ? '+' : ''}${summary.fatChange}`, u: '% gordura', c: summary.fatChange < 0 ? 'text-emerald-400' : 'text-white/25' },
                { v: String(summary.totalMeasurements), u: 'avaliações', c: 'text-[#d4a0a7]' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className={`text-lg font-bold ${s.c}`}>{s.v}</div>
                  <div className="text-white/15 text-[8px] mt-0.5">{s.u}</div>
                </div>
              ))}
            </div>
            {summary.bestReduction && (
              <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-2">
                <svg width="10" height="10" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                <span className="text-white/25 text-[10px]">Melhor resultado: <span className="text-emerald-400 font-semibold">{summary.bestReduction.label} {summary.bestReduction.delta}{summary.bestReduction.unit}</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1 gap-0.5">
        {([
          { key: 'overview', label: 'Geral', icon: '📊' },
          { key: 'body', label: 'Corpo', icon: '🧍‍♀️' },
          { key: 'charts', label: 'Gráficos', icon: '📈' },
          { key: 'care', label: 'Cuidados', icon: '💆‍♀️' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-medium transition-all duration-300 flex items-center justify-center gap-1 ${
              tab === t.key
                ? 'bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/15'
                : 'text-white/20 hover:text-white/35'
            }`}>
            <span className="text-xs">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: OVERVIEW ─── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Rings */}
          {latest && (
            <MetricCard>
              <div className="p-5">
                <div className="text-white/12 text-[8px] font-semibold tracking-[0.2em] uppercase mb-4">Métricas Atuais</div>
                <div className="flex justify-around">
                  {latest.weight != null && <ProgressRing pct={Math.min((latest.weight / 120) * 100, 100)} color="#b76e79" label="Peso" value={latest.weight} unit="kg" />}
                  {latest.bmi != null && <ProgressRing pct={Math.min((latest.bmi / 40) * 100, 100)} color={latest.bmi < 25 ? '#10b981' : latest.bmi < 30 ? '#f59e0b' : '#ef4444'} label="IMC" value={latest.bmi} unit="kg/m²" />}
                  {latest.bodyFat != null && <ProgressRing pct={Math.min(latest.bodyFat * 2, 100)} color="#d4a0a7" label="Gordura" value={latest.bodyFat} unit="%" />}
                  {latest.muscleMass != null && <ProgressRing pct={Math.min(latest.muscleMass * 2, 100)} color="#60a5fa" label="Músculo" value={latest.muscleMass} unit="%" />}
                </div>
              </div>
            </MetricCard>
          )}

          {/* BMI Classification */}
          {latest?.bmi && (
            <MetricCard>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold ${
                    latest.bmi < 18.5 ? 'bg-blue-500/10 text-blue-400' : latest.bmi < 25 ? 'bg-emerald-500/10 text-emerald-400' : latest.bmi < 30 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                  }`}>{latest.bmi}</div>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${latest.bmi < 18.5 ? 'text-blue-400' : latest.bmi < 25 ? 'text-emerald-400' : latest.bmi < 30 ? 'text-amber-400' : 'text-red-400'}`}>
                      {latest.bmi < 18.5 ? 'Abaixo do peso' : latest.bmi < 25 ? 'Peso normal' : latest.bmi < 30 ? 'Sobrepeso' : 'Obesidade'}
                    </div>
                    <div className="flex gap-0.5 mt-1.5">
                      {[{ min: 0, max: 18.5, c: '#3b82f6', l: '<18.5' }, { min: 18.5, max: 25, c: '#10b981', l: '18.5-25' }, { min: 25, max: 30, c: '#f59e0b', l: '25-30' }, { min: 30, max: 50, c: '#ef4444', l: '>30' }].map(b => (
                        <div key={b.l} className="flex-1">
                          <div className="h-1.5 rounded-full" style={{ background: (latest.bmi! >= b.min && latest.bmi! < b.max) ? b.c : `${b.c}20` }} />
                          <span className="text-white/12 text-[7px] block text-center mt-0.5">{b.l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </MetricCard>
          )}

          {/* Comparativo */}
          <MetricCard>
            <div className="p-5">
              <h3 className="text-xs font-semibold text-white/70 mb-3">Comparativo de Medidas</h3>
              <div className="flex text-[7px] text-white/15 uppercase tracking-wider font-semibold pb-2 border-b border-white/[0.04]">
                <span className="flex-1">Medida</span><span className="w-14 text-right">Inicial</span><span className="w-14 text-right">Atual</span><span className="w-14 text-right">Δ</span>
              </div>
              {evolution.map(e => (
                <div key={e.key} className="flex items-center py-2.5 border-b border-white/[0.03] last:border-0">
                  <span className="flex-1 text-white/40 text-[11px] font-medium">{e.label}</span>
                  <span className="w-14 text-right text-white/15 text-[11px] font-mono">{e.initial ?? '—'}</span>
                  <span className="w-14 text-right text-white text-[11px] font-mono font-semibold">{e.latest ?? '—'}</span>
                  <span className={`w-14 text-right text-[11px] font-semibold font-mono ${e.delta != null && e.delta < 0 ? 'text-emerald-400' : e.delta != null && e.delta > 0 ? 'text-amber-400' : 'text-white/10'}`}>
                    {e.delta != null && e.delta !== 0 ? `${e.delta > 0 ? '+' : ''}${e.delta}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </MetricCard>

          {/* Goals */}
          {goals && (
            <MetricCard>
              <div className="p-5">
                <h3 className="text-xs font-semibold text-white/70 mb-3">Metas</h3>
                <div className="space-y-3">
                  {([
                    { key: 'weight', label: 'Peso', unit: 'kg', goal: goals.weight, color: '#b76e79' },
                    { key: 'waist', label: 'Cintura', unit: 'cm', goal: goals.waist, color: '#d4a0a7' },
                    { key: 'hip', label: 'Quadril', unit: 'cm', goal: goals.hip, color: '#8b5cf6' },
                    { key: 'bodyFat', label: 'Gordura', unit: '%', goal: goals.bodyFat, color: '#f59e0b' },
                  ] as const).map(g => {
                    if (!g.goal || g.goal.current == null || g.goal.initial == null) return null
                    const totalNeeded = Math.abs(g.goal.initial - g.goal.target)
                    const achieved = Math.abs(g.goal.initial - g.goal.current)
                    const pct = totalNeeded > 0 ? Math.min(Math.round((achieved / totalNeeded) * 100), 100) : 0
                    return (
                      <div key={g.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/40 text-[11px] font-medium">{g.label}</span>
                          <span className="text-white/20 text-[10px] font-mono">{g.goal.current}{g.unit} → <span style={{ color: g.color }} className="font-semibold">{g.goal.target}{g.unit}</span></span>
                        </div>
                        <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-[1.5s] ease-out"
                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${g.color}, ${g.color}bb)` }} />
                        </div>
                        <span className="text-white/12 text-[9px] mt-0.5 block">{pct}% concluído</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </MetricCard>
          )}
        </div>
      )}

      {/* ─── TAB: BODY ─── */}
      {tab === 'body' && (
        <div className="space-y-4">
          <MetricCard>
            <div className="p-5">
              <h3 className="text-xs font-semibold text-white/70 mb-1">Mapa Corporal</h3>
              <p className="text-white/15 text-[10px] mb-3">Passe sobre os pontos para ver os detalhes</p>
              <BodySilhouette zones={BODY_ZONES} evolution={evolution} />
            </div>
          </MetricCard>

          <MetricCard>
            <div className="p-5">
              <h3 className="text-xs font-semibold text-white/70 mb-3">Histórico de Avaliações</h3>
              <div className="space-y-2">
                {measurements.slice().reverse().map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#b76e79]/15 to-[#d4a0a7]/8 flex items-center justify-center text-[#d4a0a7] text-[11px] font-bold">
                      {measurements.length - i}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white/50 text-[11px] font-medium">{fmtDate(m.date)}</div>
                      <div className="text-white/15 text-[9px] flex items-center gap-2 mt-0.5 flex-wrap">
                        {m.weight && <span>{m.weight}kg</span>}
                        {m.waist && <span>C: {m.waist}cm</span>}
                        {m.hip && <span>Q: {m.hip}cm</span>}
                      </div>
                    </div>
                    {m.measuredBy && <span className="text-white/10 text-[8px] shrink-0">{m.measuredBy}</span>}
                  </div>
                ))}
              </div>
            </div>
          </MetricCard>
        </div>
      )}

      {/* ─── TAB: CHARTS ─── */}
      {tab === 'charts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {CHART_OPTS.map(opt => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const hasD = timeline.some(t => (t as any)[opt.key] != null)
              if (!hasD) return null
              return (
                <button key={opt.key} onClick={() => setChartMetric(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                    chartMetric === opt.key
                      ? 'text-white border-transparent'
                      : 'border-white/[0.06] text-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                  style={chartMetric === opt.key ? { background: `${opt.color}25`, borderColor: `${opt.color}35` } : {}}>
                  {opt.label}
                </button>
              )
            })}
          </div>

          <MetricCard>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-white/70">{CHART_OPTS.find(o => o.key === chartMetric)?.label || 'Evolução'}</h3>
                {(() => {
                  const vals = getTimelineValues(chartMetric)
                  if (vals.length < 2) return null
                  const delta = vals[vals.length - 1] - vals[0]
                  return (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${delta < 0 ? 'bg-emerald-500/10 text-emerald-400' : delta > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/[0.04] text-white/20'}`}>
                      {delta > 0 ? '+' : ''}{fmtNum(delta)}
                    </span>
                  )
                })()}
              </div>
              <div className="h-12">
                <SparkChart data={getTimelineValues(chartMetric)} color={CHART_OPTS.find(o => o.key === chartMetric)?.color || '#b76e79'} />
              </div>
              <div className="flex justify-between mt-2 text-white/12 text-[8px]">
                {timeline.length > 0 && <span>{fmtDate(timeline[0].date)}</span>}
                {timeline.length > 1 && <span>{fmtDate(timeline[timeline.length - 1].date)}</span>}
              </div>
            </div>
          </MetricCard>

          {/* Zone bars */}
          <MetricCard>
            <div className="p-5">
              <h3 className="text-xs font-semibold text-white/70 mb-3">Variação por Zona</h3>
              <div className="space-y-2.5">
                {evolution.filter(e => e.unit === 'cm' && e.delta != null).map(e => {
                  const maxDelta = Math.max(...evolution.filter(x => x.unit === 'cm' && x.delta != null).map(x => Math.abs(x.delta!)), 1)
                  const w = (Math.abs(e.delta!) / maxDelta) * 100
                  const neg = e.delta! < 0
                  return (
                    <div key={e.key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-white/30 text-[10px]">{e.label}</span>
                        <span className={`text-[10px] font-semibold ${neg ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {e.delta! > 0 ? '+' : ''}{e.delta}cm
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${neg ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${w}%`, opacity: 0.7 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </MetricCard>
        </div>
      )}

      {/* ─── TAB: CARE ─── */}
      {tab === 'care' && (
        <div className="space-y-4">
          <MetricCard>
            <div className="p-5">
              <h3 className="text-xs font-semibold text-white/70 mb-4">Cuidados Pós-Sessão</h3>
              <div className="space-y-2">
                {CARE.map((g, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${g.color}10` }}>{g.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white/50 text-[11px] font-medium">{g.title}</span>
                        <span className="text-[7px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${g.color}12`, color: g.color }}>{g.t}</span>
                      </div>
                      <p className="text-white/18 text-[10px] mt-0.5">{g.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </MetricCard>

          {/* Tips */}
          <div className="rounded-2xl border border-[#b76e79]/15 p-5" style={{ background: 'linear-gradient(135deg, rgba(183,110,121,0.08), rgba(10,10,10,0.95))' }}>
            <h3 className="text-xs font-semibold text-white/70 mb-3">Dicas de Potencialização</h3>
            <div className="space-y-3">
              {[
                { icon: '🧊', title: 'Crioterapia em casa', desc: 'Gelo em tecido na região tratada por 10 minutos' },
                { icon: '🫁', title: 'Respiração abdominal', desc: '5 min/dia reduz cortisol e gordura localizada' },
                { icon: '💊', title: 'Colágeno + Vitamina C', desc: 'Em jejum melhora elasticidade da pele' },
                { icon: '🌙', title: 'Protocolo noturno', desc: 'Sérum redutor antes de dormir — melhor absorção' },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-sm">{tip.icon}</span>
                  <div>
                    <span className="text-white/40 text-[11px] font-medium">{tip.title}</span>
                    <p className="text-white/15 text-[10px] mt-0.5">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* NPS */}
          <MetricCard>
            <div className="p-5 text-center">
              <h3 className="text-xs font-semibold text-white/70 mb-1">Como foi sua última sessão?</h3>
              <p className="text-white/15 text-[10px] mb-4">Sua opinião nos ajuda a melhorar</p>
              {npsSubmitted ? (
                <div className="py-3">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <p className="text-emerald-400 text-xs font-medium">Obrigada!</p>
                  <p className="text-white/15 text-[10px] mt-1">Nota: {npsScore}/10</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <button key={n} onClick={() => submitNps(n)}
                        className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all border bg-white/[0.03] border-white/[0.06] text-white/20 hover:scale-110 active:scale-95
                          ${n <= 3 ? 'hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400' : n <= 6 ? 'hover:bg-amber-500/10 hover:border-amber-500/25 hover:text-amber-400' : 'hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-400'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5 px-1">
                    <span className="text-red-400/25 text-[8px]">Ruim</span>
                    <span className="text-emerald-400/25 text-[8px]">Excelente</span>
                  </div>
                </>
              )}
            </div>
          </MetricCard>
        </div>
      )}

      {/* Footer info */}
      {latest && (
        <p className="text-center text-white/8 text-[9px] pb-1">
          Última avaliação: {fmtDate(latest.date)} {latest.measuredBy && `· ${latest.measuredBy}`}
        </p>
      )}
    </div>
  )
}
