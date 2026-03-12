'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// ━━━ Types ━━━

interface CrmTemplate {
  id: string
  name: string
  type: string
  category: string
  content: string
  variables: string[]
}

interface Stage {
  id: string
  name: string
  type: string
}

interface Broadcast {
  id: string
  name: string
  templateId: string | null
  message: string
  filters: Record<string, unknown> | null
  totalRecipients: number
  sent: number
  delivered: number
  read: number
  failed: number
  status: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  recipients?: BroadcastRecipient[]
}

interface BroadcastRecipient {
  id: string
  leadId: string
  leadName: string
  phone: string
  status: string
  sentAt: string | null
  errorMessage: string | null
}

// ━━━ Helpers ━━━

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SENDING: 'Enviando',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  FAILED: 'Falhou',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#8B8A94',
  SENDING: '#F0A500',
  COMPLETED: '#2ECC8A',
  CANCELLED: '#FF6B4A',
  FAILED: '#FF4444',
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  HOT: 'Quente',
  WARM: 'Morno',
  COLD: 'Frio',
  WON: 'Ganho',
  LOST: 'Perdido',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem('admin_token')
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Erro ${res.status}` }))
    throw new Error(body.error || `Erro ${res.status}`)
  }
  return res.json()
}

function applyPreviewVars(content: string) {
  return content
    .replace(/\{\{nome\}\}/g, 'Maria Silva')
    .replace(/\{\{primeiro_nome\}\}/g, 'Maria')
    .replace(/\{\{telefone\}\}/g, '(11) 99999-1234')
    .replace(/\{\{email\}\}/g, 'maria@email.com')
    .replace(/\{\{estagio\}\}/g, 'Primeiro Contato')
    .replace(/\{\{pipeline\}\}/g, 'Pipeline Principal')
    .replace(/\{\{valor\}\}/g, 'R$ 2.500,00')
}

// ━━━ Main Component ━━━

export default function BroadcastPage() {
  const [view, setView] = useState<'list' | 'create'>('list')
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [templates, setTemplates] = useState<CrmTemplate[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [detailBroadcast, setDetailBroadcast] = useState<Broadcast | null>(null)

  const fetchBroadcasts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch(`/api/admin/crm/broadcasts?tenantId=${TENANT_ID}`)
      setBroadcasts(data.broadcasts || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/admin/crm/templates?tenantId=${TENANT_ID}&type=whatsapp`)
      setTemplates(data.templates || [])
    } catch {
      // silent
    }
  }, [])

  const fetchStages = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/admin/crm/stages?tenantId=${TENANT_ID}`)
      if (data.stages) setStages(data.stages)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchBroadcasts()
    fetchTemplates()
    fetchStages()
  }, [fetchBroadcasts, fetchTemplates, fetchStages])

  // Poll for sending broadcasts
  useEffect(() => {
    const sending = broadcasts.some(b => b.status === 'SENDING')
    if (!sending) return
    const interval = setInterval(fetchBroadcasts, 5000)
    return () => clearInterval(interval)
  }, [broadcasts, fetchBroadcasts])

  const handleCreated = () => {
    setView('list')
    fetchBroadcasts()
  }

  const openDetail = async (b: Broadcast) => {
    try {
      const data = await apiFetch(`/api/admin/crm/broadcasts/${b.id}?tenantId=${TENANT_ID}`)
      setDetailBroadcast(data.broadcast)
    } catch {
      setDetailBroadcast(b)
    }
  }

  const handleSend = async (id: string) => {
    try {
      await apiFetch(`/api/admin/crm/broadcasts/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'send' }),
      })
      fetchBroadcasts()
      setDetailBroadcast(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao iniciar envio')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await apiFetch(`/api/admin/crm/broadcasts/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel' }),
      })
      fetchBroadcasts()
      setDetailBroadcast(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transmissão?')) return
    try {
      await apiFetch(`/api/admin/crm/broadcasts/${id}`, { method: 'DELETE' })
      fetchBroadcasts()
      setDetailBroadcast(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2.5" style={{ color: 'var(--crm-text)' }}>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--crm-gold-subtle)' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-gold)' }}>
                <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </span>
            Transmissão em Massa
          </h1>
          <p className="text-xs mt-0.5 ml-[42px]" style={{ color: 'var(--crm-text-muted)' }}>Envie mensagens via WhatsApp para múltiplos leads</p>
        </div>

        <button
          onClick={() => setView(view === 'list' ? 'create' : 'list')}
          className="px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
          style={{
            background: view === 'list' ? 'var(--crm-gold)' : 'var(--crm-surface-2)',
            color: view === 'list' ? '#0A0A0B' : 'var(--crm-text-muted)',
            border: view === 'list' ? 'none' : '1px solid var(--crm-border)',
          }}
        >
          {view === 'list' ? (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Nova Transmissão
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              Voltar ao Histórico
            </>
          )}
        </button>
      </div>

      {view === 'list' ? (
        <BroadcastList
          broadcasts={broadcasts}
          loading={loading}
          onDetail={openDetail}
          onSend={handleSend}
          onDelete={handleDelete}
        />
      ) : (
        <CreateBroadcast
          templates={templates}
          stages={stages}
          onCreated={handleCreated}
          onCancel={() => setView('list')}
        />
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {detailBroadcast && (
          <BroadcastDetailModal
            broadcast={detailBroadcast}
            onClose={() => setDetailBroadcast(null)}
            onSend={handleSend}
            onCancel={handleCancel}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ━━━ Broadcast List ━━━

function BroadcastList({
  broadcasts, loading, onDetail, onSend, onDelete,
}: {
  broadcasts: Broadcast[]
  loading: boolean
  onDetail: (b: Broadcast) => void
  onSend: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (loading) return <BroadcastSkeleton />

  if (broadcasts.length === 0) {
    return (
      <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--crm-gold-subtle)' }}>
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-gold)' }}>
            <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--crm-text)' }}>Nenhuma transmissão ainda</h3>
        <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Crie sua primeira transmissão para enviar mensagens em massa via WhatsApp</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {broadcasts.map((b, i) => (
        <motion.div
          key={b.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onDetail(b)}
          className="rounded-xl border p-4 cursor-pointer transition-all hover:border-[var(--crm-gold)]/30"
          style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm font-medium truncate" style={{ color: 'var(--crm-text)' }}>{b.name}</h3>
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0"
                  style={{
                    background: `${STATUS_COLORS[b.status] || '#8B8A94'}15`,
                    color: STATUS_COLORS[b.status] || '#8B8A94',
                  }}
                >
                  {STATUS_LABELS[b.status] || b.status}
                </span>
              </div>

              <p className="text-[11px] truncate mb-2" style={{ color: 'var(--crm-text-muted)' }}>
                {b.message.slice(0, 100)}{b.message.length > 100 ? '...' : ''}
              </p>

              <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  {b.totalRecipients} destinatários
                </span>
                {b.sent > 0 && (
                  <span className="flex items-center gap-1" style={{ color: '#2ECC8A' }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    {b.sent} enviados
                  </span>
                )}
                {b.failed > 0 && (
                  <span className="flex items-center gap-1" style={{ color: '#FF6B4A' }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    {b.failed} falhos
                  </span>
                )}
                <span>{timeAgo(b.createdAt)}</span>
              </div>
            </div>

            {/* Progress bar for sending */}
            {b.status === 'SENDING' && (
              <div className="w-20 flex flex-col items-end gap-1">
                <span className="text-[10px] font-mono" style={{ color: 'var(--crm-gold)' }}>
                  {b.totalRecipients > 0 ? Math.round((b.sent + b.failed) / b.totalRecipients * 100) : 0}%
                </span>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--crm-surface-2)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${b.totalRecipients > 0 ? ((b.sent + b.failed) / b.totalRecipients * 100) : 0}%`,
                      background: 'var(--crm-gold)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {b.status === 'DRAFT' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSend(b.id) }}
                  className="p-1.5 rounded-lg transition-all hover:scale-105"
                  style={{ background: '#2ECC8A20', color: '#2ECC8A' }}
                  title="Enviar"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </button>
              )}
              {b.status !== 'SENDING' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(b.id) }}
                  className="p-1.5 rounded-lg transition-all hover:scale-105"
                  style={{ background: '#FF6B4A15', color: '#FF6B4A' }}
                  title="Excluir"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ━━━ Create Broadcast ━━━

function CreateBroadcast({
  templates, stages, onCreated, onCancel,
}: {
  templates: CrmTemplate[]
  stages: Stage[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterStage, setFilterStage] = useState<string>('')
  const [filterTags, setFilterTags] = useState('')
  const [filterMinScore, setFilterMinScore] = useState<string>('')
  const [showPreview, setShowPreview] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)

  // Use template content
  const selectTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id)
    if (tpl) {
      setSelectedTemplate(id)
      setMessage(tpl.content)
      if (!name) setName(`Transmissão — ${tpl.name}`)
    }
  }

  // Preview count with current filters
  const buildFilters = useCallback(() => {
    const filters: Record<string, unknown> = {}
    if (filterStatus) filters.status = filterStatus
    if (filterStage) filters.stageId = filterStage
    if (filterTags.trim()) filters.tags = filterTags.split(',').map(t => t.trim()).filter(Boolean)
    if (filterMinScore) filters.minScore = Number(filterMinScore)
    return Object.keys(filters).length > 0 ? filters : null
  }, [filterStatus, filterStage, filterTags, filterMinScore])

  const fetchPreviewCount = useCallback(async () => {
    try {
      setLoadingCount(true)
      const filters = buildFilters()
      const params = new URLSearchParams({ tenantId: TENANT_ID, countOnly: 'true' })
      if (filters?.status) params.set('filterStatus', filters.status as string)
      if (filters?.stageId) params.set('filterStageId', filters.stageId as string)
      if (filters?.tags) params.set('filterTags', (filters.tags as string[]).join(','))
      if (filters?.minScore) params.set('filterMinScore', String(filters.minScore))

      const data = await apiFetch(`/api/admin/crm/broadcasts?${params.toString()}`)
      setPreviewCount(data.count ?? 0)
    } catch {
      setPreviewCount(null)
    } finally {
      setLoadingCount(false)
    }
  }, [buildFilters])

  useEffect(() => {
    const timer = setTimeout(fetchPreviewCount, 500)
    return () => clearTimeout(timer)
  }, [fetchPreviewCount])

  const handleCreate = async () => {
    if (!name.trim() || !message.trim()) {
      setError('Preencha o nome e a mensagem')
      return
    }

    setCreating(true)
    setError(null)

    try {
      await apiFetch('/api/admin/crm/broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: TENANT_ID,
          name: name.trim(),
          message,
          templateId: selectedTemplate,
          filters: buildFilters(),
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar transmissão')
    } finally {
      setCreating(false)
    }
  }

  const VARIABLES = [
    { key: '{{nome}}', label: 'Nome' },
    { key: '{{primeiro_nome}}', label: 'Primeiro Nome' },
    { key: '{{telefone}}', label: 'Telefone' },
    { key: '{{email}}', label: 'Email' },
    { key: '{{estagio}}', label: 'Estágio' },
    { key: '{{valor}}', label: 'Valor' },
  ]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* Left: Template + Message */}
      <div className="xl:col-span-2 space-y-4">
        {/* Name */}
        <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>
            Nome da transmissão
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Promoção de Março, Follow-up Leads Quentes..."
            className="w-full px-3.5 py-2.5 rounded-lg text-xs transition-all focus:outline-none"
            style={{
              background: 'var(--crm-surface-2)',
              border: '1px solid var(--crm-border)',
              color: 'var(--crm-text)',
            }}
          />
        </div>

        {/* Templates */}
        {templates.length > 0 && (
          <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--crm-text-muted)' }}>
              Usar modelo (opcional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] transition-all"
                  style={{
                    background: selectedTemplate === t.id ? 'var(--crm-gold-subtle)' : 'var(--crm-surface-2)',
                    color: selectedTemplate === t.id ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                    border: `1px solid ${selectedTemplate === t.id ? 'var(--crm-gold)' : 'var(--crm-border)'}`,
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Composer */}
        <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>
              Mensagem
            </label>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-[10px] flex items-center gap-1 transition-colors"
              style={{ color: showPreview ? 'var(--crm-gold)' : 'var(--crm-text-muted)' }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              {showPreview ? 'Editar' : 'Preview'}
            </button>
          </div>

          {/* Variable buttons */}
          <div className="flex flex-wrap gap-1.5 mb-3 p-2.5 rounded-lg" style={{ background: 'var(--crm-gold-subtle)' }}>
            <span className="text-[9px] font-medium mr-1" style={{ color: 'var(--crm-gold)' }}>Variáveis:</span>
            {VARIABLES.map(v => (
              <button
                key={v.key}
                onClick={() => setMessage(prev => prev + v.key)}
                className="px-2 py-0.5 rounded text-[9px] font-mono transition-all"
                style={{
                  background: 'var(--crm-gold-subtle)',
                  color: 'var(--crm-gold)',
                  border: '1px solid rgba(212,175,55,0.2)',
                }}
              >
                {v.key}
              </button>
            ))}
          </div>

          {showPreview ? (
            <div className="rounded-lg p-4" style={{ background: '#005c4b', minHeight: '140px' }}>
              <p className="text-white text-xs leading-relaxed whitespace-pre-wrap">
                {applyPreviewVars(message) || 'Nenhuma mensagem para visualizar'}
              </p>
              <p className="text-right text-white/40 text-[9px] mt-2">Agora ✓✓</p>
            </div>
          ) : (
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={7}
              placeholder="Digite sua mensagem personalizada aqui...&#10;&#10;Use {{nome}} para inserir o nome do lead automaticamente!"
              className="w-full px-3.5 py-2.5 rounded-lg text-xs resize-none transition-all focus:outline-none leading-relaxed"
              style={{
                background: 'var(--crm-surface-2)',
                border: '1px solid var(--crm-border)',
                color: 'var(--crm-text)',
              }}
            />
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>{message.length} caracteres</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: '#FF6B4A15', color: '#FF6B4A', border: '1px solid #FF6B4A30' }}>
            {error}
          </div>
        )}
      </div>

      {/* Right: Filters + Actions */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--crm-text-muted)' }}>
            Filtros de Destinatários
          </label>

          <div className="space-y-3">
            {/* Status filter */}
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Status do Lead</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
              >
                <option value="">Todos os status</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Stage filter */}
            {stages.length > 0 && (
              <div>
                <label className="block text-[10px] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Estágio do Pipeline</label>
                <select
                  value={filterStage}
                  onChange={e => setFilterStage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
                >
                  <option value="">Todos os estágios</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tags filter */}
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Tags (separadas por vírgula)</label>
              <input
                type="text"
                value={filterTags}
                onChange={e => setFilterTags(e.target.value)}
                placeholder="vip, botox, retorno..."
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
              />
            </div>

            {/* Min Score filter */}
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--crm-text-muted)' }}>Score mínimo</label>
              <input
                type="number"
                min={0}
                max={100}
                value={filterMinScore}
                onChange={e => setFilterMinScore(e.target.value)}
                placeholder="0 - 100"
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
              />
            </div>
          </div>
        </div>

        {/* Recipients Preview */}
        <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>
            Destinatários Estimados
          </label>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--crm-gold-subtle)' }}>
              {loadingCount ? (
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--crm-gold)', borderTopColor: 'transparent' }} />
              ) : (
                <span className="text-lg font-bold" style={{ color: 'var(--crm-gold)' }}>{previewCount ?? '—'}</span>
              )}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--crm-text)' }}>
                {previewCount !== null ? `${previewCount} lead${previewCount !== 1 ? 's' : ''} com telefone` : 'Calculando...'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                Intervalo de ~3s entre envios
              </p>
            </div>
          </div>
          {previewCount !== null && previewCount > 0 && (
            <p className="text-[10px] mt-2" style={{ color: 'var(--crm-text-muted)' }}>
              Tempo estimado: ~{Math.ceil(previewCount * 3 / 60)} min
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !message.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--crm-gold), #C4A030)',
              color: '#0A0A0B',
            }}
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                Criar Transmissão
              </>
            )}
          </button>

          <p className="text-[10px] text-center" style={{ color: 'var(--crm-text-muted)' }}>
            A transmissão será salva como rascunho. Você poderá revisar antes de enviar.
          </p>

          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl text-xs transition-all"
            style={{ border: '1px solid var(--crm-border)', color: 'var(--crm-text-muted)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ━━━ Detail Modal ━━━

function BroadcastDetailModal({
  broadcast, onClose, onSend, onCancel, onDelete,
}: {
  broadcast: Broadcast
  onClose: () => void
  onSend: (id: string) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
}) {
  const progress = broadcast.totalRecipients > 0
    ? Math.round((broadcast.sent + broadcast.failed) / broadcast.totalRecipients * 100)
    : 0

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl border overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>{broadcast.name}</h3>
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-medium"
              style={{
                background: `${STATUS_COLORS[broadcast.status]}15`,
                color: STATUS_COLORS[broadcast.status],
              }}
            >
              {STATUS_LABELS[broadcast.status]}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--crm-text-muted)' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: broadcast.totalRecipients, color: 'var(--crm-text)' },
              { label: 'Enviados', value: broadcast.sent, color: '#2ECC8A' },
              { label: 'Falhos', value: broadcast.failed, color: '#FF6B4A' },
              { label: 'Pendentes', value: broadcast.totalRecipients - broadcast.sent - broadcast.failed, color: 'var(--crm-text-muted)' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-2.5 text-center" style={{ background: 'var(--crm-surface-2)' }}>
                <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {(broadcast.status === 'SENDING' || broadcast.status === 'COMPLETED') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Progresso</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--crm-gold)' }}>{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--crm-surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: broadcast.status === 'COMPLETED' ? '#2ECC8A' : 'var(--crm-gold)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Message preview */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
              Mensagem
            </label>
            <div className="rounded-lg p-3" style={{ background: '#005c4b' }}>
              <p className="text-white text-xs leading-relaxed whitespace-pre-wrap">{applyPreviewVars(broadcast.message)}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
            <div>
              <span className="block font-semibold uppercase tracking-wider mb-0.5">Criada em</span>
              {formatDate(broadcast.createdAt)}
            </div>
            {broadcast.startedAt && (
              <div>
                <span className="block font-semibold uppercase tracking-wider mb-0.5">Iniciada em</span>
                {formatDate(broadcast.startedAt)}
              </div>
            )}
            {broadcast.completedAt && (
              <div>
                <span className="block font-semibold uppercase tracking-wider mb-0.5">Concluída em</span>
                {formatDate(broadcast.completedAt)}
              </div>
            )}
          </div>

          {/* Recipients list */}
          {broadcast.recipients && broadcast.recipients.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                Destinatários ({broadcast.recipients.length})
              </label>
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--crm-border)' }}>
                <div className="max-h-[200px] overflow-y-auto">
                  {broadcast.recipients.map(r => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between px-3 py-2 border-b last:border-0"
                      style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface-2)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}>
                          {r.leadName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] truncate" style={{ color: 'var(--crm-text)' }}>{r.leadName}</p>
                          <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>{r.phone}</p>
                        </div>
                      </div>
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0"
                        style={{
                          background: r.status === 'SENT' ? '#2ECC8A15' : r.status === 'FAILED' ? '#FF6B4A15' : 'var(--crm-surface)',
                          color: r.status === 'SENT' ? '#2ECC8A' : r.status === 'FAILED' ? '#FF6B4A' : 'var(--crm-text-muted)',
                        }}
                      >
                        {r.status === 'SENT' ? 'Enviado' : r.status === 'FAILED' ? 'Falhou' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--crm-border)' }}>
          {broadcast.status === 'DRAFT' && (
            <>
              <button
                onClick={() => onDelete(broadcast.id)}
                className="px-3 py-2 rounded-lg text-xs transition-all"
                style={{ color: '#FF6B4A', border: '1px solid #FF6B4A30' }}
              >
                Excluir
              </button>
              <button
                onClick={() => onSend(broadcast.id)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                style={{ background: '#2ECC8A', color: '#0A0A0B' }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                Enviar Agora
              </button>
            </>
          )}
          {broadcast.status === 'SENDING' && (
            <button
              onClick={() => onCancel(broadcast.id)}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ color: '#FF6B4A', border: '1px solid #FF6B4A30', background: '#FF6B4A10' }}
            >
              Cancelar Envio
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ━━━ Skeleton ━━━

function BroadcastSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 rounded w-1/3" style={{ background: 'var(--crm-surface-2)' }} />
              <div className="h-3 rounded w-2/3" style={{ background: 'var(--crm-surface-2)' }} />
              <div className="h-2.5 rounded w-1/2" style={{ background: 'var(--crm-surface-2)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
