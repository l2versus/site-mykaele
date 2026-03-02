'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAdmin } from '../AdminContext'
import Link from 'next/link'

/* ═══════════════════════════════════════════════════════════════
   GESTÃO FINANCEIRA & PRÓ-LABORE
   Plano de Negócios — Mykaele Procópio Home Spa
   ═══════════════════════════════════════════════════════════════ */

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/* ─── Plano Financeiro Configurável ─── */
interface PlanoConfig {
  proLabore: number
  impostoAliquota: number
  reservaPct: number
  reservaMeta: number
  capitalizacaoPct: number
}

const DEFAULT_PLANO: PlanoConfig = {
  proLabore: 5600,
  impostoAliquota: 0.06,
  reservaPct: 0.10,
  reservaMeta: 30000,
  capitalizacaoPct: 0.15,
}

const STORAGE_KEY = 'myka_plano_fin'

function loadPlano(): PlanoConfig {
  if (typeof window === 'undefined') return DEFAULT_PLANO
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? { ...DEFAULT_PLANO, ...JSON.parse(s) } : DEFAULT_PLANO
  } catch { return DEFAULT_PLANO }
}

/* ─── Cálculo do Fluxo Financeiro ─── */
interface Fluxo {
  receitaBruta: number
  impostos: number
  custos: number
  lucroOperacional: number
  proLabore: number
  sobra: number
  reserva: number
  capitalizacao: number
  lucroDisponivel: number
  margemOp: number
  pontoEquilibrio: number
  coberturaPL: number
  score: number
}

function calcFluxo(receita: number, custos: number, p: PlanoConfig): Fluxo {
  const impostos = receita * p.impostoAliquota
  const lucroOp = receita - impostos - custos
  const sobra = lucroOp - p.proLabore
  const reserva = sobra > 0 ? sobra * p.reservaPct : 0
  const capital = sobra > 0 ? sobra * p.capitalizacaoPct : 0
  const lucro = sobra - reserva - capital
  const pe = p.impostoAliquota < 1 ? (custos + p.proLabore) / (1 - p.impostoAliquota) : 0
  const cob = lucroOp > 0 ? lucroOp / p.proLabore : 0

  // Score 0–100
  let sc = 0
  if (receita > 0) {
    sc += Math.min(40, (cob / 1.5) * 40)
    sc += Math.min(25, ((lucroOp / receita) / 0.5) * 25)
    sc += receita >= pe ? 20 : (receita / pe) * 20
    sc += sobra > 0 ? 15 : 0
  }

  return {
    receitaBruta: receita, impostos, custos, lucroOperacional: lucroOp,
    proLabore: p.proLabore, sobra,
    reserva, capitalizacao: capital, lucroDisponivel: lucro,
    margemOp: receita > 0 ? lucroOp / receita : 0,
    pontoEquilibrio: pe, coberturaPL: cob,
    score: Math.round(Math.min(100, Math.max(0, sc))),
  }
}

/* ─── Labels de categoria ─── */
const CAT_LABELS: Record<string, string> = {
  MATERIAL: 'Materiais', DESLOCAMENTO: 'Deslocamento', ALUGUEL: 'Aluguel/Espaço',
  MARKETING: 'Marketing', EQUIPAMENTO: 'Equipamento', OUTROS: 'Outros',
}
const CAT_COLORS: Record<string, string> = {
  MATERIAL: '#8b5cf6', DESLOCAMENTO: '#f59e0b', ALUGUEL: '#ef4444',
  MARKETING: '#3b82f6', EQUIPAMENTO: '#10b981', OUTROS: '#6b7280',
}

/* ─── SVG Icons ─── */
const Ico = {
  left: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>,
  right: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>,
  gear: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  check: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  warn: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  x: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  save: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  arrow: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
}

/* ═══════════════════════════════════
   SCORE GAUGE (circular SVG)
   ═══════════════════════════════════ */
function ScoreGauge({ score, size = 130 }: { score: number; size?: number }) {
  const r = size * 0.38
  const sw = size * 0.08
  const circ = 2 * Math.PI * r
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : score >= 40 ? '#f97316' : '#ef4444'
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 40 ? 'Atenção' : 'Crítico'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>{score}</span>
        <span className="text-[10px] text-white/40 font-medium">{label}</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════
   WATERFALL BAR
   ═══════════════════════════════════ */
function WBar({ emoji, label, amount, max, color, isTotal, neg }: {
  emoji: string; label: string; amount: number; max: number; color: string; isTotal?: boolean; neg?: boolean
}) {
  const pct = max > 0 ? (Math.abs(amount) / max) * 100 : 0
  return (
    <div className={`flex items-center gap-3 py-2 ${isTotal ? 'border-t border-white/[0.08] pt-3 mt-1' : ''}`}>
      <span className="text-base w-6 text-center flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[11px] ${isTotal ? 'font-bold text-white' : 'text-white/50'}`}>{label}</span>
          <span className={`text-[12px] font-mono font-bold tabular-nums ${neg ? 'text-red-400/80' : ''}`}
            style={!neg ? { color } : undefined}>
            {neg ? '−' : ''}{fmtCur(Math.abs(amount))}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color, opacity: isTotal ? 0.9 : 0.6 }} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════
   CONFIG PANEL
   ═══════════════════════════════════ */
function ConfigPanel({ plano, onSave, onClose }: { plano: PlanoConfig; onSave: (p: PlanoConfig) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(plano)
  const set = (k: keyof PlanoConfig, v: number) => setDraft(d => ({ ...d, [k]: v }))

  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">⚙️ Configurar Plano Financeiro</h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">{Ico.x}</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumField label="Pró-labore (R$)" value={draft.proLabore} onChange={v => set('proLabore', v)} step={100} />
        <NumField label="Imposto sobre receita (%)" value={+(draft.impostoAliquota * 100).toFixed(2)} onChange={v => set('impostoAliquota', v / 100)} step={0.5} suffix="%" />
        <NumField label="Reserva de Emergência (%)" value={+(draft.reservaPct * 100).toFixed(1)} onChange={v => set('reservaPct', v / 100)} step={1} suffix="%" />
        <NumField label="Meta Reserva (R$)" value={draft.reservaMeta} onChange={v => set('reservaMeta', v)} step={1000} />
        <NumField label="Capitalização (%)" value={+(draft.capitalizacaoPct * 100).toFixed(1)} onChange={v => set('capitalizacaoPct', v / 100)} step={1} suffix="%" />
      </div>
      <p className="text-[10px] text-white/25 mt-3">
        💡 Reserva e capitalização são calculadas sobre o <strong className="text-white/40">resultado após pró-labore</strong>. Os percentuais somados ({fmtPct(draft.reservaPct + draft.capitalizacaoPct)}) devem totalizar no máx. 100%.
      </p>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors">Cancelar</button>
        <button onClick={() => { onSave(draft); onClose() }}
          className="px-4 py-1.5 rounded-lg bg-[#b76e79] text-white text-xs font-medium hover:bg-[#a05d68] transition-colors flex items-center gap-1.5">
          {Ico.save} Salvar
        </button>
      </div>
    </div>
  )
}

function NumField({ label, value, onChange, step = 1, suffix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string
}) {
  return (
    <div>
      <label className="text-[10px] text-white/40 font-medium block mb-1">{label}</label>
      <div className="relative">
        <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} step={step}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#b76e79]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">{suffix}</span>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════
   DRE ROW
   ═══════════════════════════════════ */
function DRERow({ label, value, bg, bold, indent, sub }: {
  label: string; value: number; bg?: string; bold?: boolean; indent?: boolean; sub?: string
}) {
  const isNeg = label.startsWith('(')
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${bg || ''} ${indent ? 'pl-8' : ''}`}>
      <div className="min-w-0 flex-1">
        <span className={`text-[11px] ${bold ? 'font-bold text-white' : 'text-white/50'}`}>{label}</span>
        {sub && <span className="text-[9px] text-white/25 ml-1.5">{sub}</span>}
      </div>
      <span className={`text-[12px] font-mono tabular-nums flex-shrink-0 ${bold ? 'font-bold text-white' : isNeg ? 'text-red-400/70' : 'text-white/60'}`}>
        {value < 0 ? `−${fmtCur(Math.abs(value))}` : fmtCur(value)}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════
   INDICATOR ROW
   ═══════════════════════════════════ */
function Indicator({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={ok ? 'text-emerald-400' : 'text-amber-400'}>{ok ? Ico.check : Ico.warn}</span>
      <span className="text-[10px] text-white/50 flex-1">{label}</span>
      <span className={`text-[10px] font-mono ${ok ? 'text-emerald-400/70' : 'text-amber-400/70'}`}>{detail}</span>
    </div>
  )
}

/* ═══════════════════════════════════
   ALERT TIP
   ═══════════════════════════════════ */
function Tip({ type, text }: { type: 'ok' | 'warn' | 'info'; text: string }) {
  const styles = {
    ok: 'bg-emerald-500/[0.06] border-emerald-500/15 text-emerald-400',
    warn: 'bg-amber-500/[0.06] border-amber-500/15 text-amber-400',
    info: 'bg-blue-500/[0.06] border-blue-500/15 text-blue-400',
  }
  const icons = { ok: '✅', warn: '⚠️', info: 'ℹ️' }
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-2 ${styles[type]}`}>
      <span className="text-sm flex-shrink-0">{icons[type]}</span>
      <p className="text-[11px] leading-relaxed opacity-80">{text}</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function ProLaborePage() {
  const { fetchWithAuth } = useAdmin()
  const [plano, setPlano] = useState<PlanoConfig>(DEFAULT_PLANO)
  const [receita, setReceita] = useState(0)
  const [custos, setCustos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [catBreakdown, setCatBreakdown] = useState<{ cat: string; amount: number }[]>([])

  const [month, setMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })

  // Load saved plan from localStorage
  useEffect(() => { setPlano(loadPlano()) }, [])

  // Fetch financial data for the selected month
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [y, m] = month.split('-').map(Number)
      const from = `${y}-${String(m).padStart(2, '0')}-01`
      const last = new Date(y, m, 0).getDate()
      const to = `${y}-${String(m).padStart(2, '0')}-${last}`
      const res = await fetchWithAuth(`/api/admin/finances?from=${from}&to=${to}`)
      if (res?.ok) {
        const d = await res.json()
        setReceita(d.totalRevenue || 0)
        setCustos(d.totalExpenses || 0)
        const byCat: Record<string, number> = {}
        for (const e of (d.expenses || []) as { category: string; amount: number }[]) {
          byCat[e.category] = (byCat[e.category] || 0) + e.amount
        }
        setCatBreakdown(
          Object.entries(byCat)
            .map(([cat, amount]) => ({ cat, amount }))
            .sort((a, b) => b.amount - a.amount)
        )
      }
    } catch (e) { console.error('Erro ao buscar dados financeiros:', e) }
    finally { setLoading(false) }
  }, [month, fetchWithAuth])

  useEffect(() => { fetchData() }, [fetchData])

  const f = useMemo(() => calcFluxo(receita, custos, plano), [receita, custos, plano])

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return `${MONTHS_PT[m - 1]} ${y}`
  }, [month])

  const navMonth = (dir: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + dir)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const savePlano = (p: PlanoConfig) => {
    setPlano(p)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  }

  /* ─── Loading state ─── */
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-[#b76e79]/30 border-t-[#b76e79] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            💼 Gestão Financeira & Pró-labore
          </h1>
          <p className="text-white/30 text-[11px] mt-0.5">Plano de negócios — distribuição de receita mensal</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => navMonth(-1)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-all">{Ico.left}</button>
          <span className="text-white/70 text-sm font-medium min-w-[140px] text-center capitalize">{monthLabel}</span>
          <button onClick={() => navMonth(1)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-all">{Ico.right}</button>
          <button onClick={() => setShowConfig(!showConfig)}
            className={`ml-2 p-2 rounded-lg transition-all ${showConfig ? 'bg-[#b76e79]/20 text-[#b76e79]' : 'hover:bg-white/[0.06] text-white/30 hover:text-white/60'}`}>
            {Ico.gear}
          </button>
        </div>
      </div>

      {/* Config Panel (collapsible) */}
      {showConfig && <ConfigPanel plano={plano} onSave={savePlano} onClose={() => setShowConfig(false)} />}

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          {
            emoji: '💰', label: 'Receita Bruta',
            value: fmtCur(f.receitaBruta),
            sub: f.receitaBruta > 0 ? `PE: ${fmtCur(f.pontoEquilibrio)}` : 'Sem receita',
            color: '#34d399', grad: 'from-emerald-500/10',
          },
          {
            emoji: '👩‍💼', label: 'Pró-labore',
            value: fmtCur(f.proLabore),
            sub: f.coberturaPL >= 1 ? `✅ ${f.coberturaPL.toFixed(1)}x coberto` : '⚠️ Receita insuficiente',
            color: '#b76e79', grad: 'from-[#b76e79]/10',
          },
          {
            emoji: '🛡️', label: 'Reserva + Capital.',
            value: fmtCur(f.reserva + f.capitalizacao),
            sub: `${fmtPct(plano.reservaPct)} + ${fmtPct(plano.capitalizacaoPct)} do resultado`,
            color: '#8b5cf6', grad: 'from-violet-500/10',
          },
          {
            emoji: '📊', label: 'Lucro Distribuível',
            value: fmtCur(Math.max(0, f.lucroDisponivel)),
            sub: f.sobra > 0 ? `Margem ${fmtPct(f.margemOp)}` : f.receitaBruta > 0 ? 'Déficit' : '—',
            color: f.lucroDisponivel >= 0 ? '#06b6d4' : '#ef4444',
            grad: f.lucroDisponivel >= 0 ? 'from-cyan-500/10' : 'from-red-500/10',
          },
        ] as const).map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.grad} to-white/[0.02] rounded-2xl border border-white/[0.06] p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{c.emoji}</span>
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-wide">{c.label}</span>
            </div>
            <div className="text-lg font-bold tracking-tight" style={{ color: c.color }}>{c.value}</div>
            <div className="text-[9px] text-white/30 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ═══ MAIN GRID: FLOW + SCORE ═══ */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* ── Waterfall Flow (3 cols) ── */}
        <div className="lg:col-span-3 bg-white/[0.02] rounded-2xl border border-white/[0.06] p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            📊 Fluxo de Distribuição
            <span className="text-[9px] text-white/20 font-normal ml-1">receita → alocação</span>
          </h2>

          <WBar emoji="💰" label="Receita Bruta" amount={f.receitaBruta} max={f.receitaBruta} color="#34d399" isTotal />
          <WBar emoji="🏛️" label={`Impostos (${fmtPct(plano.impostoAliquota)} MEI)`} amount={f.impostos} max={f.receitaBruta} color="#ef4444" neg />
          <WBar emoji="📦" label="Custos Operacionais" amount={f.custos} max={f.receitaBruta} color="#f97316" neg />
          <WBar emoji="📈" label="= Lucro Operacional" amount={f.lucroOperacional} max={f.receitaBruta} color="#3b82f6" isTotal />

          <div className="my-2 border-t border-dashed border-white/[0.06]" />

          <WBar emoji="👩‍💼" label="Pró-labore Mykaele" amount={f.proLabore} max={f.receitaBruta} color="#b76e79" neg />
          <WBar emoji="🛡️" label={`Reserva Emergência (${fmtPct(plano.reservaPct)})`} amount={f.reserva} max={f.receitaBruta} color="#8b5cf6" neg />
          <WBar emoji="🚀" label={`Capitalização (${fmtPct(plano.capitalizacaoPct)})`} amount={f.capitalizacao} max={f.receitaBruta} color="#06b6d4" neg />

          <div className="mt-1" />
          <WBar emoji="✅" label="= Lucro Distribuível" amount={Math.max(0, f.lucroDisponivel)} max={f.receitaBruta} color="#34d399" isTotal />

          {/* Deficit alert */}
          {f.sobra < 0 && (
            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="text-red-400 mt-0.5">{Ico.warn}</span>
              <div>
                <span className="text-red-400 text-[11px] font-semibold">Déficit de {fmtCur(Math.abs(f.sobra))}</span>
                <p className="text-red-400/60 text-[10px] mt-0.5">
                  A receita não cobre custos + pró-labore. Receita mínima necessária: <strong>{fmtCur(f.pontoEquilibrio)}</strong>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel (2 cols) ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Score Gauge */}
          <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-5">
            <h3 className="text-[11px] text-white/40 font-semibold text-center mb-3">Saúde Financeira</h3>
            <div className="flex justify-center">
              <ScoreGauge score={f.score} />
            </div>
            <div className="mt-4 space-y-2">
              <Indicator ok={f.coberturaPL >= 1} label="Cobre pró-labore" detail={`${f.coberturaPL.toFixed(1)}x`} />
              <Indicator ok={f.margemOp >= 0.4} label="Margem operacional saudável" detail={fmtPct(f.margemOp)} />
              <Indicator ok={f.receitaBruta >= f.pontoEquilibrio} label="Acima do ponto de equilíbrio" detail={fmtCur(f.pontoEquilibrio)} />
              <Indicator ok={f.sobra > 0} label="Gera reservas e capitalização" detail={f.sobra > 0 ? fmtCur(f.reserva + f.capitalizacao) : 'Déficit'} />
            </div>
          </div>

          {/* Expense Breakdown */}
          {catBreakdown.length > 0 && (
            <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-5">
              <h3 className="text-[11px] text-white/40 font-semibold mb-3">Custos por Categoria</h3>
              <div className="space-y-2.5">
                {catBreakdown.map(({ cat, amount }) => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[cat] || '#6b7280' }} />
                      <span className="text-[10px] text-white/50 flex-1">{CAT_LABELS[cat] || cat}</span>
                      <span className="text-[11px] font-mono text-white/60 tabular-nums">{fmtCur(amount)}</span>
                      <span className="text-[9px] text-white/25 w-8 text-right">{custos > 0 ? `${Math.round(amount / custos * 100)}%` : ''}</span>
                    </div>
                    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden ml-4">
                      <div className="h-full rounded-full" style={{ width: `${custos > 0 ? (amount / custos) * 100 : 0}%`, backgroundColor: CAT_COLORS[cat] || '#6b7280', opacity: 0.6 }} />
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/admin/financeiro" className="block text-center text-[#b76e79] text-[10px] mt-3 hover:underline">
                Ver detalhes no Financeiro →
              </Link>
            </div>
          )}

          {/* Key Metrics Summary */}
          <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-5">
            <h3 className="text-[11px] text-white/40 font-semibold mb-3">Resumo</h3>
            <div className="space-y-2">
              {([
                ['Ponto de Equilíbrio', fmtCur(f.pontoEquilibrio), 'text-amber-400/60'],
                ['Margem Operacional', fmtPct(f.margemOp), f.margemOp >= 0.4 ? 'text-emerald-400/70' : 'text-amber-400/70'],
                ['Cobertura do PL', `${f.coberturaPL.toFixed(2)}x`, f.coberturaPL >= 1 ? 'text-emerald-400/70' : 'text-red-400/70'],
                ['Pró-labore / Receita', f.receitaBruta > 0 ? fmtPct(f.proLabore / f.receitaBruta) : '—', 'text-[#b76e79]/70'],
                ['Impostos / Receita', fmtPct(plano.impostoAliquota), 'text-white/40'],
              ] as const).map(([label, value, cls], i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">{label}</span>
                  <span className={`text-[11px] font-mono tabular-nums ${cls}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DRE SIMPLIFICADA ═══ */}
      <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            📋 DRE Simplificada
            <span className="text-[9px] text-white/20 font-normal ml-1">Demonstrativo de Resultado do Exercício</span>
          </h2>
        </div>
        <div className="divide-y divide-white/[0.03]">
          <DRERow label="Receita Bruta de Serviços" value={f.receitaBruta} bold bg="bg-emerald-500/[0.03]" />
          <DRERow label={`(−) Impostos sobre Receita (${fmtPct(plano.impostoAliquota)} MEI)`} value={-f.impostos} />
          {catBreakdown.map(({ cat, amount }) => (
            <DRERow key={cat} label={`(−) ${CAT_LABELS[cat] || cat}`} value={-amount} indent />
          ))}
          {catBreakdown.length === 0 && f.custos > 0 && (
            <DRERow label="(−) Custos Operacionais" value={-f.custos} />
          )}
          <DRERow label="= LUCRO OPERACIONAL" value={f.lucroOperacional} bold bg="bg-blue-500/[0.03]" />

          <div className="h-px bg-white/[0.06]" />

          <DRERow label="(−) Pró-labore — Mykaele Procópio" value={-f.proLabore} bg="bg-[#b76e79]/[0.03]"
            sub={f.coberturaPL >= 1 ? '✅' : '⚠️ insuficiente'} />
          <DRERow label="= RESULTADO APÓS PRÓ-LABORE" value={f.sobra} bold
            bg={f.sobra >= 0 ? 'bg-cyan-500/[0.02]' : 'bg-red-500/[0.03]'} />

          {f.sobra > 0 && (
            <>
              <DRERow label={`(−) Reserva de Emergência (${fmtPct(plano.reservaPct)} do resultado)`} value={-f.reserva} indent />
              <DRERow label={`(−) Fundo de Capitalização (${fmtPct(plano.capitalizacaoPct)} do resultado)`} value={-f.capitalizacao} indent />
            </>
          )}

          <DRERow label="═ LUCRO DISTRIBUÍVEL" value={f.lucroDisponivel} bold
            bg={f.lucroDisponivel >= 0 ? 'bg-emerald-500/[0.04]' : 'bg-red-500/[0.04]'} />
        </div>
      </div>

      {/* ═══ COMO FUNCIONA O PLANO ═══ */}
      <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">💡 Como funciona o plano</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            {
              emoji: '🏛️', title: 'Impostos (MEI 6%)',
              desc: `Alíquota do Simples Nacional que incide sobre o faturamento bruto. Atualmente ${fmtPct(plano.impostoAliquota)}. Nesta modalidade, contribuições são fixas até o teto MEI.`,
            },
            {
              emoji: '👩‍💼', title: `Pró-labore (${fmtCur(plano.proLabore)})`,
              desc: `Retirada fixa mensal como remuneração da profissional. É o "salário" da Mykaele — separado do lucro do negócio. Incide INSS sobre pró-labore.`,
            },
            {
              emoji: '🛡️', title: `Reserva de Emergência (${fmtPct(plano.reservaPct)})`,
              desc: `${fmtPct(plano.reservaPct)} do resultado após pró-labore vai para fundo de segurança. Meta: ${fmtCur(plano.reservaMeta)} (≈ 6 meses de custos). Protege contra meses fracos.`,
            },
            {
              emoji: '🚀', title: `Capitalização (${fmtPct(plano.capitalizacaoPct)})`,
              desc: `${fmtPct(plano.capitalizacaoPct)} do resultado é reinvestido: equipamentos, cursos, marketing, expansão. É o que faz a clínica crescer e aumentar o faturamento.`,
            },
            {
              emoji: '✅', title: 'Lucro Distribuível',
              desc: 'O que sobra após todas as alocações. Pode ser retirado como distribuição de lucros (isento de IR para MEI), acumulado, ou investido conforme desejar.',
            },
            {
              emoji: '📈', title: 'Ponto de Equilíbrio',
              desc: `Receita mínima necessária para cobrir custos + pró-labore: ${fmtCur(f.pontoEquilibrio)}. Acima disso, o negócio gera lucro. Abaixo, não cobre as despesas.`,
            },
          ]).map((item, i) => (
            <div key={i} className="bg-white/[0.02] rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{item.emoji}</span>
                <span className="text-[11px] font-semibold text-white">{item.title}</span>
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ RECOMENDAÇÕES INTELIGENTES ═══ */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">🎯 Recomendações</h2>

        {f.receitaBruta === 0 && (
          <Tip type="info" text="Nenhuma receita registrada neste mês. Registre pagamentos na seção Financeiro para ver a distribuição completa." />
        )}

        {f.receitaBruta > 0 && f.receitaBruta < f.pontoEquilibrio && (
          <Tip type="warn" text={`Receita abaixo do ponto de equilíbrio (${fmtCur(f.pontoEquilibrio)}). Faltam ${fmtCur(f.pontoEquilibrio - f.receitaBruta)} para cobrir custos + pró-labore de ${fmtCur(plano.proLabore)}.`} />
        )}

        {f.receitaBruta > 0 && f.coberturaPL < 1 && (
          <Tip type="warn" text={`O lucro operacional (${fmtCur(f.lucroOperacional)}) não cobre o pró-labore de ${fmtCur(plano.proLabore)}. Considere ajustar o valor do pró-labore ou aumentar o faturamento.`} />
        )}

        {f.coberturaPL >= 2 && (
          <Tip type="ok" text={`Excelente! Lucro operacional cobre ${f.coberturaPL.toFixed(1)}x o pró-labore. Considere aumentar a reserva de emergência ou investir em capitalização para crescer.`} />
        )}

        {f.margemOp < 0.3 && f.receitaBruta > 0 && (
          <Tip type="warn" text={`Margem operacional baixa (${fmtPct(f.margemOp)}). O ideal para estética home spa é acima de 40%. Avalie reduzir custos ou reajustar preços dos serviços.`} />
        )}

        {f.margemOp >= 0.5 && f.receitaBruta > 0 && (
          <Tip type="ok" text={`Margem operacional saudável de ${fmtPct(f.margemOp)}. Os custos estão bem controlados em relação à receita.`} />
        )}

        {f.receitaBruta > 0 && f.custos / f.receitaBruta > 0.4 && (
          <Tip type="warn" text={`Custos representam ${fmtPct(f.custos / f.receitaBruta)} da receita. Ideal: abaixo de 30%. Revise as categorias de despesas para identificar onde otimizar.`} />
        )}

        {f.sobra > 0 && f.reserva + f.capitalizacao > 0 && (
          <Tip type="info" text={`Neste mês, ${fmtCur(f.reserva)} vai para reserva de emergência e ${fmtCur(f.capitalizacao)} para capitalização do negócio. Meta da reserva: ${fmtCur(plano.reservaMeta)}.`} />
        )}
      </div>

      {/* ═══ FOOTER LINK ═══ */}
      <div className="flex items-center justify-center gap-4 pt-2 pb-4">
        <Link href="/admin/financeiro" className="text-[#b76e79] text-[11px] hover:underline flex items-center gap-1.5">
          {Ico.arrow} Ir para Financeiro (receitas e despesas)
        </Link>
        <Link href="/admin/relatorios" className="text-white/30 text-[11px] hover:underline hover:text-white/50 flex items-center gap-1.5">
          {Ico.arrow} Relatórios avançados
        </Link>
      </div>
    </div>
  )
}
