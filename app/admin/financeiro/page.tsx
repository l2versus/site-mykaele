'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAdmin } from '../AdminContext'

interface Payment { id: string; amount: number; method: string; description?: string; createdAt: string; user?: { name: string } }
interface Expense { id: string; amount: number; description: string; category: string; date: string }
interface FinanceData {
  revenue: number; expenses: number; profit: number
  payments: Payment[]
  expensesList: Expense[]
}

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
const fmtDateFull = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

const CATS = [
  { value: 'MATERIAL', label: 'Material', color: '#8b5cf6' },
  { value: 'DESLOCAMENTO', label: 'Deslocamento', color: '#f59e0b' },
  { value: 'ALUGUEL', label: 'Aluguel', color: '#ef4444' },
  { value: 'MARKETING', label: 'Marketing', color: '#3b82f6' },
  { value: 'EQUIPAMENTO', label: 'Equipamento', color: '#10b981' },
  { value: 'OUTROS', label: 'Outros', color: '#6b7280' },
]

const METHODS = ['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA']
const METHOD_LABELS: Record<string, string> = { PIX: 'PIX', DINHEIRO: 'Dinheiro', CARTAO_CREDITO: 'Cartão Crédito', CARTAO_DEBITO: 'Cartão Débito', TRANSFERENCIA: 'Transferência' }

/* SVG Icons */
const Ico = {
  plus: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  up: <svg width="14" height="14" fill="none" stroke="#34d399" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  down: <svg width="14" height="14" fill="none" stroke="#f87171" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  dollar: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  x: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  warn: <svg width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
}

/* Mini bar chart SVG */
function MiniChart({ data, max }: { data: number[]; max: number }) {
  const w = 100; const h = 40; const barW = data.length > 0 ? Math.max(2, (w / data.length) - 1) : 4
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      {data.map((v, i) => {
        const barH = max > 0 ? (v / max) * h * 0.85 : 0
        return <rect key={i} x={i * (barW + 1)} y={h - barH} width={barW} height={barH} rx="1" fill="#b76e79" opacity={0.6 + (v / (max || 1)) * 0.4} />
      })}
    </svg>
  )
}

/* Donut chart */
function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div className="w-32 h-32 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 text-xs">Sem dados</div>
  const size = 128; const cx = size / 2; const cy = size / 2; const r = 48; const sw = 14
  let cumAngle = -90
  const arcs = segments.filter(s => s.value > 0).map(s => {
    const angle = (s.value / total) * 360
    const startAngle = cumAngle; cumAngle += angle
    const endAngle = startAngle + angle
    const largeArc = angle > 180 ? 1 : 0
    const rad = (a: number) => (a * Math.PI) / 180
    const x1 = cx + r * Math.cos(rad(startAngle)); const y1 = cy + r * Math.sin(rad(startAngle))
    const x2 = cx + r * Math.cos(rad(endAngle)); const y2 = cy + r * Math.sin(rad(endAngle))
    return { ...s, d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, pct: Math.round((s.value / total) * 100) }
  })
  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth={sw} />
        {arcs.map((a, i) => <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={sw} strokeLinecap="round" />)}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-stone-800 text-lg font-bold">{fmtCur(total)}</div>
          <div className="text-stone-400 text-[10px]">Total</div>
        </div>
      </div>
    </div>
  )
}

/* ─── Confirm Delete Modal ─── */
function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center px-4" onClick={onCancel}>
      <div className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="mt-0.5">{Ico.warn}</div>
          <div>
            <h3 className="text-stone-800 text-sm font-semibold">Confirmar Exclusão</h3>
            <p className="text-stone-500 text-xs mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-xs text-stone-400 border border-stone-200 hover:bg-stone-50 transition-all">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-1.5 rounded-md text-xs bg-red-500/15 text-red-400 border border-red-500/20 font-medium hover:bg-red-500/25 transition-all">Excluir</button>
        </div>
      </div>
    </div>
  )
}

export default function FinanceiroPage() {
  const { fetchWithAuth } = useAdmin()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [tab, setTab] = useState<'receitas' | 'despesas'>('receitas')

  // Modals
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddRevenue, setShowAddRevenue] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'expense' | 'payment'; label: string } | null>(null)

  // Forms
  const [expForm, setExpForm] = useState({ description: '', amount: '', category: 'MATERIAL' })
  const [revForm, setRevForm] = useState({ description: '', amount: '', method: 'PIX' })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showFeedback = (msg: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3000)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/admin/finances?period=${period}`)
      if (res.ok) {
        const d = await res.json()
        setData({
          revenue: d.totalRevenue ?? d.revenue ?? 0,
          expenses: typeof d.totalExpenses === 'number' ? d.totalExpenses : (typeof d.expenses === 'number' ? d.expenses : 0),
          profit: d.profit ?? 0,
          payments: d.payments || [],
          expensesList: Array.isArray(d.expenses) ? d.expenses : (d.expensesList || []),
        })
      }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth, period])

  useEffect(() => { load() }, [load])

  /* ─── Add Expense ─── */
  const addExpense = async () => {
    if (!expForm.description || !expForm.amount) return
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/admin/finances', { method: 'POST', body: JSON.stringify({ ...expForm, amount: parseFloat(expForm.amount) }) })
      if (res.ok) {
        await load()
        setShowAddExpense(false)
        setExpForm({ description: '', amount: '', category: 'MATERIAL' })
        showFeedback('Despesa adicionada com sucesso')
      } else showFeedback('Erro ao adicionar despesa', 'error')
    } catch { showFeedback('Erro de conexão', 'error') }
    setSaving(false)
  }

  /* ─── Add Revenue ─── */
  const addRevenue = async () => {
    if (!revForm.description || !revForm.amount) return
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/admin/finances', {
        method: 'POST',
        body: JSON.stringify({ type: 'revenue', description: revForm.description, amount: parseFloat(revForm.amount), method: revForm.method })
      })
      if (res.ok) {
        await load()
        setShowAddRevenue(false)
        setRevForm({ description: '', amount: '', method: 'PIX' })
        showFeedback('Receita registrada com sucesso')
      } else showFeedback('Erro ao registrar receita', 'error')
    } catch { showFeedback('Erro de conexão', 'error') }
    setSaving(false)
  }

  /* ─── Update Expense ─── */
  const updateExpense = async () => {
    if (!editingExpense) return
    setSaving(true)
    try {
      const res = await fetchWithAuth(`/api/admin/finances?id=${editingExpense.id}&type=expense`, {
        method: 'PATCH',
        body: JSON.stringify({ description: expForm.description, amount: parseFloat(expForm.amount), category: expForm.category })
      })
      if (res.ok) {
        await load()
        setEditingExpense(null)
        setExpForm({ description: '', amount: '', category: 'MATERIAL' })
        showFeedback('Despesa atualizada')
      } else showFeedback('Erro ao atualizar', 'error')
    } catch { showFeedback('Erro de conexão', 'error') }
    setSaving(false)
  }

  /* ─── Update Payment ─── */
  const updatePayment = async () => {
    if (!editingPayment) return
    setSaving(true)
    try {
      const res = await fetchWithAuth(`/api/admin/finances?id=${editingPayment.id}&type=payment`, {
        method: 'PATCH',
        body: JSON.stringify({ description: revForm.description, amount: parseFloat(revForm.amount), method: revForm.method })
      })
      if (res.ok) {
        await load()
        setEditingPayment(null)
        setRevForm({ description: '', amount: '', method: 'PIX' })
        showFeedback('Receita atualizada')
      } else showFeedback('Erro ao atualizar', 'error')
    } catch { showFeedback('Erro de conexão', 'error') }
    setSaving(false)
  }

  /* ─── Delete ─── */
  const handleDelete = async () => {
    if (!confirmDelete) return
    setSaving(true)
    try {
      const res = await fetchWithAuth(`/api/admin/finances?id=${confirmDelete.id}&type=${confirmDelete.type}`, { method: 'DELETE' })
      if (res.ok) {
        await load()
        showFeedback(`${confirmDelete.type === 'expense' ? 'Despesa' : 'Receita'} excluída`)
      } else showFeedback('Erro ao excluir', 'error')
    } catch { showFeedback('Erro de conexão', 'error') }
    setConfirmDelete(null)
    setSaving(false)
  }

  /* ─── Open edit modals ─── */
  const openEditExpense = (e: Expense) => {
    setExpForm({ description: e.description, amount: String(e.amount), category: e.category })
    setEditingExpense(e)
  }

  const openEditPayment = (p: Payment) => {
    setRevForm({ description: p.description || p.user?.name || '', amount: String(p.amount), method: p.method })
    setEditingPayment(p)
  }

  const periods = [{ v: 'week', l: 'Semana' }, { v: 'month', l: 'Mês' }, { v: 'year', l: 'Ano' }]

  // Build chart data from payments
  const dailyRevData = data?.payments?.reduce<Record<string, number>>((acc, p) => {
    const d = new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    acc[d] = (acc[d] || 0) + p.amount; return acc
  }, {}) || {}
  const chartValues = Object.values(dailyRevData)
  const chartMax = Math.max(...chartValues, 1)

  // Expense categories breakdown
  const catBreakdown = CATS.map(c => ({
    ...c,
    value: (data?.expensesList || []).filter(e => e.category === c.value).reduce((s, e) => s + e.amount, 0)
  })).filter(c => c.value > 0)

  return (
    <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-[70] px-4 py-2.5 rounded-lg text-xs font-medium shadow-lg border animate-[fadeIn_0.2s_ease-out] ${
          feedback.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? Ico.check : Ico.x}
            {feedback.msg}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Financeiro</h1>
          <p className="text-stone-400 text-xs mt-0.5">Fluxo de caixa e indicadores</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => { setRevForm({ description: '', amount: '', method: 'PIX' }); setEditingPayment(null); setShowAddRevenue(true) }}
            className="px-3.5 py-2 rounded-lg text-xs bg-emerald-500/12 border border-emerald-500/20 text-emerald-400 font-medium hover:bg-emerald-500/20 transition-all flex items-center gap-1.5">
            {Ico.plus} Receita
          </button>
          <button onClick={() => { setExpForm({ description: '', amount: '', category: 'MATERIAL' }); setEditingExpense(null); setShowAddExpense(true) }}
            className="px-3.5 py-2 rounded-lg text-xs bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white font-medium hover:shadow-lg hover:shadow-[#b76e79]/20 transition-all flex items-center gap-1.5">
            {Ico.plus} Despesa
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5">
        {periods.map(p => (
          <button key={p.v} onClick={() => { setPeriod(p.v); setLoading(true) }}
            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${period === p.v ? 'bg-[#b76e79]/15 text-[#b76e79] border border-[#b76e79]/20' : 'bg-white text-stone-400 border border-stone-100 hover:text-stone-500'}`}>
            {p.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                {Ico.up}
                <span className="text-emerald-400/60 text-[10px] font-medium uppercase tracking-wider">Receitas</span>
              </div>
              <div className="text-emerald-400 text-xl font-bold">{fmtCur(data.revenue)}</div>
              {chartValues.length > 1 && <div className="mt-2"><MiniChart data={chartValues} max={chartMax} /></div>}
            </div>
            <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                {Ico.down}
                <span className="text-red-400/60 text-[10px] font-medium uppercase tracking-wider">Despesas</span>
              </div>
              <div className="text-red-400 text-xl font-bold">{fmtCur(data.expenses)}</div>
              <div className="text-stone-300 text-[10px] mt-1">{data.expensesList?.length || 0} registro(s)</div>
            </div>
            <div className={`${data.profit >= 0 ? 'bg-blue-500/8 border-blue-500/15' : 'bg-red-500/8 border-red-500/15'} border rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={data.profit >= 0 ? 'text-blue-400' : 'text-red-400'}>{Ico.dollar}</span>
                <span className={`${data.profit >= 0 ? 'text-blue-400/60' : 'text-red-400/60'} text-[10px] font-medium uppercase tracking-wider`}>Lucro</span>
              </div>
              <div className={`${data.profit >= 0 ? 'text-blue-400' : 'text-red-400'} text-xl font-bold`}>{fmtCur(data.profit)}</div>
              {data.revenue > 0 && <div className="text-stone-400 text-[10px] mt-1">Margem: {Math.round((data.profit / data.revenue) * 100)}%</div>}
            </div>
          </div>

          {/* Chart area + donut */}
          {(catBreakdown.length > 0 || (data.payments?.length || 0) > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {catBreakdown.length > 0 && (
                <div className="bg-white border border-stone-100 rounded-xl p-5 flex flex-col items-center">
                  <h3 className="text-xs font-medium text-stone-500 mb-4 self-start">Despesas por Categoria</h3>
                  <DonutChart segments={catBreakdown} />
                  <div className="mt-4 space-y-1.5 w-full">
                    {catBreakdown.map(c => (
                      <div key={c.value} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="text-stone-500">{c.label}</span>
                        </div>
                        <span className="text-stone-600 font-medium">{fmtCur(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revenue by method */}
              <div className={`bg-white border border-stone-100 rounded-xl p-5 ${catBreakdown.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                <h3 className="text-xs font-medium text-stone-500 mb-3">Resumo de Receitas por Método</h3>
                {(() => {
                  const byMethod = (data.payments || []).reduce<Record<string, number>>((acc, p) => { acc[p.method] = (acc[p.method] || 0) + p.amount; return acc }, {})
                  const entries = Object.entries(byMethod)
                  const maxAmt = Math.max(...entries.map(e => e[1]), 1)
                  return entries.length > 0 ? (
                    <div className="space-y-2">
                      {entries.map(([method, amount]) => (
                        <div key={method}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-stone-500">{METHOD_LABELS[method] || method}</span>
                            <span className="text-stone-600 font-medium">{fmtCur(amount)}</span>
                          </div>
                          <div className="h-1.5 bg-stone-50 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] rounded-full transition-all" style={{ width: `${(amount / maxAmt) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-stone-300 text-xs py-6 text-center">Nenhuma receita registrada</p>
                })()}
              </div>
            </div>
          )}

          {/* Transactions tabs */}
          <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
            <div className="flex border-b border-stone-100">
              <button onClick={() => setTab('receitas')} className={`flex-1 px-4 py-3 text-xs font-medium transition-all ${tab === 'receitas' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5' : 'text-stone-400 hover:text-stone-500'}`}>
                Receitas ({data.payments?.length || 0})
              </button>
              <button onClick={() => setTab('despesas')} className={`flex-1 px-4 py-3 text-xs font-medium transition-all ${tab === 'despesas' ? 'text-red-400 border-b-2 border-red-400 bg-red-500/5' : 'text-stone-400 hover:text-stone-500'}`}>
                Despesas ({data.expensesList?.length || 0})
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {tab === 'receitas' ? (
                (data.payments?.length || 0) === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-stone-300 text-xs mb-3">Nenhuma receita registrada</p>
                    <button onClick={() => { setRevForm({ description: '', amount: '', method: 'PIX' }); setEditingPayment(null); setShowAddRevenue(true) }}
                      className="px-3 py-1.5 rounded-md text-[11px] text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all">
                      + Registrar receita
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {data.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2.5 px-2 border-b border-stone-100 last:border-0 rounded-md hover:bg-white group transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="text-stone-600 text-xs font-medium truncate">{p.user?.name || p.description || 'Pagamento'}</div>
                          <div className="text-stone-400 text-[10px]">{fmtDate(p.createdAt)} · {METHOD_LABELS[p.method] || p.method}</div>
                          {p.description && p.user?.name && <div className="text-stone-300 text-[10px] truncate">{p.description}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 text-xs font-semibold">+{fmtCur(p.amount)}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditPayment(p)} className="p-1 rounded text-stone-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Editar">
                              {Ico.edit}
                            </button>
                            <button onClick={() => setConfirmDelete({ id: p.id, type: 'payment', label: p.description || p.user?.name || 'Pagamento' })}
                              className="p-1 rounded text-stone-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Excluir">
                              {Ico.trash}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                (data.expensesList?.length || 0) === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-stone-300 text-xs mb-3">Nenhuma despesa registrada</p>
                    <button onClick={() => { setExpForm({ description: '', amount: '', category: 'MATERIAL' }); setEditingExpense(null); setShowAddExpense(true) }}
                      className="px-3 py-1.5 rounded-md text-[11px] text-[#b76e79] border border-[#b76e79]/20 hover:bg-[#b76e79]/10 transition-all">
                      + Adicionar despesa
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {data.expensesList.map(e => (
                      <div key={e.id} className="flex items-center justify-between py-2.5 px-2 border-b border-stone-100 last:border-0 rounded-md hover:bg-white group transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATS.find(c => c.value === e.category)?.color || '#6b7280' }} />
                            <div className="text-stone-600 text-xs font-medium truncate">{e.description}</div>
                          </div>
                          <div className="text-stone-400 text-[10px] ml-4">{fmtDateFull(e.date)} · {CATS.find(c => c.value === e.category)?.label || e.category}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 text-xs font-semibold">-{fmtCur(e.amount)}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditExpense(e)} className="p-1 rounded text-stone-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Editar">
                              {Ico.edit}
                            </button>
                            <button onClick={() => setConfirmDelete({ id: e.id, type: 'expense', label: e.description })}
                              className="p-1 rounded text-stone-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Excluir">
                              {Ico.trash}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Modal: Add/Edit Expense ─── */}
      {(showAddExpense || editingExpense) && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center px-4" onClick={() => { setShowAddExpense(false); setEditingExpense(null) }}>
          <div className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-stone-800 text-sm font-semibold">{editingExpense ? 'Editar Despesa' : 'Adicionar Despesa'}</h3>
              <button onClick={() => { setShowAddExpense(false); setEditingExpense(null) }} className="text-stone-400 hover:text-stone-500 transition-colors">{Ico.x}</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Descrição</label>
                <input value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all" placeholder="Ex: Gasolina deslocamento" />
              </div>
              <div>
                <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Valor (R$)</label>
                <input type="number" step="0.01" min="0" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Categoria</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATS.map(c => (
                    <button key={c.value} onClick={() => setExpForm({ ...expForm, category: c.value })}
                      className={`px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all ${expForm.category === c.value ? 'border-[#b76e79]/30 bg-[#b76e79]/10 text-[#b76e79]' : 'border-stone-200 text-stone-400 hover:text-stone-500'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setShowAddExpense(false); setEditingExpense(null) }} className="px-3 py-1.5 rounded-md text-xs text-stone-400 border border-stone-200 hover:bg-stone-50 transition-all">Cancelar</button>
                <button onClick={editingExpense ? updateExpense : addExpense} disabled={saving || !expForm.description || !expForm.amount}
                  className="px-4 py-1.5 rounded-md text-xs bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-[#b76e79]/20 transition-all">
                  {saving ? 'Salvando...' : editingExpense ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Modal: Add/Edit Revenue ─── */}
      {(showAddRevenue || editingPayment) && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center px-4" onClick={() => { setShowAddRevenue(false); setEditingPayment(null) }}>
          <div className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-stone-800 text-sm font-semibold">{editingPayment ? 'Editar Receita' : 'Registrar Receita'}</h3>
              <button onClick={() => { setShowAddRevenue(false); setEditingPayment(null) }} className="text-stone-400 hover:text-stone-500 transition-colors">{Ico.x}</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Descrição</label>
                <input value={revForm.description} onChange={e => setRevForm({ ...revForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-emerald-500/40 transition-all" placeholder="Ex: Sessão massagem Maria" />
              </div>
              <div>
                <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Valor (R$)</label>
                <input type="number" step="0.01" min="0" value={revForm.amount} onChange={e => setRevForm({ ...revForm, amount: e.target.value })}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-emerald-500/40 transition-all" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Método de Pagamento</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {METHODS.map(m => (
                    <button key={m} onClick={() => setRevForm({ ...revForm, method: m })}
                      className={`px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all ${revForm.method === m ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-stone-200 text-stone-400 hover:text-stone-500'}`}>
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setShowAddRevenue(false); setEditingPayment(null) }} className="px-3 py-1.5 rounded-md text-xs text-stone-400 border border-stone-200 hover:bg-stone-50 transition-all">Cancelar</button>
                <button onClick={editingPayment ? updatePayment : addRevenue} disabled={saving || !revForm.description || !revForm.amount}
                  className="px-4 py-1.5 rounded-md text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium disabled:opacity-50 hover:bg-emerald-500/25 transition-all">
                  {saving ? 'Salvando...' : editingPayment ? 'Salvar' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Confirm Delete Modal ─── */}
      {confirmDelete && createPortal(
        <ConfirmModal
          message={`Tem certeza que deseja excluir "${confirmDelete.label}"? Essa ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />,
        document.body
      )}
    </div>
  )
}
