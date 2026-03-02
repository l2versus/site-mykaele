'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAdmin } from '../AdminContext'

/* ─── Types ─── */
interface InventoryItem {
  id: string; name: string; description: string | null; category: string
  unit: string; quantity: number; minQuantity: number; costPerUnit: number
  active: boolean; supplierName: string | null; supplierPhone: string | null
  supplierEmail: string | null; supplierNotes: string | null
  autoOrderQty: number | null; lastOrderedAt: string | null
  movements?: StockMovement[]
}
interface StockMovement {
  id: string; type: string; quantity: number; reason: string
  cost: number | null; createdAt: string
}
interface Summary {
  totalItems: number; lowStockCount: number; outOfStockCount: number; totalValue: number
}

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

const CATEGORIES = [
  { value: 'MATERIAL', label: 'Material', color: '#8b5cf6', bg: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  { value: 'DESCARTAVEL', label: 'Descart\u00e1vel', color: '#f59e0b', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { value: 'COSMETICO', label: 'Cosm\u00e9tico', color: '#ec4899', bg: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { value: 'EQUIPAMENTO', label: 'Equipamento', color: '#10b981', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
]

const UNITS = [
  { value: 'un', label: 'Unidade(s)' },
  { value: 'ml', label: 'ml' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'cx', label: 'Caixa(s)' },
  { value: 'pct', label: 'Pacote(s)' },
]

const getCatStyle = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0]

/* ─── Icons ─── */
const Ico = {
  plus: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  box: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  alertTri: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  arrowDown: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  arrowUp: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  phone: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  whatsapp: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  x: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  search: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  history: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  truck: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
}

/* ─── Stock Level Bar ─── */
function StockBar({ qty, min }: { qty: number; min: number }) {
  const pct = min > 0 ? Math.min(100, (qty / (min * 3)) * 100) : (qty > 0 ? 100 : 0)
  const color = qty <= 0 ? 'bg-red-500' : qty <= min ? 'bg-amber-500' : qty <= min * 1.5 ? 'bg-yellow-400' : 'bg-emerald-500'
  return (
    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ─── Stock Badge ─── */
function StockBadge({ qty, min }: { qty: number; min: number }) {
  if (qty <= 0) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-medium">Esgotado</span>
  if (qty <= min) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">Estoque Baixo</span>
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium">OK</span>
}

/* ─── Modal Component ─── */
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center pt-[10vh] px-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#1a1721] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl mb-20" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-white/90 text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">{Ico.x}</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}

/* ─── Label + Input helpers ─── */
const inputCls = "w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
const selectCls = "w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all"
const labelCls = "block text-white/40 text-[10px] font-medium mb-1 uppercase tracking-wider"
const btnPrimary = "px-4 py-2 rounded-lg bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-xs font-semibold shadow-lg shadow-[#b76e79]/20 hover:shadow-[#b76e79]/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
const btnSecondary = "px-3 py-2 rounded-lg text-xs text-white/40 border border-white/[0.08] hover:bg-white/[0.04] transition-all"

export default function EstoquePage() {
  const { fetchWithAuth } = useAdmin()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [summary, setSummary] = useState<Summary>({ totalItems: 0, lowStockCount: 0, outOfStockCount: 0, totalValue: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showLowOnly, setShowLowOnly] = useState(false)

  // Modals
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [supplierItem, setSupplierItem] = useState<InventoryItem | null>(null)

  // Form states
  const emptyForm = { name: '', description: '', category: 'MATERIAL', unit: 'un', quantity: '', minQuantity: '5', costPerUnit: '', supplierName: '', supplierPhone: '', supplierEmail: '', supplierNotes: '', autoOrderQty: '' }
  const [itemForm, setItemForm] = useState(emptyForm)
  const [moveForm, setMoveForm] = useState({ type: 'IN', quantity: '', reason: '', cost: '' })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showFeedback = (msg: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3500)
  }

  /* ─── Load Data ─── */
  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/inventory?movements=true')
      if (res.ok) {
        const d = await res.json()
        setItems(d.items || [])
        setSummary(d.summary || { totalItems: 0, lowStockCount: 0, outOfStockCount: 0, totalValue: 0 })
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  /* ─── Filtered Items ─── */
  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.description?.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter && i.category !== catFilter) return false
    if (showLowOnly && i.quantity > i.minQuantity) return false
    return true
  })

  /* ─── Save Item (Create / Update) ─── */
  const saveItem = async () => {
    if (!itemForm.name) return
    setSaving(true)
    try {
      if (editingItem) {
        const res = await fetchWithAuth(`/api/admin/inventory?id=${editingItem.id}`, { method: 'PATCH', body: JSON.stringify(itemForm) })
        if (res.ok) { showFeedback('Item atualizado'); closeItemModal() }
        else showFeedback('Erro ao atualizar', 'error')
      } else {
        const res = await fetchWithAuth('/api/admin/inventory', { method: 'POST', body: JSON.stringify(itemForm) })
        if (res.ok) { showFeedback('Item criado com sucesso'); closeItemModal() }
        else {
          const d = await res.json()
          showFeedback(d.error || 'Erro ao criar', 'error')
        }
      }
      await load()
    } catch { showFeedback('Erro de conexao', 'error') }
    setSaving(false)
  }

  const closeItemModal = () => { setShowItemModal(false); setEditingItem(null); setItemForm(emptyForm) }

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name, description: item.description || '', category: item.category,
      unit: item.unit, quantity: String(item.quantity), minQuantity: String(item.minQuantity),
      costPerUnit: String(item.costPerUnit), supplierName: item.supplierName || '',
      supplierPhone: item.supplierPhone || '', supplierEmail: item.supplierEmail || '',
      supplierNotes: item.supplierNotes || '', autoOrderQty: item.autoOrderQty ? String(item.autoOrderQty) : '',
    })
    setShowItemModal(true)
  }

  /* ─── Stock Movement ─── */
  const saveMove = async () => {
    if (!moveItem || !moveForm.quantity) return
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          action: 'movement',
          itemId: moveItem.id,
          type: moveForm.type,
          quantity: parseFloat(moveForm.quantity),
          reason: moveForm.reason,
          cost: moveForm.cost ? parseFloat(moveForm.cost) : null,
        })
      })
      if (res.ok) {
        const d = await res.json()
        showFeedback(`Movimenta\u00e7\u00e3o registrada${d.expenseCreated ? ' (despesa criada)' : ''}`)
        setShowMoveModal(false); setMoveItem(null); setMoveForm({ type: 'IN', quantity: '', reason: '', cost: '' })
        await load()
      } else showFeedback('Erro ao registrar', 'error')
    } catch { showFeedback('Erro de conexao', 'error') }
    setSaving(false)
  }

  /* ─── Delete Item ─── */
  const deleteItem = async (item: InventoryItem) => {
    if (!confirm(`Remover "${item.name}" do estoque?`)) return
    try {
      const res = await fetchWithAuth(`/api/admin/inventory?id=${item.id}`, { method: 'DELETE' })
      if (res.ok) { showFeedback('Item removido'); await load() }
      else showFeedback('Erro ao remover', 'error')
    } catch { showFeedback('Erro de conexao', 'error') }
  }

  /* ─── WhatsApp Order ─── */
  const sendWhatsAppOrder = (item: InventoryItem) => {
    if (!item.supplierPhone) { showFeedback('Fornecedor sem telefone cadastrado', 'error'); return }
    const qty = item.autoOrderQty || item.minQuantity * 2
    const msg = encodeURIComponent(
      `Ola! Sou da *Mykaele Procopio Home Spa*.\n\n` +
      `Gostaria de fazer um pedido:\n\n` +
      `Produto: *${item.name}*\n` +
      `Quantidade: *${qty} ${UNITS.find(u => u.value === item.unit)?.label || item.unit}*\n` +
      (item.description ? `Obs: ${item.description}\n` : '') +
      `\nPor favor, confirme disponibilidade e valor.\nObrigada!`
    )
    const phone = item.supplierPhone.replace(/\D/g, '')
    window.open(`https://wa.me/${phone.startsWith('55') ? phone : '55' + phone}?text=${msg}`, '_blank')
  }

  /* ─── View History ─── */
  const openHistory = async (item: InventoryItem) => {
    setHistoryItem(item)
    setShowHistoryModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-2 border-[#b76e79]/30 border-t-[#b76e79] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Feedback Toast */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-[200] px-4 py-2.5 rounded-xl text-xs font-medium border shadow-lg backdrop-blur-xl animate-[fadeIn_0.3s] ${
          feedback.type === 'success'
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/15 text-red-400 border-red-500/20'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white/90 tracking-tight flex items-center gap-2">
            <span className="text-[#b76e79]">{Ico.box}</span> Controle de Estoque
          </h1>
          <p className="text-white/30 text-xs mt-1">Gerencie materiais, suprimentos e fornecedores</p>
        </div>
        <button onClick={() => { setEditingItem(null); setItemForm(emptyForm); setShowItemModal(true) }}
          className={btnPrimary + " flex items-center gap-1.5"}>
          {Ico.plus} Novo Item
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total de Itens', value: String(summary.totalItems), sub: 'cadastrados', color: 'from-violet-500/20 to-violet-600/10', border: 'border-violet-500/15', icon: Ico.box },
          { label: 'Valor em Estoque', value: fmtCur(summary.totalValue), sub: 'estimado', color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/15', icon: Ico.truck },
          { label: 'Estoque Baixo', value: String(summary.lowStockCount), sub: 'itens abaixo do min.', color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/15', icon: Ico.alertTri },
          { label: 'Esgotados', value: String(summary.outOfStockCount), sub: 'sem estoque', color: 'from-red-500/20 to-red-600/10', border: 'border-red-500/15', icon: Ico.alertTri },
        ].map((kpi, i) => (
          <div key={i} className={`bg-gradient-to-br ${kpi.color} border ${kpi.border} rounded-xl p-4 backdrop-blur-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/40 text-[10px] uppercase tracking-wider font-medium">{kpi.label}</span>
              <span className="text-white/20">{kpi.icon}</span>
            </div>
            <div className="text-white/90 text-lg font-bold tracking-tight">{kpi.value}</div>
            <div className="text-white/25 text-[10px] mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">{Ico.search}</span>
          <input
            type="text" placeholder="Buscar item..."
            value={search} onChange={e => setSearch(e.target.value)}
            className={inputCls + " pl-9 !py-2"}
          />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className={selectCls + " !w-auto !py-2"}>
          <option value="">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button
          onClick={() => setShowLowOnly(!showLowOnly)}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            showLowOnly
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-white/[0.03] text-white/40 border-white/[0.08] hover:bg-white/[0.06]'
          }`}
        >
          {Ico.alertTri} Estoque Baixo
        </button>
      </div>

      {/* ── Items Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <div className="text-4xl mb-3 opacity-30">{Ico.box}</div>
          <p className="text-sm">Nenhum item encontrado</p>
          <p className="text-xs mt-1">Adicione itens ao estoque clicando em &quot;Novo Item&quot;</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => {
            const isLow = item.quantity <= item.minQuantity
            const isOut = item.quantity <= 0
            const catStyle = getCatStyle(item.category)
            return (
              <div key={item.id}
                className={`bg-white/[0.03] border rounded-xl p-4 transition-all hover:bg-white/[0.05] ${
                  isOut ? 'border-red-500/20' : isLow ? 'border-amber-500/20' : 'border-white/[0.06]'
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${catStyle.bg}`}>
                        {catStyle.label}
                      </span>
                      <StockBadge qty={item.quantity} min={item.minQuantity} />
                    </div>
                    <h3 className="text-white/90 text-sm font-semibold truncate">{item.name}</h3>
                    {item.description && <p className="text-white/25 text-[10px] mt-0.5 truncate">{item.description}</p>}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-all" title="Editar">{Ico.edit}</button>
                    <button onClick={() => deleteItem(item)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Remover">{Ico.trash}</button>
                  </div>
                </div>

                {/* Quantity */}
                <div className="mb-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-white/80 text-lg font-bold">{item.quantity}<span className="text-white/30 text-xs ml-1">{item.unit}</span></span>
                    <span className="text-white/20 text-[10px]">min: {item.minQuantity}</span>
                  </div>
                  <StockBar qty={item.quantity} min={item.minQuantity} />
                </div>

                {/* Cost */}
                <div className="text-white/30 text-[10px] mb-3">
                  Custo unit.: {fmtCur(item.costPerUnit)} &middot; Total: {fmtCur(item.quantity * item.costPerUnit)}
                </div>

                {/* Supplier info */}
                {item.supplierName && (
                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 mb-3">
                    <div className="text-white/50 text-[10px] font-medium uppercase tracking-wider mb-1">Fornecedor</div>
                    <div className="text-white/70 text-xs font-medium">{item.supplierName}</div>
                    {item.supplierPhone && <div className="text-white/30 text-[10px] mt-0.5">{item.supplierPhone}</div>}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => { setMoveItem(item); setMoveForm({ type: 'IN', quantity: '', reason: '', cost: '' }); setShowMoveModal(true) }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                    {Ico.arrowDown} Entrada
                  </button>
                  <button onClick={() => { setMoveItem(item); setMoveForm({ type: 'OUT', quantity: '', reason: '', cost: '' }); setShowMoveModal(true) }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                    {Ico.arrowUp} Saida
                  </button>
                  <button onClick={() => openHistory(item)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.04] text-white/40 border border-white/[0.08] hover:bg-white/[0.08] transition-all">
                    {Ico.history} Historico
                  </button>
                  {item.supplierPhone && (
                    <button onClick={() => sendWhatsAppOrder(item)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all">
                      {Ico.whatsapp} Pedir
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}

      {/* ── Item Create/Edit Modal ── */}
      <Modal open={showItemModal} onClose={closeItemModal} title={editingItem ? 'Editar Item' : 'Novo Item de Estoque'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nome *</label>
              <input className={inputCls} placeholder="Ex: Cha de Hibisco" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descricao</label>
              <input className={inputCls} placeholder="Descricao opcional" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <select className={selectCls} value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Unidade</label>
              <select className={selectCls} value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}>
                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            {!editingItem && (
              <div>
                <label className={labelCls}>Qtd Inicial</label>
                <input type="number" className={inputCls} placeholder="0" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} />
              </div>
            )}
            <div>
              <label className={labelCls}>Qtd Minima</label>
              <input type="number" className={inputCls} placeholder="5" value={itemForm.minQuantity} onChange={e => setItemForm({ ...itemForm, minQuantity: e.target.value })} />
            </div>
            <div className={editingItem ? '' : 'col-span-2'}>
              <label className={labelCls}>Custo Unitario (R$)</label>
              <input type="number" step="0.01" className={inputCls} placeholder="0.00" value={itemForm.costPerUnit} onChange={e => setItemForm({ ...itemForm, costPerUnit: e.target.value })} />
            </div>
          </div>

          {/* Supplier section */}
          <div className="border-t border-white/[0.06] pt-3 mt-4">
            <h4 className="text-white/50 text-xs font-semibold mb-3 flex items-center gap-1.5">{Ico.truck} Dados do Fornecedor</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Nome do Fornecedor</label>
                <input className={inputCls} placeholder="Ex: Distribuidora XYZ" value={itemForm.supplierName} onChange={e => setItemForm({ ...itemForm, supplierName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Telefone / WhatsApp</label>
                <input className={inputCls} placeholder="(85) 99999-0000" value={itemForm.supplierPhone} onChange={e => setItemForm({ ...itemForm, supplierPhone: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" className={inputCls} placeholder="fornecedor@email.com" value={itemForm.supplierEmail} onChange={e => setItemForm({ ...itemForm, supplierEmail: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Qtd Pedido Automatico</label>
                <input type="number" className={inputCls} placeholder="Qtd padrao ao pedir" value={itemForm.autoOrderQty} onChange={e => setItemForm({ ...itemForm, autoOrderQty: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Observacoes</label>
                <input className={inputCls} placeholder="Notas sobre fornecedor" value={itemForm.supplierNotes} onChange={e => setItemForm({ ...itemForm, supplierNotes: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.06]">
            <button onClick={closeItemModal} className={btnSecondary}>Cancelar</button>
            <button onClick={saveItem} disabled={saving || !itemForm.name} className={btnPrimary}>
              {saving ? 'Salvando...' : editingItem ? 'Atualizar' : 'Criar Item'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Stock Movement Modal ── */}
      <Modal open={showMoveModal} onClose={() => { setShowMoveModal(false); setMoveItem(null) }}
        title={moveForm.type === 'IN' ? `Entrada de Estoque — ${moveItem?.name}` : `Saida de Estoque — ${moveItem?.name}`}>
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 mb-1">
            <span className="text-white/40 text-xs">Estoque atual:</span>
            <span className="text-white/80 font-bold">{moveItem?.quantity} {moveItem?.unit}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={selectCls} value={moveForm.type} onChange={e => setMoveForm({ ...moveForm, type: e.target.value })}>
                <option value="IN">Entrada (compra)</option>
                <option value="OUT">Saida (uso)</option>
                <option value="ADJUSTMENT">Ajuste</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Quantidade *</label>
              <input type="number" className={inputCls} placeholder="0" value={moveForm.quantity} onChange={e => setMoveForm({ ...moveForm, quantity: e.target.value })} />
            </div>
            {moveForm.type === 'IN' && (
              <div className="col-span-2">
                <label className={labelCls}>Custo Total da Compra (R$)</label>
                <input type="number" step="0.01" className={inputCls} placeholder="0.00" value={moveForm.cost} onChange={e => setMoveForm({ ...moveForm, cost: e.target.value })} />
                <p className="text-white/20 text-[9px] mt-1">Sera registrado automaticamente como despesa</p>
              </div>
            )}
            <div className="col-span-2">
              <label className={labelCls}>Motivo / Observacao</label>
              <input className={inputCls} placeholder={moveForm.type === 'IN' ? 'Ex: Compra mensal' : moveForm.type === 'OUT' ? 'Ex: Usado em sessao' : 'Ex: Correcao de contagem'}
                value={moveForm.reason} onChange={e => setMoveForm({ ...moveForm, reason: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.06]">
            <button onClick={() => { setShowMoveModal(false); setMoveItem(null) }} className={btnSecondary}>Cancelar</button>
            <button onClick={saveMove} disabled={saving || !moveForm.quantity} className={btnPrimary}>
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── History Modal ── */}
      <Modal open={showHistoryModal} onClose={() => { setShowHistoryModal(false); setHistoryItem(null) }}
        title={`Historico — ${historyItem?.name || ''}`}>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {(!historyItem?.movements || historyItem.movements.length === 0) ? (
            <p className="text-white/30 text-xs text-center py-8">Nenhuma movimenta\u00e7\u00e3o registrada</p>
          ) : (
            historyItem.movements.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <span className={`p-1.5 rounded-lg ${
                  m.type === 'IN' ? 'bg-emerald-500/15 text-emerald-400' : m.type === 'OUT' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'
                }`}>
                  {m.type === 'IN' ? Ico.arrowDown : m.type === 'OUT' ? Ico.arrowUp : Ico.edit}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/80 text-xs font-medium">
                      {m.type === 'IN' ? '+' : m.type === 'OUT' ? '' : ''}{m.quantity} {historyItem.unit}
                    </span>
                    <span className="text-white/20 text-[9px]">{fmtDate(m.createdAt)}</span>
                  </div>
                  <p className="text-white/30 text-[10px] truncate">{m.reason}</p>
                </div>
                {m.cost !== null && m.cost > 0 && (
                  <span className="text-white/30 text-[10px]">{fmtCur(m.cost)}</span>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* ── Supplier Detail Modal ── */}
      <Modal open={showSupplierModal} onClose={() => { setShowSupplierModal(false); setSupplierItem(null) }}
        title={`Fornecedor — ${supplierItem?.name || ''}`}>
        {supplierItem && (
          <div className="space-y-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 space-y-2">
              {supplierItem.supplierName && <div><span className="text-white/30 text-[10px]">Nome:</span><p className="text-white/80 text-sm">{supplierItem.supplierName}</p></div>}
              {supplierItem.supplierPhone && <div><span className="text-white/30 text-[10px]">Telefone:</span><p className="text-white/80 text-sm">{supplierItem.supplierPhone}</p></div>}
              {supplierItem.supplierEmail && <div><span className="text-white/30 text-[10px]">Email:</span><p className="text-white/80 text-sm">{supplierItem.supplierEmail}</p></div>}
              {supplierItem.supplierNotes && <div><span className="text-white/30 text-[10px]">Notas:</span><p className="text-white/80 text-sm">{supplierItem.supplierNotes}</p></div>}
            </div>
            {supplierItem.supplierPhone && (
              <button onClick={() => sendWhatsAppOrder(supplierItem)} className={btnPrimary + " w-full flex items-center justify-center gap-2"}>
                {Ico.whatsapp} Enviar Pedido via WhatsApp
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
