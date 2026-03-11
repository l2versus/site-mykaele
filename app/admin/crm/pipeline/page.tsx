'use client'

import { useEffect, useState, useCallback, useOptimistic, startTransition } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { motion, AnimatePresence } from 'framer-motion'
import { useCrmStore } from '@/stores/crm-store'
import { useCrmStream } from '@/hooks/use-crm-stream'
import { calcPosition } from '@/lib/fractional-index'
import { cardDragVariants, siblingCardVariants, columnVariants, modalOverlayVariants, modalContentVariants } from '@/lib/crm-animations'
import { playFeedback } from '@/lib/crm-feedback'

// Tenant fixo por enquanto (V1 single-tenant)
const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

interface LeadCard {
  id: string
  name: string
  phone: string
  email: string | null
  status: 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST'
  stageId: string
  position: number
  expectedValue: number | null
  aiScore: number | null
  aiScoreLabel: string | null
  churnRisk: number | null
  bestContactDays: string | null
  bestContactHours: string | null
  bestContactBasis: number | null
  tags: string[]
  source: string | null
  lastInteractionAt: string | null
  createdAt: string
}

interface StageData {
  id: string
  name: string
  type: 'OPEN' | 'WON' | 'LOST'
  order: number
  color: string | null
  cachedLeadCount: number
  cachedTotalValue: number
}

const STATUS_COLORS: Record<string, string> = {
  HOT: '#FF6B4A',
  WARM: '#F0A500',
  COLD: '#4A7BFF',
  WON: '#2ECC8A',
  LOST: '#8B8A94',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Sem interação'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 30) return `Há ${days}d`
  if (days < 365) return `Há ${Math.floor(days / 30)}m`
  return `Há ${Math.floor(days / 365)}a`
}

// ━━━ Skeleton Loading ━━━
function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[300px] rounded-xl p-3" style={{ background: '#111114' }}>
          <div className="h-6 w-32 rounded-md mb-4 animate-pulse" style={{ background: '#1A1A1F' }} />
          {Array.from({ length: 3 - i % 2 }).map((_, j) => (
            <div key={j} className="h-32 rounded-lg mb-3 animate-pulse" style={{ background: '#1A1A1F' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ━━━ New Lead Modal ━━━
function NewLeadModal({ stages, onClose, onSave }: {
  stages: StageData[]
  onClose: () => void
  onSave: (data: { name: string; phone: string; email: string; stageId: string; expectedValue: string; source: string; tags: string }) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [stageId, setStageId] = useState(stages.find(s => s.type === 'OPEN')?.id ?? '')
  const [expectedValue, setExpectedValue] = useState('')
  const [source, setSource] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setSaving(true)
    onSave({ name, phone, email, stageId, expectedValue, source, tags })
  }

  const inputClass = "w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none"

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        variants={modalOverlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-md rounded-2xl border p-6"
          style={{ background: '#111114', borderColor: '#2A2A32' }}
          variants={modalContentVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#F0EDE8' }}>Novo Lead</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Nome *</label>
              <input
                value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do contato"
                className={inputClass} style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Telefone *</label>
              <input
                value={phone} onChange={e => setPhone(e.target.value)} required placeholder="5511999999999"
                className={inputClass} style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Email</label>
              <input
                value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email"
                className={inputClass} style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Estágio</label>
                <select
                  value={stageId} onChange={e => setStageId(e.target.value)}
                  className={inputClass} style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
                >
                  {stages.filter(s => s.type === 'OPEN').map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Valor esperado</label>
                <input
                  value={expectedValue} onChange={e => setExpectedValue(e.target.value)} placeholder="R$ 0"
                  className={inputClass} style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Fonte</label>
                <input
                  value={source} onChange={e => setSource(e.target.value)} placeholder="Instagram, WhatsApp..."
                  className={inputClass} style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Tags</label>
                <input
                  value={tags} onChange={e => setTags(e.target.value)} placeholder="botox, vip"
                  className={inputClass} style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: '#1A1A1F', color: '#8B8A94', border: '1px solid #2A2A32' }}
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={saving || !name.trim() || !phone.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: '#D4AF37', color: '#0A0A0B' }}
              >
                {saving ? 'Salvando...' : 'Criar Lead'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ━━━ Lead Card ━━━
function LeadCardComponent({ lead, index, isDraggingAny }: { lead: LeadCard; index: number; isDraggingAny: boolean }) {
  const statusColor = STATUS_COLORS[lead.status] ?? '#8B8A94'

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2"
          style={provided.draggableProps.style}
        >
        <motion.div
          variants={isDraggingAny && !snapshot.isDragging ? siblingCardVariants : cardDragVariants}
          animate={
            snapshot.isDragging ? 'dragging' :
            isDraggingAny ? 'dimmed' :
            'idle'
          }
          className="rounded-xl border p-3 cursor-grab active:cursor-grabbing"
          style={{
            background: '#111114',
            borderColor: snapshot.isDragging ? '#D4AF37' : '#2A2A32',
          }}
        >
          {/* Header: Status badge + Nome */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: statusColor }}
            />
            <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>
              {lead.name}
            </span>
            <span
              className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: statusColor + '20', color: statusColor }}
            >
              {lead.status}
            </span>
          </div>

          {/* Tags */}
          {lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {lead.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}
                >
                  {tag}
                </span>
              ))}
              {lead.tags.length > 3 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ color: '#8B8A94' }}
                >
                  +{lead.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Valor + Score */}
          <div className="flex items-center gap-3 mb-2">
            {lead.expectedValue != null && lead.expectedValue > 0 && (
              <span className="text-xs font-semibold" style={{ color: '#D4AF37' }}>
                {formatCurrency(lead.expectedValue)}
              </span>
            )}
            {lead.aiScore != null && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}
              >
                ★ {lead.aiScore}
              </span>
            )}
          </div>

          {/* Janela de Ouro */}
          {lead.bestContactDays && lead.bestContactHours && (
            <div className="text-[10px] mb-2 px-2 py-1 rounded"
              style={{ background: 'rgba(212,175,55,0.06)', color: '#D4AF37' }}
            >
              <span className="opacity-70">⏰ Janela: </span>
              {lead.bestContactDays} · {lead.bestContactHours}
              {lead.bestContactBasis != null && lead.bestContactBasis > 0 && (
                <span className="opacity-50"> · {lead.bestContactBasis} conversões</span>
              )}
            </div>
          )}

          {/* Footer: Tempo + Fonte */}
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: '#8B8A94' }}>
              {timeAgo(lead.lastInteractionAt)}
            </span>
            {lead.source && (
              <span className="text-[10px]" style={{ color: '#8B8A94' }}>
                {lead.source}
              </span>
            )}
          </div>
        </motion.div>
        </div>
      )}
    </Draggable>
  )
}

// ━━━ Stage Column ━━━
function StageColumn({ stage, leads, index, isDraggingAny }: {
  stage: StageData; leads: LeadCard[]; index: number; isDraggingAny: boolean
}) {
  const stageColor = stage.color ?? '#8B8A94'

  return (
    <motion.div
      className="flex-shrink-0 w-[300px] rounded-xl flex flex-col max-h-[calc(100vh-14rem)]"
      style={{ background: '#111114', border: '1px solid #2A2A32' }}
      variants={columnVariants}
      initial="hidden"
      animate="visible"
      custom={index}
    >
      {/* Column Header */}
      <div className="px-3 py-3 border-b" style={{ borderColor: '#2A2A32' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: stageColor }} />
          <span className="text-sm font-semibold" style={{ color: '#F0EDE8' }}>{stage.name}</span>
          <span className="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: '#1A1A1F', color: '#8B8A94' }}
          >
            {stage.cachedLeadCount}
          </span>
        </div>
        {stage.cachedTotalValue > 0 && (
          <span className="text-[11px] font-medium" style={{ color: '#D4AF37' }}>
            {formatCurrency(stage.cachedTotalValue)}
          </span>
        )}
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 overflow-y-auto p-2 transition-colors"
            style={{
              background: snapshot.isDraggingOver ? 'rgba(212,175,55,0.04)' : 'transparent',
              minHeight: 60,
            }}
          >
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center py-8">
                <span className="text-[11px]" style={{ color: '#8B8A94', opacity: 0.4 }}>Sem leads neste estágio</span>
              </div>
            )}
            {leads.map((lead, i) => (
              <LeadCardComponent key={lead.id} lead={lead} index={i} isDraggingAny={isDraggingAny} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </motion.div>
  )
}

// ━━━ Main Pipeline Page ━━━
export default function PipelinePage() {
  const {
    pipeline, stages, leadsByStage, isLoading,
    setPipeline, setStages, setLeadsByStage, setLoading,
    moveLeadOptimistic, addLeadOptimistic,
  } = useCrmStore()

  const [isDragging, setIsDragging] = useState(false)
  const [showNewLead, setShowNewLead] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Optimistic state for drag
  const [optimisticStages, setOptimisticStages] = useOptimistic(stages)

  // Fetch pipeline data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('admin_token')

      // Query 1: Pipeline + Stages (sem leads — anti N+1)
      const pipelineRes = await fetch(`/api/admin/crm/pipeline?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!pipelineRes.ok) throw new Error('Falha ao carregar pipeline')
      const pipelineData = await pipelineRes.json()

      setPipeline(pipelineData.pipeline)
      setStages(pipelineData.stages)

      // Query 2: Leads agrupados por estágio
      const leadsRes = await fetch(`/api/admin/crm/leads?tenantId=${TENANT_ID}&pipelineId=${pipelineData.pipeline.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!leadsRes.ok) throw new Error('Falha ao carregar leads')
      const leadsData = await leadsRes.json()

      // Agrupar leads por estágio em TypeScript (anti-N+1)
      const grouped: Record<string, LeadCard[]> = {}
      for (const stage of pipelineData.stages) {
        grouped[stage.id] = []
      }
      for (const lead of leadsData.leads) {
        if (grouped[lead.stageId]) {
          grouped[lead.stageId].push(lead)
        }
      }
      // Ordenar por posição
      for (const stageId of Object.keys(grouped)) {
        grouped[stageId].sort((a: LeadCard, b: LeadCard) => a.position - b.position)
      }

      setLeadsByStage(grouped)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [setPipeline, setStages, setLeadsByStage, setLoading])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // SSE: atualizar em tempo real
  useCrmStream(TENANT_ID, useCallback((event) => {
    if (event.type === 'new-message' || event.type === 'lead-moved') {
      fetchData()
    }
  }, [fetchData]))

  // Drag & Drop handler
  const handleDragEnd = useCallback(async (result: DropResult) => {
    setIsDragging(false)

    if (!result.destination) return

    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // Calcular nova posição fracionária
    const destLeads = leadsByStage[destination.droppableId] ?? []
    const filteredDest = destLeads.filter(l => l.id !== draggableId)
    const before = destination.index > 0 ? filteredDest[destination.index - 1]?.position ?? null : null
    const after = destination.index < filteredDest.length ? filteredDest[destination.index]?.position ?? null : null
    const newPosition = calcPosition(before, after)

    // Optimistic update
    startTransition(() => {
      moveLeadOptimistic(draggableId, source.droppableId, destination.droppableId, newPosition)
      setOptimisticStages(stages)
    })

    playFeedback('drop')

    // Persistir no servidor
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/crm/leads/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leadId: draggableId,
          fromStageId: source.droppableId,
          toStageId: destination.droppableId,
          position: newPosition,
          tenantId: TENANT_ID,
        }),
      })

      if (!res.ok) {
        // Reverter em caso de erro
        fetchData()
      }

      // Check se destino é WON
      const destStage = stages.find(s => s.id === destination.droppableId)
      if (destStage?.type === 'WON') {
        playFeedback('won')
      } else if (destStage?.type === 'LOST') {
        playFeedback('lost')
      }
    } catch {
      fetchData()
    }
  }, [leadsByStage, stages, moveLeadOptimistic, setOptimisticStages, fetchData])

  // Criar novo lead
  const handleCreateLead = useCallback(async (data: {
    name: string; phone: string; email: string; stageId: string
    expectedValue: string; source: string; tags: string
  }) => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...data,
          tenantId: TENANT_ID,
          pipelineId: pipeline?.id,
          expectedValue: data.expectedValue ? parseFloat(data.expectedValue) : null,
          tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      })

      if (!res.ok) throw new Error('Falha ao criar lead')

      const newLead = await res.json()
      addLeadOptimistic(newLead)
      setShowNewLead(false)
      playFeedback('click')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lead')
    }
  }, [pipeline?.id, addLeadOptimistic])

  // Filtrar leads por busca
  const getFilteredLeads = useCallback((stageId: string): LeadCard[] => {
    const leads = leadsByStage[stageId] ?? []
    if (!searchQuery.trim()) return leads
    const q = searchQuery.toLowerCase()
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [leadsByStage, searchQuery])

  if (isLoading) return <KanbanSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <svg width="48" height="48" fill="none" stroke="#FF6B4A" strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <p className="mt-4 text-sm" style={{ color: '#FF6B4A' }}>{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0EDE8' }}>
            {pipeline?.name ?? 'Pipeline'}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B8A94' }}>
            {optimisticStages.reduce((acc, s) => acc + s.cachedLeadCount, 0)} leads · {formatCurrency(optimisticStages.reduce((acc, s) => acc + s.cachedTotalValue, 0))}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" width="14" height="14" fill="none" stroke="#8B8A94" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar leads..."
              className="pl-9 pr-3 py-2 rounded-lg text-sm w-full sm:w-56 focus:outline-none transition-colors"
              style={{ background: '#111114', color: '#F0EDE8', border: '1px solid #2A2A32' }}
            />
          </div>
          <button
            onClick={() => setShowNewLead(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: '#D4AF37', color: '#0A0A0B' }}
          >
            + Novo Lead
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6 scroll-smooth">
          {optimisticStages
            .sort((a, b) => a.order - b.order)
            .map((stage, index) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                leads={getFilteredLeads(stage.id)}
                index={index}
                isDraggingAny={isDragging}
              />
            ))}
        </div>
      </DragDropContext>

      {/* New Lead Modal */}
      {showNewLead && (
        <NewLeadModal
          stages={stages}
          onClose={() => setShowNewLead(false)}
          onSave={handleCreateLead}
        />
      )}
    </div>
  )
}
