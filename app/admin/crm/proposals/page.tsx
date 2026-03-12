'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

/* ── types ─────────────────────────────────────── */

interface ProposalItem {
  id?: string
  name: string
  description: string
  quantity: number
  unitPrice: number
  sortOrder: number
}

interface Proposal {
  id: string
  leadId: string
  leadName: string
  title: string
  description: string | null
  items: ProposalItem[]
  discount: number
  discountType: string
  totalValue: number
  validUntil: string | null
  status: string
  publicToken: string
  sentAt: string | null
  viewedAt: string | null
  respondedAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface SearchLead {
  id: string
  name: string
  phone: string
  email: string | null
}

/* ── constants ─────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'var(--crm-text-muted)' },
  SENT: { label: 'Enviada', color: 'var(--crm-cold)' },
  VIEWED: { label: 'Visualizada', color: 'var(--crm-warm)' },
  ACCEPTED: { label: 'Aceita', color: 'var(--crm-won)' },
  REJECTED: { label: 'Recusada', color: 'var(--crm-hot)' },
  EXPIRED: { label: 'Expirada', color: 'var(--crm-text-muted)' },
}

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {}),
    },
  })
  return res.json()
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════ */

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null)
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null)
  const [actionPortal, setActionPortal] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setActionPortal(document.getElementById('crm-page-actions'))
  }, [])

  const loadProposals = useCallback(async () => {
    const params = new URLSearchParams({ tenantId: TENANT_ID })
    if (statusFilter) params.set('status', statusFilter)
    const data = await apiFetch(`/api/admin/crm/proposals?${params}`)
    if (data.proposals) setProposals(data.proposals)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { loadProposals() }, [loadProposals])

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta proposta?')) return
    await apiFetch(`/api/admin/crm/proposals/${id}`, { method: 'DELETE' })
    loadProposals()
    if (detailProposal?.id === id) setDetailProposal(null)
  }

  const handleSend = async (id: string) => {
    if (!confirm('Enviar proposta via WhatsApp?')) return
    const data = await apiFetch(`/api/admin/crm/proposals/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'send' }),
    })
    if (data.success) loadProposals()
    else alert(data.error || 'Erro ao enviar')
  }

  const handleDuplicate = async (id: string) => {
    const data = await apiFetch(`/api/admin/crm/proposals/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'duplicate' }),
    })
    if (data.proposal) {
      loadProposals()
      setDetailProposal(null)
    }
  }

  const handleCreated = () => {
    setShowCreate(false)
    setEditingProposal(null)
    loadProposals()
  }

  const statuses = ['', 'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']

  /* ── accepted / total counts ── */
  const acceptedCount = proposals.filter(p => p.status === 'ACCEPTED').length
  const totalValue = proposals.reduce((s, p) => s + p.totalValue, 0)
  const acceptedValue = proposals.filter(p => p.status === 'ACCEPTED').reduce((s, p) => s + p.totalValue, 0)

  return (
    <div className="space-y-5">
      {/* Portal: header action */}
      {actionPortal && createPortal(
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            onClick={() => { setEditingProposal(null); setShowCreate(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--crm-gold)', color: '#000' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Nova Proposta
          </button>
        </div>,
        actionPortal
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: proposals.length, sub: formatCurrency(totalValue) },
          { label: 'Aceitas', value: acceptedCount, sub: formatCurrency(acceptedValue), color: 'var(--crm-won)' },
          { label: 'Enviadas', value: proposals.filter(p => p.status === 'SENT').length, color: 'var(--crm-cold)' },
          { label: 'Taxa de Aceite', value: proposals.length > 0 ? `${Math.round((acceptedCount / proposals.length) * 100)}%` : '—', color: 'var(--crm-gold)' },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-xl p-4 border"
            style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--crm-text-muted)' }}>{stat.label}</p>
            <p className="text-xl font-bold" style={{ color: stat.color || 'var(--crm-text)' }}>{stat.value}</p>
            {stat.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {statuses.map(s => {
          const info = s ? STATUS_MAP[s] : null
          const active = statusFilter === s
          return (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
              style={{
                background: active ? (s ? `${info?.color}18` : 'var(--crm-gold-subtle)') : 'transparent',
                borderColor: active ? (s ? info?.color : 'var(--crm-gold)') : 'var(--crm-border)',
                color: active ? (s ? info?.color : 'var(--crm-gold)') : 'var(--crm-text-muted)',
              }}
            >
              {s ? info?.label : 'Todas'}
            </button>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        >
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--crm-gold-subtle)' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-gold)' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--crm-text)' }}>Nenhuma proposta</h3>
          <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Crie sua primeira proposta comercial</p>
        </div>
      ) : (
        <div className="space-y-2">
          {proposals.map(p => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.DRAFT
            const isExpired = p.validUntil && new Date(p.validUntil) < new Date() && p.status === 'SENT'
            return (
              <div
                key={p.id}
                onClick={() => setDetailProposal(p)}
                className="rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.005]"
                style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--crm-gold)40' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium truncate" style={{ color: 'var(--crm-text)' }}>{p.title}</h3>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{ background: `${st.color}18`, color: st.color }}
                      >
                        {isExpired ? 'Expirada' : st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--crm-text-muted)' }}>
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        {p.leadName}
                      </span>
                      <span>{p.items.length} {p.items.length === 1 ? 'item' : 'itens'}</span>
                      <span>{formatDate(p.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold" style={{ color: 'var(--crm-gold)' }}>
                      {formatCurrency(p.totalValue)}
                    </p>
                    {p.discount > 0 && (
                      <p className="text-[10px]" style={{ color: 'var(--crm-won)' }}>
                        {p.discountType === 'percent' ? `${p.discount}% desc.` : `${formatCurrency(p.discount)} desc.`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {(showCreate || editingProposal) && (
        <ProposalFormModal
          proposal={editingProposal}
          onClose={() => { setShowCreate(false); setEditingProposal(null) }}
          onSaved={handleCreated}
        />
      )}

      {detailProposal && (
        <ProposalDetailModal
          proposal={detailProposal}
          onClose={() => setDetailProposal(null)}
          onSend={handleSend}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onEdit={(p) => { setDetailProposal(null); setEditingProposal(p) }}
          onRefresh={loadProposals}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   CREATE / EDIT MODAL
   ══════════════════════════════════════════════════════ */

function ProposalFormModal({
  proposal,
  onClose,
  onSaved,
}: {
  proposal: Proposal | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!proposal

  /* Lead search */
  const [leadQuery, setLeadQuery] = useState('')
  const [leadResults, setLeadResults] = useState<SearchLead[]>([])
  const [selectedLead, setSelectedLead] = useState<SearchLead | null>(
    proposal ? { id: proposal.leadId, name: proposal.leadName, phone: '', email: null } : null
  )
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (leadQuery.length < 2 || selectedLead) { setLeadResults([]); return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const data = await apiFetch(`/api/admin/crm/proposals?tenantId=${TENANT_ID}&searchLeads=${encodeURIComponent(leadQuery)}`)
      if (data.leads) setLeadResults(data.leads)
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [leadQuery, selectedLead])

  /* Form fields */
  const [title, setTitle] = useState(proposal?.title || '')
  const [description, setDescription] = useState(proposal?.description || '')
  const [items, setItems] = useState<ProposalItem[]>(
    proposal?.items?.length
      ? proposal.items.map(it => ({ ...it }))
      : [{ name: '', description: '', quantity: 1, unitPrice: 0, sortOrder: 0 }]
  )
  const [discount, setDiscount] = useState(proposal?.discount || 0)
  const [discountType, setDiscountType] = useState(proposal?.discountType || 'percent')
  const [validUntil, setValidUntil] = useState(proposal?.validUntil ? proposal.validUntil.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)

  const subtotal = items.reduce((s, it) => s + (it.quantity || 1) * (it.unitPrice || 0), 0)
  const discountValue = discountType === 'percent' ? subtotal * (discount / 100) : discount
  const total = Math.max(0, subtotal - discountValue)

  const addItem = () => {
    setItems([...items, { name: '', description: '', quantity: 1, unitPrice: 0, sortOrder: items.length }])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ProposalItem, value: string | number) => {
    setItems(items.map((it, i) => i === index ? { ...it, [field]: value } : it))
  }

  const handleSave = async () => {
    if (!selectedLead && !isEdit) return alert('Selecione um lead')
    if (!title.trim()) return alert('Título obrigatório')
    if (!items.some(it => it.name.trim() && it.unitPrice > 0)) return alert('Adicione pelo menos um item com nome e valor')

    setSaving(true)
    const validItems = items.filter(it => it.name.trim()).map((it, i) => ({
      name: it.name,
      description: it.description || '',
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0,
      sortOrder: i,
    }))

    const payload = {
      tenantId: TENANT_ID,
      leadId: selectedLead?.id || proposal?.leadId,
      title,
      description: description || null,
      items: validItems,
      discount,
      discountType,
      validUntil: validUntil || null,
    }

    const data = isEdit
      ? await apiFetch(`/api/admin/crm/proposals/${proposal.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      : await apiFetch('/api/admin/crm/proposals', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

    setSaving(false)
    if (data.proposal) onSaved()
    else alert(data.error || 'Erro ao salvar')
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--crm-bg)',
    borderColor: 'var(--crm-border)',
    color: 'var(--crm-text)',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>
            {isEdit ? 'Editar Proposta' : 'Nova Proposta'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--crm-text-muted)' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Lead search */}
          {!isEdit && (
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Lead</label>
              {selectedLead ? (
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-lg border"
                  style={inputStyle}
                >
                  <span className="text-sm" style={{ color: 'var(--crm-text)' }}>{selectedLead.name}</span>
                  <button onClick={() => { setSelectedLead(null); setLeadQuery('') }} className="text-xs" style={{ color: 'var(--crm-hot)' }}>Trocar</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={leadQuery}
                    onChange={e => setLeadQuery(e.target.value)}
                    placeholder="Buscar lead por nome ou telefone..."
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                    style={{ ...inputStyle, ['--tw-ring-color' as string]: 'var(--crm-gold)' }}
                  />
                  {leadResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden z-10 max-h-48 overflow-y-auto" style={{ background: 'var(--crm-surface-2)', borderColor: 'var(--crm-border)' }}>
                      {leadResults.map(l => (
                        <button
                          key={l.id}
                          onClick={() => { setSelectedLead(l); setLeadQuery(l.name); setLeadResults([]) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                          style={{ color: 'var(--crm-text)' }}
                        >
                          <span className="font-medium">{l.name}</span>
                          <span className="ml-2 text-xs" style={{ color: 'var(--crm-text-muted)' }}>{l.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Titulo</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Harmonização Facial Completa"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Descricao (opcional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalhes da proposta..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none focus:ring-1"
              style={inputStyle}
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>Itens / Servicos</label>
              <button onClick={addItem} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--crm-gold)' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2" style={{ background: 'var(--crm-bg)', borderColor: 'var(--crm-border)' }}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => updateItem(idx, 'name', e.target.value)}
                      placeholder="Nome do servico"
                      className="flex-1 px-2 py-1.5 rounded border text-sm outline-none"
                      style={inputStyle}
                    />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-white/5">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--crm-hot)' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    placeholder="Descricao (opcional)"
                    className="w-full px-2 py-1.5 rounded border text-xs outline-none"
                    style={inputStyle}
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--crm-text-muted)' }}>Qtd</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1.5 rounded border text-sm outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex-[2]">
                      <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--crm-text-muted)' }}>Valor unitario (R$)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice || ''}
                        onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 rounded border text-sm outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex-1 text-right pt-3">
                      <p className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount & Validity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Desconto</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={discount || ''}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Tipo</label>
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={inputStyle}
              >
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Validade</label>
              <input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Totals preview */}
          <div className="rounded-lg border p-4 space-y-2" style={{ background: 'var(--crm-bg)', borderColor: 'var(--crm-border)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--crm-text-muted)' }}>Subtotal</span>
              <span style={{ color: 'var(--crm-text)' }}>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--crm-won)' }}>
                  Desconto {discountType === 'percent' ? `(${discount}%)` : ''}
                </span>
                <span style={{ color: 'var(--crm-won)' }}>-{formatCurrency(discountValue)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2" style={{ borderColor: 'var(--crm-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Total</span>
              <span className="text-lg font-bold" style={{ color: 'var(--crm-gold)' }}>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 p-5 border-t" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-text-muted)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'var(--crm-gold)', color: '#000' }}
          >
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Proposta'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   DETAIL MODAL
   ══════════════════════════════════════════════════════ */

function ProposalDetailModal({
  proposal,
  onClose,
  onSend,
  onDuplicate,
  onDelete,
  onEdit,
  onRefresh,
}: {
  proposal: Proposal
  onClose: () => void
  onSend: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (p: Proposal) => void
  onRefresh: () => void
}) {
  const st = STATUS_MAP[proposal.status] || STATUS_MAP.DRAFT
  const subtotal = proposal.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  const isExpired = proposal.validUntil && new Date(proposal.validUntil) < new Date() && !['ACCEPTED', 'REJECTED'].includes(proposal.status)
  const canSend = ['DRAFT', 'VIEWED'].includes(proposal.status) && !isExpired
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const publicUrl = `${appUrl}/proposta/${proposal.publicToken}`

  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>{proposal.title}</h2>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: `${st.color}18`, color: st.color }}
              >
                {isExpired ? 'Expirada' : st.label}
              </span>
            </div>
            <p className="text-xs flex items-center gap-2" style={{ color: 'var(--crm-text-muted)' }}>
              <span>Para: {proposal.leadName}</span>
              <span>|</span>
              <span>{formatDate(proposal.createdAt)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--crm-text-muted)' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Description */}
          {proposal.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>{proposal.description}</p>
          )}

          {/* Items */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--crm-border)' }}>
            <div className="px-3 py-2 border-b" style={{ background: 'var(--crm-bg)', borderColor: 'var(--crm-border)' }}>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Itens</h4>
            </div>
            {proposal.items.map((item, i) => (
              <div key={item.id || i} className="px-3 py-2.5 flex items-center justify-between border-b last:border-0" style={{ borderColor: 'var(--crm-border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--crm-text)' }}>{item.name}</p>
                  {item.description && <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>{item.description}</p>}
                  {item.quantity > 1 && (
                    <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>{item.quantity}x {formatCurrency(item.unitPrice)}</p>
                  )}
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                  {formatCurrency(item.quantity * item.unitPrice)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="rounded-lg border p-4 space-y-2" style={{ background: 'var(--crm-bg)', borderColor: 'var(--crm-border)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--crm-text-muted)' }}>Subtotal</span>
              <span style={{ color: 'var(--crm-text)' }}>{formatCurrency(subtotal)}</span>
            </div>
            {proposal.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--crm-won)' }}>
                  Desconto {proposal.discountType === 'percent' ? `(${proposal.discount}%)` : ''}
                </span>
                <span style={{ color: 'var(--crm-won)' }}>-{formatCurrency(subtotal - proposal.totalValue)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2" style={{ borderColor: 'var(--crm-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Total</span>
              <span className="text-lg font-bold" style={{ color: 'var(--crm-gold)' }}>{formatCurrency(proposal.totalValue)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>Historico</p>
            <TimelineItem label="Criada" date={proposal.createdAt} />
            {proposal.sentAt && <TimelineItem label="Enviada" date={proposal.sentAt} color="var(--crm-cold)" />}
            {proposal.viewedAt && <TimelineItem label="Visualizada" date={proposal.viewedAt} color="var(--crm-warm)" />}
            {proposal.respondedAt && (
              <TimelineItem
                label={proposal.status === 'ACCEPTED' ? 'Aceita' : 'Recusada'}
                date={proposal.respondedAt}
                color={proposal.status === 'ACCEPTED' ? 'var(--crm-won)' : 'var(--crm-hot)'}
              />
            )}
            {proposal.validUntil && (
              <div className="flex items-center gap-2 text-xs" style={{ color: isExpired ? 'var(--crm-hot)' : 'var(--crm-text-muted)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: isExpired ? 'var(--crm-hot)' : 'var(--crm-text-muted)' }} />
                <span>{isExpired ? 'Expirou em' : 'Valida ate'} {formatDate(proposal.validUntil)}</span>
              </div>
            )}
          </div>

          {/* Public link */}
          <div className="rounded-lg border p-3" style={{ background: 'var(--crm-bg)', borderColor: 'var(--crm-border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>Link publico</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={publicUrl}
                className="flex-1 px-2 py-1.5 rounded border text-xs outline-none"
                style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)', color: 'var(--crm-text-muted)' }}
              />
              <button
                onClick={copyLink}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                style={{
                  background: copied ? 'var(--crm-won)18' : 'transparent',
                  borderColor: copied ? 'var(--crm-won)' : 'var(--crm-border)',
                  color: copied ? 'var(--crm-won)' : 'var(--crm-text-muted)',
                }}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 p-5 border-t flex-wrap" style={{ borderColor: 'var(--crm-border)' }}>
          {canSend && (
            <button
              onClick={() => onSend(proposal.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'var(--crm-won)', color: '#fff' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              Enviar WhatsApp
            </button>
          )}
          <button
            onClick={() => onEdit(proposal)}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all border hover:bg-white/5"
            style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-text-muted)' }}
          >
            Editar
          </button>
          <button
            onClick={() => onDuplicate(proposal.id)}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all border hover:bg-white/5"
            style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-text-muted)' }}
          >
            Duplicar
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onDelete(proposal.id)}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all border hover:bg-white/5"
            style={{ borderColor: 'var(--crm-hot)30', color: 'var(--crm-hot)' }}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Timeline item ── */

function TimelineItem({ label, date, color }: { label: string; date: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color || 'var(--crm-text-muted)' }} />
      <span style={{ color: color || 'var(--crm-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--crm-text-muted)' }}>{formatDateTime(date)}</span>
    </div>
  )
}
