'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
const PAGE_SIZE = 25

interface ContactLead {
  id: string
  name: string
  phone: string
  email: string | null
  status: 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST'
  stageId: string
  stageName: string
  stageColor: string | null
  expectedValue: number | null
  aiScore: number | null
  churnRisk: number | null
  tags: string[]
  source: string | null
  lastInteractionAt: string | null
  createdAt: string
  patientId: string | null
}

interface StageInfo {
  id: string
  name: string
  color: string | null
}

const STATUS_COLORS: Record<string, string> = {
  HOT: '#FF6B4A', WARM: '#F0A500', COLD: '#4A7BFF', WON: '#2ECC8A', LOST: 'var(--crm-text-muted)',
}

const STATUS_LABELS: Record<string, string> = {
  HOT: 'Quente', WARM: 'Morno', COLD: 'Frio', WON: 'Ganho', LOST: 'Perdido',
}

type SortField = 'name' | 'lastInteraction' | 'aiScore' | 'value' | 'status' | 'stage' | 'churn' | 'created'
type SortDir = 'asc' | 'desc'

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Sem interação'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 30) return `Há ${days}d`
  if (days < 365) return `Há ${Math.floor(days / 30)}m`
  return `Há ${Math.floor(days / 365)}a`
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length >= 11) return `(${d.slice(2, 4)}) ${d.slice(4, 5)}****-${d.slice(-4)}`
  return phone
}

// ━━━ Skeleton ━━━
function ContactsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 flex-1 rounded-2xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
      <div className="h-11 rounded-xl animate-pulse mb-4" style={{ background: 'var(--crm-surface)' }} />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
      ))}
    </div>
  )
}

// ━━━ Empty State ━━━
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.1)' }}
      >
        <svg width="32" height="32" fill="none" stroke="var(--crm-gold)" strokeWidth="1.2" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>
        {hasFilters ? 'Nenhum resultado encontrado' : 'Nenhum contato ainda'}
      </p>
      <p className="text-xs mt-1.5 max-w-xs text-center" style={{ color: 'var(--crm-text-muted)' }}>
        {hasFilters ? 'Ajuste os filtros para encontrar contatos' : 'Crie leads no Pipeline para vê-los aqui'}
      </p>
    </div>
  )
}

// ━━━ Sort Header ━━━
function SortHeader({
  label, field, currentSort, currentDir, onSort,
}: {
  label: string; field: SortField; currentSort: SortField; currentDir: SortDir
  onSort: (field: SortField) => void
}) {
  const active = currentSort === field
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium hover:text-white/80 transition-colors"
      style={{ color: active ? '#D4AF37' : 'var(--crm-text-muted)' }}
    >
      {label}
      {active && (
        <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"
          style={{ transform: currentDir === 'desc' ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M7 14l5-5 5 5z" />
        </svg>
      )}
    </button>
  )
}

// ━━━ Lead Detail Drawer ━━━
function LeadDrawer({ lead, stages, onClose, onUpdate }: {
  lead: ContactLead; stages: StageInfo[]; onClose: () => void
  onUpdate: (id: string, updates: Partial<ContactLead>) => void
}) {
  const [editTags, setEditTags] = useState(lead.tags.join(', '))
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const addToast = useToastStore(s => s.addToast)
  const statusColor = STATUS_COLORS[lead.status] ?? 'var(--crm-text-muted)'

  const handleSaveTags = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('admin_token')
      const newTags = editTags.split(',').map(t => t.trim()).filter(Boolean)
      const res = await fetch(`/api/admin/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tags: newTags, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      onUpdate(lead.id, { tags: newTags })
      addToast('Tags atualizadas')
    } catch {
      addToast('Erro ao salvar tags', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed right-0 top-0 h-full w-full sm:w-96 z-50 overflow-y-auto"
        style={{ background: 'var(--crm-surface)', borderLeft: '1px solid var(--crm-border)', boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
          style={{
            background: 'rgba(17,17,20,0.92)',
            borderBottom: '1px solid var(--crm-border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Detalhes do Contato</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--crm-text-muted)' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
              style={{ background: `${statusColor}18`, color: statusColor }}
            >
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>{lead.name}</p>
              <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>{maskPhone(lead.phone)}</p>
              {lead.email && <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>{lead.email}</p>}
            </div>
          </div>

          {/* Status & Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: 'var(--crm-surface-2)' }}>
              <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Status</span>
              <span className="text-sm font-bold" style={{ color: statusColor }}>
                {STATUS_LABELS[lead.status]}
              </span>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--crm-surface-2)' }}>
              <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Etapa</span>
              <span className="text-sm font-medium" style={{ color: lead.stageColor ?? 'var(--crm-text)' }}>
                {lead.stageName}
              </span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3" style={{ background: 'var(--crm-surface-2)' }}>
              <span className="text-[10px] block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Score IA</span>
              <span className="text-lg font-bold" style={{
                color: lead.aiScore != null ? (lead.aiScore >= 70 ? '#2ECC8A' : lead.aiScore >= 40 ? '#F0A500' : '#FF6B4A') : '#5A5A64'
              }}>
                {lead.aiScore ?? '—'}
              </span>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--crm-surface-2)' }}>
              <span className="text-[10px] block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Valor</span>
              <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>
                {lead.expectedValue ? currencyFmt.format(lead.expectedValue) : '—'}
              </span>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--crm-surface-2)' }}>
              <span className="text-[10px] block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Churn</span>
              <span className="text-lg font-bold" style={{
                color: lead.churnRisk != null ? (lead.churnRisk >= 70 ? '#FF6B4A' : lead.churnRisk >= 40 ? '#F0A500' : '#2ECC8A') : '#5A5A64'
              }}>
                {lead.churnRisk != null ? `${lead.churnRisk}%` : '—'}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2 rounded-xl p-3" style={{ background: 'var(--crm-surface-2)' }}>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Fonte</span>
              <span className="text-xs" style={{ color: 'var(--crm-text)' }}>{lead.source ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Criado em</span>
              <span className="text-xs" style={{ color: 'var(--crm-text)' }}>{formatDate(lead.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Última interação</span>
              <span className="text-xs" style={{ color: 'var(--crm-text)' }}>{timeAgo(lead.lastInteractionAt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Paciente</span>
              {lead.patientId ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(46,204,138,0.12)', color: '#2ECC8A' }}
                >Vinculado</span>
              ) : (
                <span className="text-xs" style={{ color: '#5A5A64' }}>Não convertido</span>
              )}
            </div>
          </div>

          {/* Tags (editable) */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium block mb-2" style={{ color: 'var(--crm-text-muted)' }}>
              Tags
            </label>
            <div className="flex gap-2">
              <input
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
                placeholder="botox, vip, retorno..."
                className="flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
              />
              <button
                onClick={handleSaveTags}
                disabled={isSaving}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: '#D4AF37', color: 'var(--crm-bg)' }}
              >
                {isSaving ? '...' : 'Salvar'}
              </button>
            </div>
            {lead.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {lead.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                  >{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium block mb-2" style={{ color: 'var(--crm-text-muted)' }}>
              Anotações
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Adicionar anotação sobre este contato..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-xs resize-none focus:outline-none"
              style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
            />
          </div>

          {/* Move Stage */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium block mb-2" style={{ color: 'var(--crm-text-muted)' }}>
              Mover para etapa
            </label>
            <div className="flex flex-wrap gap-1.5">
              {stages.filter(s => s.id !== lead.stageId).map(stage => (
                <MoveStageButton key={stage.id} lead={lead} stage={stage} onUpdate={onUpdate} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

function MoveStageButton({ lead, stage, onUpdate }: {
  lead: ContactLead; stage: StageInfo; onUpdate: (id: string, updates: Partial<ContactLead>) => void
}) {
  const [isMoving, setIsMoving] = useState(false)
  const addToast = useToastStore(s => s.addToast)

  const handleMove = async () => {
    setIsMoving(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/crm/leads/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId: lead.id, toStageId: stage.id, position: 999, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      onUpdate(lead.id, { stageId: stage.id, stageName: stage.name, stageColor: stage.color })
      addToast(`Movido para ${stage.name}`)
    } catch {
      addToast('Erro ao mover lead', 'error')
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <button
      onClick={handleMove}
      disabled={isMoving}
      className="text-[10px] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
      style={{ background: 'var(--crm-surface-2)', color: stage.color ?? 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
    >
      {isMoving ? '...' : stage.name}
    </button>
  )
}

// ━━━ Bulk Actions Bar ━━━
function BulkActionsBar({ count, onClear, onExport, onTag, stages, onMoveAll }: {
  count: number; onClear: () => void; onExport: () => void
  onTag: (tag: string) => void; stages: StageInfo[]; onMoveAll: (stageId: string) => void
}) {
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagValue, setTagValue] = useState('')
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
      style={{
        background: 'rgba(26,26,31,0.95)',
        border: '1px solid rgba(212,175,55,0.2)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <span className="text-sm font-medium" style={{ color: '#D4AF37' }}>{count} selecionado{count > 1 ? 's' : ''}</span>
      <div className="w-px h-5" style={{ background: 'var(--crm-border)' }} />

      {/* Move */}
      <div className="relative">
        <button
          onClick={() => setShowMoveMenu(p => !p)}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--crm-border)', color: 'var(--crm-text)' }}
        >
          Mover
        </button>
        {showMoveMenu && (
          <div className="absolute bottom-full mb-2 left-0 rounded-xl overflow-hidden shadow-xl"
            style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', minWidth: '140px' }}
          >
            {stages.map(s => (
              <button key={s.id}
                onClick={() => { onMoveAll(s.id); setShowMoveMenu(false) }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                style={{ color: s.color ?? 'var(--crm-text)' }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag */}
      <div className="relative">
        {showTagInput ? (
          <div className="flex items-center gap-1">
            <input
              value={tagValue}
              onChange={e => setTagValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && tagValue.trim()) { onTag(tagValue.trim()); setTagValue(''); setShowTagInput(false) } }}
              placeholder="Tag..."
              autoFocus
              className="w-24 px-2 py-1 rounded text-xs focus:outline-none"
              style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
            />
            <button onClick={() => setShowTagInput(false)} className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTagInput(true)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'var(--crm-border)', color: 'var(--crm-text)' }}
          >
            Tag
          </button>
        )}
      </div>

      {/* Export */}
      <button
        onClick={onExport}
        className="text-xs px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: 'var(--crm-border)', color: 'var(--crm-text)' }}
      >
        Exportar
      </button>

      {/* Clear */}
      <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--crm-text-muted)' }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </motion.div>
  )
}

// ━━━ CSV Export ━━━
function exportCSV(contacts: ContactLead[]) {
  const headers = ['Nome', 'Telefone', 'Email', 'Status', 'Etapa', 'Valor', 'Score IA', 'Tags', 'Fonte', 'Paciente', 'Criado em']
  const rows = contacts.map(c => [
    c.name,
    c.phone,
    c.email ?? '',
    STATUS_LABELS[c.status] ?? c.status,
    c.stageName,
    c.expectedValue?.toString() ?? '',
    c.aiScore?.toString() ?? '',
    c.tags.join('; '),
    c.source ?? '',
    c.patientId ? 'Sim' : 'Não',
    formatDate(c.createdAt),
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contatos-crm-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ━━━ Main Page ━━━
export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactLead[]>([])
  const [stages, setStages] = useState<StageInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [tagFilter, setTagFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('lastInteraction')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerLead, setDrawerLead] = useState<ContactLead | null>(null)
  const addToast = useToastStore(s => s.addToast)

  const fetchContacts = useCallback(async () => {
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
        stageList.push({ id: stage.id, name: stage.name, color: stage.color })
      }
      setStages(stageList)

      const leadsRes = await fetch(`/api/admin/crm/leads?tenantId=${TENANT_ID}&pipelineId=${pipelineData.pipeline.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!leadsRes.ok) throw new Error('Falha ao carregar contatos')
      const leadsData = await leadsRes.json()

      const mapped: ContactLead[] = leadsData.leads.map((lead: ContactLead & { stageId: string }) => ({
        ...lead,
        stageName: stageMap[lead.stageId]?.name ?? 'Desconhecido',
        stageColor: stageMap[lead.stageId]?.color ?? null,
      }))

      setContacts(mapped)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  // All unique tags for filter dropdown
  const allTags = useMemo(() => {
    const set = new Set<string>()
    contacts.forEach(c => c.tags.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [contacts])

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return field
      }
      setSortDir('desc')
      return field
    })
    setPage(1)
  }, [])

  // Filter & Sort
  const hasFilters = searchQuery.trim() !== '' || statusFilter !== 'ALL' || tagFilter !== ''

  const filteredContacts = useMemo(() => {
    let result = contacts

    if (statusFilter !== 'ALL') result = result.filter(c => c.status === statusFilter)
    if (tagFilter) result = result.filter(c => c.tags.some(t => t.toLowerCase() === tagFilter.toLowerCase()))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    const dir = sortDir === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      switch (sortField) {
        case 'name': return dir * a.name.localeCompare(b.name)
        case 'aiScore': return dir * ((a.aiScore ?? -1) - (b.aiScore ?? -1))
        case 'value': return dir * ((a.expectedValue ?? 0) - (b.expectedValue ?? 0))
        case 'status': return dir * a.status.localeCompare(b.status)
        case 'stage': return dir * a.stageName.localeCompare(b.stageName)
        case 'churn': return dir * ((a.churnRisk ?? -1) - (b.churnRisk ?? -1))
        case 'created': return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        case 'lastInteraction':
        default:
          return dir * (
            new Date(a.lastInteractionAt ?? a.createdAt).getTime() -
            new Date(b.lastInteractionAt ?? b.createdAt).getTime()
          )
      }
    })

    return result
  }, [contacts, statusFilter, tagFilter, searchQuery, sortField, sortDir])

  // Pagination
  const totalPages = Math.ceil(filteredContacts.length / PAGE_SIZE)
  const paginatedContacts = useMemo(() =>
    filteredContacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  , [filteredContacts, page])

  // Selection
  const allOnPageSelected = paginatedContacts.length > 0 && paginatedContacts.every(c => selectedIds.has(c.id))
  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        paginatedContacts.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        paginatedContacts.forEach(c => next.add(c.id))
        return next
      })
    }
  }
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Bulk actions
  const handleBulkTag = async (tag: string) => {
    const token = localStorage.getItem('admin_token')
    let success = 0
    for (const id of selectedIds) {
      const contact = contacts.find(c => c.id === id)
      if (!contact) continue
      const newTags = contact.tags.includes(tag) ? contact.tags : [...contact.tags, tag]
      try {
        const res = await fetch(`/api/admin/crm/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tags: newTags, tenantId: TENANT_ID }),
        })
        if (res.ok) {
          setContacts(prev => prev.map(c => c.id === id ? { ...c, tags: newTags } : c))
          success++
        }
      } catch { /* skip */ }
    }
    addToast(`Tag "${tag}" adicionada a ${success} contato${success > 1 ? 's' : ''}`)
    setSelectedIds(new Set())
  }

  const handleBulkMove = async (stageId: string) => {
    const token = localStorage.getItem('admin_token')
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return
    let success = 0
    for (const id of selectedIds) {
      try {
        const res = await fetch('/api/admin/crm/leads/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ leadId: id, toStageId: stageId, position: 999, tenantId: TENANT_ID }),
        })
        if (res.ok) {
          setContacts(prev => prev.map(c => c.id === id ? { ...c, stageId, stageName: stage.name, stageColor: stage.color } : c))
          success++
        }
      } catch { /* skip */ }
    }
    addToast(`${success} contato${success > 1 ? 's' : ''} movido${success > 1 ? 's' : ''} para ${stage.name}`)
    setSelectedIds(new Set())
  }

  const handleBulkExport = () => {
    const selected = contacts.filter(c => selectedIds.has(c.id))
    exportCSV(selected)
    addToast(`${selected.length} contato${selected.length > 1 ? 's' : ''} exportado${selected.length > 1 ? 's' : ''}`)
  }

  const handleUpdateContact = (id: string, updates: Partial<ContactLead>) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    if (drawerLead?.id === id) setDrawerLead(prev => prev ? { ...prev, ...updates } : null)
  }

  // Stats
  const stats = useMemo(() => ({
    total: contacts.length,
    hot: contacts.filter(c => c.status === 'HOT').length,
    warm: contacts.filter(c => c.status === 'WARM').length,
    cold: contacts.filter(c => c.status === 'COLD').length,
    won: contacts.filter(c => c.status === 'WON').length,
    totalValue: contacts.reduce((acc, c) => acc + (c.expectedValue ?? 0), 0),
  }), [contacts])

  if (isLoading) return <ContactsSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm" style={{ color: '#FF6B4A' }}>{error}</p>
        <button onClick={fetchContacts} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
        >Tentar novamente</button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--crm-text)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
              <svg width="16" height="16" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            Contatos
          </h1>
          <p className="text-xs mt-1 ml-[42px]" style={{ color: 'var(--crm-text-muted)' }}>
            {stats.total} contatos · {currencyFmt.format(stats.totalValue)} em pipeline
          </p>
        </div>
        <button
          onClick={() => exportCSV(filteredContacts)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {([
          { label: 'Total', value: stats.total, color: '#D4AF37', icon: '◈' },
          { label: 'Quentes', value: stats.hot, color: '#FF6B4A', icon: '●' },
          { label: 'Mornos', value: stats.warm, color: '#F0A500', icon: '●' },
          { label: 'Frios', value: stats.cold, color: '#4A7BFF', icon: '●' },
          { label: 'Ganhos', value: stats.won, color: '#2ECC8A', icon: '✓' },
        ]).map((stat, i) => (
          <motion.div
            key={stat.label}
            className="rounded-xl p-4 border relative overflow-hidden group"
            style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -1 }}
          >
            <div className="absolute top-3 right-3 text-base opacity-15 transition-opacity group-hover:opacity-25" style={{ color: stat.color }}>{stat.icon}</div>
            <div className="absolute inset-0 opacity-[0.02]" style={{ background: `radial-gradient(circle at 80% 20%, ${stat.color}, transparent 60%)` }} />
            <p className="text-[10px] uppercase tracking-wider font-semibold relative z-10" style={{ color: 'var(--crm-text-muted)' }}>{stat.label}</p>
            <p className="text-2xl font-bold mt-1.5 relative z-10" style={{ color: stat.color }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" width="14" height="14" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="Buscar por nome, telefone, email ou tag..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 transition-all"
            style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setPage(1) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/5 transition-colors"
              style={{ color: 'var(--crm-text-muted)' }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
          style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
        >
          <option value="ALL">Todos os status</option>
          <option value="HOT">Quentes</option>
          <option value="WARM">Mornos</option>
          <option value="COLD">Frios</option>
          <option value="WON">Ganhos</option>
          <option value="LOST">Perdidos</option>
        </select>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={e => { setTagFilter(e.target.value); setPage(1) }}
            className="px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
            style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          >
            <option value="">Todas as tags</option>
            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        )}
        {hasFilters && (
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setTagFilter(''); setPage(1) }}
            className="text-xs px-3.5 py-2.5 rounded-xl font-medium transition-all hover:brightness-110"
            style={{ color: 'var(--crm-gold)', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)' }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Results info */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>
          {filteredContacts.length} {filteredContacts.length === 1 ? 'resultado' : 'resultados'}
          {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
        </p>
      </div>

      {/* Table */}
      {filteredContacts.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--crm-border)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
          {/* Desktop header */}
          <div className="hidden lg:grid grid-cols-[40px_1fr_120px_90px_90px_80px_70px_70px_90px] gap-2 px-4 py-3 items-center"
            style={{ background: 'var(--crm-surface)', borderBottom: '1px solid var(--crm-border)' }}
          >
            <label className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleAll}
                className="w-3.5 h-3.5 rounded accent-amber-600"
              />
            </label>
            <SortHeader label="Contato" field="name" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Etapa" field="stage" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Status" field="status" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Valor" field="value" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Score" field="aiScore" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Churn" field="churn" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Paciente</span>
            <SortHeader label="Interação" field="lastInteraction" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
          </div>

          <AnimatePresence>
            {paginatedContacts.map((contact, i) => {
              const statusColor = STATUS_COLORS[contact.status] ?? 'var(--crm-text-muted)'
              const churnColor = contact.churnRisk != null
                ? contact.churnRisk >= 70 ? '#FF6B4A' : contact.churnRisk >= 40 ? '#F0A500' : '#2ECC8A'
                : '#5A5A64'
              const isSelected = selectedIds.has(contact.id)

              return (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.015 }}
                  onClick={() => setDrawerLead(contact)}
                  className="grid grid-cols-1 lg:grid-cols-[40px_1fr_120px_90px_90px_80px_70px_70px_90px] gap-2 px-4 py-3 items-center transition-colors cursor-pointer"
                  style={{
                    borderBottom: '1px solid var(--crm-surface-2)',
                    background: isSelected ? 'rgba(212,175,55,0.04)' : 'transparent',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(212,175,55,0.04)' : 'transparent' }}
                >
                  {/* Checkbox */}
                  <label className="hidden lg:flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(contact.id)}
                      className="w-3.5 h-3.5 rounded accent-amber-600"
                    />
                  </label>

                  {/* Contact info */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                      style={{ background: statusColor + '18', color: statusColor }}
                    >
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--crm-text)' }}>{contact.name}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--crm-text-muted)' }}>
                        {maskPhone(contact.phone)}
                        {contact.email && ` · ${contact.email}`}
                      </p>
                      {contact.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {contact.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(212,175,55,0.08)', color: '#D4AF37' }}
                            >{tag}</span>
                          ))}
                          {contact.tags.length > 3 && (
                            <span className="text-[9px] py-0.5" style={{ color: '#5A5A64' }}>+{contact.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stage */}
                  <div className="hidden lg:block">
                    <span className="text-xs" style={{ color: contact.stageColor ?? 'var(--crm-text)' }}>{contact.stageName}</span>
                  </div>

                  {/* Status */}
                  <div className="hidden lg:block">
                    <span className="text-[10px] font-bold px-2 py-1 rounded inline-block"
                      style={{ background: statusColor + '18', color: statusColor }}
                    >
                      {STATUS_LABELS[contact.status]}
                    </span>
                  </div>

                  {/* Value */}
                  <div className="hidden lg:block">
                    <span className="text-xs font-medium" style={{ color: contact.expectedValue ? '#D4AF37' : '#5A5A64' }}>
                      {contact.expectedValue ? currencyFmt.format(contact.expectedValue) : '—'}
                    </span>
                  </div>

                  {/* AI Score */}
                  <div className="hidden lg:block">
                    {contact.aiScore != null ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--crm-surface-2)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${contact.aiScore}%`,
                            background: contact.aiScore >= 70 ? '#2ECC8A' : contact.aiScore >= 40 ? '#F0A500' : '#4A7BFF',
                          }} />
                        </div>
                        <span className="text-[10px] font-bold w-7 text-right" style={{ color: 'var(--crm-text)' }}>
                          {contact.aiScore}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px]" style={{ color: '#5A5A64' }}>—</span>
                    )}
                  </div>

                  {/* Churn */}
                  <div className="hidden lg:block">
                    {contact.churnRisk != null ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: churnColor + '18', color: churnColor }}
                      >
                        {contact.churnRisk}%
                      </span>
                    ) : (
                      <span className="text-[10px]" style={{ color: '#5A5A64' }}>—</span>
                    )}
                  </div>

                  {/* Paciente */}
                  <div className="hidden lg:flex items-center justify-center">
                    {contact.patientId ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(46,204,138,0.12)', color: '#2ECC8A' }}
                      >Sim</span>
                    ) : (
                      <span className="text-[10px]" style={{ color: '#5A5A64' }}>—</span>
                    )}
                  </div>

                  {/* Last interaction */}
                  <div className="hidden lg:block">
                    <span className="text-[11px]" style={{ color: 'var(--crm-text-muted)' }}>
                      {timeAgo(contact.lastInteractionAt)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          >
            Anterior
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number
            if (totalPages <= 7) {
              pageNum = i + 1
            } else if (page <= 4) {
              pageNum = i + 1
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i
            } else {
              pageNum = page - 3 + i
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: pageNum === page ? '#D4AF37' : 'var(--crm-surface-2)',
                  color: pageNum === page ? 'var(--crm-bg)' : 'var(--crm-text)',
                  border: pageNum === page ? 'none' : '1px solid var(--crm-border)',
                }}
              >
                {pageNum}
              </button>
            )
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          >
            Próxima
          </button>
        </div>
      )}

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <BulkActionsBar
            count={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onExport={handleBulkExport}
            onTag={handleBulkTag}
            stages={stages}
            onMoveAll={handleBulkMove}
          />
        )}
      </AnimatePresence>

      {/* Lead Drawer */}
      <AnimatePresence>
        {drawerLead && (
          <LeadDrawer
            lead={drawerLead}
            stages={stages}
            onClose={() => setDrawerLead(null)}
            onUpdate={handleUpdateContact}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
