'use client'

import { useEffect, useState, useCallback, useOptimistic, startTransition } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useCrmStore } from '@/stores/crm-store'
import { useToastStore } from '@/stores/toast-store'
import { useCrmStream } from '@/hooks/use-crm-stream'
import { calcPosition } from '@/lib/fractional-index'
import { cardDragVariants, siblingCardVariants, columnVariants, drawerVariants, modalOverlayVariants, modalContentVariants } from '@/lib/crm-animations'
import { playFeedback } from '@/lib/crm-feedback'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// ━━━ Types ━━━

interface LastMessage {
  content: string
  fromMe: boolean
  createdAt: string
}

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
  lastMessage: LastMessage | null
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

interface LeadDetail {
  id: string
  name: string
  phone: string
  email: string | null
  status: string
  stageId: string
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
  stage: { id: string; name: string; color: string | null; type: string }
  conversations: Array<{
    id: string
    messages: Array<{
      id: string
      fromMe: boolean
      type: string
      content: string
      status: string
      createdAt: string
    }>
  }>
  activities: Array<{
    id: string
    type: string
    payload: Record<string, unknown>
    createdBy: string | null
    createdAt: string
  }>
}

// ━━━ Constants ━━━

const STATUS_COLORS: Record<string, string> = {
  HOT: '#FF6B4A', WARM: '#F0A500', COLD: '#4A7BFF', WON: '#2ECC8A', LOST: '#8B8A94',
}

const STATUS_LABELS: Record<string, string> = {
  HOT: 'Quente', WARM: 'Morno', COLD: 'Frio', WON: 'Ganho', LOST: 'Perdido',
}

// ━━━ Utility Functions ━━━

function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.length >= 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 5)}****-${clean.slice(-4)}`
  }
  if (clean.length >= 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 3)}****-${clean.slice(-4)}`
  }
  return phone
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Sem interação'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Agora'
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ontem'
  if (days < 30) return `há ${days}d`
  if (days < 365) return `há ${Math.floor(days / 30)}m`
  return `há ${Math.floor(days / 365)}a`
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#2ECC8A'
  if (score >= 40) return '#F0A500'
  return '#FF6B4A'
}

function isRecentlyActive(lead: LeadCard): boolean {
  const lastTime = lead.lastMessage?.createdAt ?? lead.lastInteractionAt
  if (!lastTime) return false
  return Date.now() - new Date(lastTime).getTime() < 2 * 60 * 60 * 1000
}

// ━━━ Skeleton ━━━

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[300px] rounded-xl" style={{ background: '#111114', border: '1px solid #2A2A32' }}>
          <div className="px-3 py-3 border-b" style={{ borderColor: '#2A2A32' }}>
            <div className="h-5 w-24 rounded-md animate-pulse" style={{ background: '#1A1A1F' }} />
            <div className="h-3 w-16 rounded mt-1.5 animate-pulse" style={{ background: '#1A1A1F' }} />
          </div>
          <div className="p-2 space-y-2">
            {Array.from({ length: 3 - i % 2 }).map((_, j) => (
              <div key={j} className="rounded-xl p-3 space-y-2" style={{ background: '#0A0A0B' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-pulse" style={{ background: '#1A1A1F' }} />
                  <div className="flex-1">
                    <div className="h-3.5 w-24 rounded animate-pulse" style={{ background: '#1A1A1F' }} />
                    <div className="h-2.5 w-32 rounded mt-1 animate-pulse" style={{ background: '#1A1A1F' }} />
                  </div>
                </div>
                <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1A1A1F' }} />
                <div className="flex gap-2">
                  <div className="h-3 w-16 rounded animate-pulse" style={{ background: '#1A1A1F' }} />
                  <div className="h-3 w-10 rounded animate-pulse" style={{ background: '#1A1A1F' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ━━━ Avatar ━━━

function LeadAvatar({ name, status, size = 28 }: { name: string; status: string; size?: number }) {
  const color = STATUS_COLORS[status] ?? '#8B8A94'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-bold"
      style={{ width: size, height: size, background: color + '18', color, fontSize: size * 0.36 }}
    >
      {initials}
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setSaving(true)
    onSave({ name, phone, email, stageId, expectedValue, source, tags })
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30'
  const inputStyle = { background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        variants={modalOverlayVariants} initial="hidden" animate="visible" exit="exit"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-md rounded-2xl border p-6"
          style={{ background: '#111114', borderColor: '#2A2A32' }}
          variants={modalContentVariants} initial="hidden" animate="visible" exit="exit"
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#F0EDE8' }}>Novo Lead</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Nome *</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do contato" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Telefone *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="5511999999999" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className={inputClass} style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Estágio</label>
                <select value={stageId} onChange={e => setStageId(e.target.value)} className={inputClass} style={inputStyle}>
                  {stages.filter(s => s.type === 'OPEN').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Valor esperado</label>
                <input value={expectedValue} onChange={e => setExpectedValue(e.target.value)} placeholder="R$ 0" className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Fonte</label>
                <input value={source} onChange={e => setSource(e.target.value)} placeholder="Instagram, WhatsApp..." className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Tags</label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="botox, vip" className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                style={{ background: '#1A1A1F', color: '#8B8A94', border: '1px solid #2A2A32' }}
              >Cancelar</button>
              <button type="submit" disabled={saving || !name.trim() || !phone.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 hover:brightness-110 active:scale-[0.98]"
                style={{ background: '#D4AF37', color: '#0A0A0B' }}
              >{saving ? 'Salvando...' : 'Criar Lead'}</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ━━━ Lead Card ━━━

function LeadCardComponent({ lead, index, isDraggingAny, onClickLead }: {
  lead: LeadCard; index: number; isDraggingAny: boolean; onClickLead: (id: string) => void
}) {
  const statusColor = STATUS_COLORS[lead.status] ?? '#8B8A94'
  const isHot = isRecentlyActive(lead)
  const scoreColor = lead.aiScore != null ? getScoreColor(lead.aiScore) : null

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2"
          style={provided.draggableProps.style}
          onClick={() => { if (!snapshot.isDragging) onClickLead(lead.id) }}
        >
          <motion.div
            variants={isDraggingAny && !snapshot.isDragging ? siblingCardVariants : cardDragVariants}
            animate={snapshot.isDragging ? 'dragging' : isDraggingAny ? 'dimmed' : 'idle'}
            className="rounded-xl border p-3 cursor-grab active:cursor-grabbing"
            style={{
              background: '#111114',
              borderColor: snapshot.isDragging ? '#D4AF37' : isHot ? 'rgba(255,107,74,0.4)' : '#2A2A32',
              ...(isHot && !snapshot.isDragging ? {
                animation: 'hotPulse 2s ease-in-out infinite',
              } : {}),
            }}
          >
            {/* Header: Avatar + Name + Status */}
            <div className="flex items-center gap-2.5 mb-2">
              <LeadAvatar name={lead.name} status={lead.status} size={28} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block" style={{ color: '#F0EDE8' }}>{lead.name}</span>
                <span className="text-[10px] block truncate" style={{ color: '#8B8A94' }}>{maskPhone(lead.phone)}</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 uppercase tracking-wide"
                style={{ background: statusColor + '18', color: statusColor }}
              >{STATUS_LABELS[lead.status] ?? lead.status}</span>
            </div>

            {/* Last message preview */}
            {lead.lastMessage && (
              <div className="mb-2 px-2 py-1.5 rounded-lg" style={{ background: '#0A0A0B' }}>
                <p className="text-[11px] truncate" style={{ color: '#8B8A94' }}>
                  <span style={{ color: lead.lastMessage.fromMe ? '#D4AF37' : '#4A7BFF' }}>
                    {lead.lastMessage.fromMe ? '↗ Você: ' : '↙ '}
                  </span>
                  {lead.lastMessage.content.slice(0, 55)}{lead.lastMessage.content.length > 55 ? '…' : ''}
                </p>
              </div>
            )}

            {/* Tags */}
            {lead.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {lead.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                  >{tag}</span>
                ))}
                {lead.tags.length > 3 && <span className="text-[9px] px-1 py-0.5" style={{ color: '#8B8A94' }}>+{lead.tags.length - 3}</span>}
              </div>
            )}

            {/* Value + AI Score */}
            <div className="flex items-center gap-2 mb-1.5">
              {lead.expectedValue != null && lead.expectedValue > 0 && (
                <span className="text-xs font-semibold" style={{ color: '#D4AF37' }}>{formatCurrency(lead.expectedValue)}</span>
              )}
              {lead.aiScore != null && scoreColor && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                  style={{ background: scoreColor + '15', color: scoreColor }}
                >★ {lead.aiScore}</span>
              )}
            </div>

            {/* Golden Window */}
            {lead.bestContactDays && lead.bestContactHours && (
              <div className="text-[10px] mb-1.5 px-2 py-1 rounded"
                style={{ background: 'rgba(212,175,55,0.06)', color: '#D4AF37' }}
              >
                ⏰ {lead.bestContactDays} · {lead.bestContactHours}
                {lead.bestContactBasis != null && lead.bestContactBasis > 0 && <span className="opacity-50"> · {lead.bestContactBasis} conv</span>}
              </div>
            )}

            {/* Footer: Time + Source */}
            <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: '#1A1A1F' }}>
              <span className="text-[10px] flex items-center gap-1" style={{ color: isHot ? '#FF6B4A' : '#8B8A94' }}>
                {isHot && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF6B4A' }} />}
                {timeAgo(lead.lastMessage?.createdAt ?? lead.lastInteractionAt)}
              </span>
              {lead.source && <span className="text-[10px]" style={{ color: '#8B8A94' }}>{lead.source}</span>}
            </div>
          </motion.div>
        </div>
      )}
    </Draggable>
  )
}

// ━━━ Stage Column ━━━

function StageColumn({ stage, leads, index, isDraggingAny, onClickLead }: {
  stage: StageData; leads: LeadCard[]; index: number; isDraggingAny: boolean; onClickLead: (id: string) => void
}) {
  const stageColor = stage.color ?? '#8B8A94'
  return (
    <motion.div
      className="flex-shrink-0 w-[300px] md:w-[320px] rounded-xl flex flex-col max-h-[calc(100vh-13rem)]"
      style={{ background: '#111114', border: '1px solid #2A2A32' }}
      variants={columnVariants} initial="hidden" animate="visible" custom={index}
    >
      <div className="relative px-3 py-3 border-b" style={{ borderColor: '#2A2A32' }}>
        <div className="absolute top-0 left-3 right-3 h-[3px] rounded-b-full" style={{ background: stageColor }} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: '#F0EDE8' }}>{stage.name}</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: stageColor + '15', color: stageColor }}
          >{stage.cachedLeadCount}</span>
        </div>
        {stage.cachedTotalValue > 0 && (
          <span className="text-[11px] font-medium block mt-0.5" style={{ color: '#D4AF37' }}>{formatCurrency(stage.cachedTotalValue)}</span>
        )}
      </div>

      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef} {...provided.droppableProps}
            className="flex-1 overflow-y-auto p-2 transition-colors"
            style={{ background: snapshot.isDraggingOver ? 'rgba(212,175,55,0.04)' : 'transparent', minHeight: 60 }}
          >
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-10 opacity-25">
                <svg width="28" height="28" fill="none" stroke="#8B8A94" strokeWidth="1.2" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
                <span className="text-[10px] mt-2" style={{ color: '#8B8A94' }}>Arraste leads aqui</span>
              </div>
            )}
            {leads.map((lead, i) => (
              <LeadCardComponent key={lead.id} lead={lead} index={i} isDraggingAny={isDraggingAny} onClickLead={onClickLead} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </motion.div>
  )
}

// ━━━ Info Item ━━━

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: '#111114' }}>
      <p className="text-[10px] uppercase tracking-wider font-medium mb-0.5" style={{ color: '#8B8A94' }}>{label}</p>
      <p className="text-xs font-medium" style={{ color: '#F0EDE8' }}>{value}</p>
    </div>
  )
}

function DrawerSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: '#1A1A1F' }} />
        <div className="flex-1">
          <div className="h-4 w-32 rounded animate-pulse" style={{ background: '#1A1A1F' }} />
          <div className="h-3 w-48 rounded mt-1.5 animate-pulse" style={{ background: '#1A1A1F' }} />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: '#1A1A1F' }} />
      ))}
    </div>
  )
}

const ACTIVITY_LABELS: Record<string, string> = {
  LEAD_CREATED: 'Lead criado',
  LEAD_MOVED: 'Movido de estágio',
  LEAD_WON: 'Lead ganho',
  LEAD_LOST: 'Lead perdido',
  MESSAGE_SENT: 'Mensagem enviada',
  MESSAGE_RECEIVED: 'Mensagem recebida',
  NOTE_ADDED: 'Nota adicionada',
  TAG_CHANGED: 'Tags alteradas',
  SCORE_UPDATED: 'Score atualizado',
}

// ━━━ Lead Drawer ━━━

function LeadDrawer({ leadId, stages, onClose, onLeadUpdated }: {
  leadId: string; stages: StageData[]; onClose: () => void; onLeadUpdated: () => void
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'messages' | 'timeline'>('details')
  const [movingStage, setMovingStage] = useState(false)
  const addToast = useToastStore(s => s.addToast)

  useEffect(() => {
    setIsLoading(true)
    setActiveTab('details')
    const token = localStorage.getItem('admin_token')
    fetch(`/api/admin/crm/leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => setLead(data.lead))
      .catch(() => addToast('Erro ao carregar lead', 'error'))
      .finally(() => setIsLoading(false))
  }, [leadId, addToast])

  const handleMoveStage = async (newStageId: string) => {
    if (!lead || movingStage) return
    setMovingStage(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/crm/leads/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId: lead.id, fromStageId: lead.stageId, toStageId: newStageId, position: 0, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      addToast('Lead movido com sucesso')
      onLeadUpdated()
      onClose()
    } catch {
      addToast('Erro ao mover lead', 'error')
    } finally {
      setMovingStage(false)
    }
  }

  const statusColor = lead ? STATUS_COLORS[lead.status] ?? '#8B8A94' : '#8B8A94'
  const messages = lead?.conversations[0]?.messages?.slice().reverse() ?? []

  return (
    <motion.div className="fixed inset-0 z-40" initial="hidden" animate="visible" exit="exit">
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-full max-w-lg border-l flex flex-col"
        style={{ background: '#0A0A0B', borderColor: '#2A2A32' }}
        variants={drawerVariants}
      >
        {isLoading ? <DrawerSkeleton /> : lead ? (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: '#2A2A32' }}>
              <LeadAvatar name={lead.name} status={lead.status} size={40} />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold truncate" style={{ color: '#F0EDE8' }}>{lead.name}</h3>
                <p className="text-xs" style={{ color: '#8B8A94' }}>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded" style={{ background: statusColor + '18', color: statusColor }}>
                {STATUS_LABELS[lead.status] ?? lead.status}
              </span>
              <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#8B8A94' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Stage + Score */}
            <div className="px-4 py-2.5 flex items-center gap-3 border-b" style={{ borderColor: '#1A1A1F' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: lead.stage.color ?? '#8B8A94' }} />
                <span className="text-xs font-medium" style={{ color: '#F0EDE8' }}>{lead.stage.name}</span>
              </div>
              {lead.aiScore != null && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: getScoreColor(lead.aiScore) + '15', color: getScoreColor(lead.aiScore) }}>★ {lead.aiScore}</span>
              )}
              {lead.expectedValue != null && lead.expectedValue > 0 && (
                <span className="text-xs font-semibold ml-auto" style={{ color: '#D4AF37' }}>{formatCurrency(lead.expectedValue)}</span>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: '#2A2A32' }}>
              {(['details', 'messages', 'timeline'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2.5 text-xs font-medium transition-colors relative"
                  style={{ color: activeTab === tab ? '#D4AF37' : '#8B8A94' }}
                >
                  {tab === 'details' ? 'Detalhes' : tab === 'messages' ? `Mensagens (${messages.length})` : `Atividades (${lead.activities.length})`}
                  {activeTab === tab && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ background: '#D4AF37' }} />}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {lead.tags.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: '#8B8A94' }}>Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.tags.map(tag => <span key={tag} className="text-[10px] px-2 py-1 rounded-md" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>{tag}</span>)}
                      </div>
                    </div>
                  )}
                  {lead.bestContactDays && lead.bestContactHours && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: '#D4AF37' }}>⏰ Janela de Ouro</p>
                      <p className="text-sm font-semibold" style={{ color: '#D4AF37' }}>{lead.bestContactDays} · {lead.bestContactHours}</p>
                      {lead.bestContactBasis != null && lead.bestContactBasis > 0 && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#8B8A94' }}>Base: {lead.bestContactBasis} conversões</p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <InfoItem label="Fonte" value={lead.source ?? '—'} />
                    <InfoItem label="Criado em" value={new Date(lead.createdAt).toLocaleDateString('pt-BR')} />
                    <InfoItem label="Última interação" value={timeAgo(lead.lastInteractionAt)} />
                    <InfoItem label="Risco de Churn" value={lead.churnRisk != null ? `${lead.churnRisk}%` : '—'} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: '#8B8A94' }}>Mover para estágio</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stages.filter(s => s.id !== lead.stageId).map(s => (
                        <button key={s.id} onClick={() => handleMoveStage(s.id)} disabled={movingStage}
                          className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all hover:brightness-125 disabled:opacity-50"
                          style={{ background: (s.color ?? '#8B8A94') + '12', color: s.color ?? '#8B8A94', border: `1px solid ${(s.color ?? '#8B8A94')}20` }}
                        >{s.name}</button>
                      ))}
                    </div>
                  </div>
                  {lead.conversations.length > 0 && (
                    <Link href="/admin/crm/inbox"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-110"
                      style={{ background: 'rgba(212,175,55,0.08)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.15)' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      Abrir no Inbox
                    </Link>
                  )}
                </div>
              )}

              {activeTab === 'messages' && (
                <div className="space-y-2">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center py-12 opacity-30">
                      <svg width="32" height="32" fill="none" stroke="#8B8A94" strokeWidth="1.2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Nenhuma mensagem</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#8B8A94' }}>Conecte o WhatsApp para ver mensagens</p>
                    </div>
                  ) : messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%] rounded-xl px-3 py-2 text-[13px]"
                        style={{
                          background: msg.fromMe ? '#D4AF37' : '#1A1A1F',
                          color: msg.fromMe ? '#0A0A0B' : '#F0EDE8',
                          borderBottomRightRadius: msg.fromMe ? '4px' : '12px',
                          borderBottomLeftRadius: msg.fromMe ? '12px' : '4px',
                        }}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <span className={`text-[9px] block mt-0.5 ${msg.fromMe ? 'text-black/40' : 'text-white/30'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {msg.fromMe && msg.status === 'SENT' && ' ✓'}
                          {msg.fromMe && (msg.status === 'DELIVERED' || msg.status === 'READ') && ' ✓✓'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-1">
                  {lead.activities.length === 0 ? (
                    <div className="flex flex-col items-center py-12 opacity-30">
                      <svg width="32" height="32" fill="none" stroke="#8B8A94" strokeWidth="1.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Nenhuma atividade registrada</p>
                    </div>
                  ) : lead.activities.map((activity, i) => (
                    <div key={activity.id} className="flex gap-3 py-2">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: '#D4AF37' }} />
                        {i < lead.activities.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: '#2A2A32' }} />}
                      </div>
                      <div className="min-w-0 pb-2">
                        <p className="text-xs font-medium" style={{ color: '#F0EDE8' }}>{ACTIVITY_LABELS[activity.type] ?? activity.type.replace(/_/g, ' ')}</p>
                        <p className="text-[10px]" style={{ color: '#8B8A94' }}>{new Date(activity.createdAt).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <svg width="32" height="32" fill="none" stroke="#FF6B4A" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            <p className="text-sm mt-3" style={{ color: '#FF6B4A' }}>Lead não encontrado</p>
          </div>
        )}
      </motion.div>
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
  const addToast = useToastStore(s => s.addToast)

  const [isDragging, setIsDragging] = useState(false)
  const [showNewLead, setShowNewLead] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null)

  const [optimisticStages, setOptimisticStages] = useOptimistic(stages)

  // Unique tags for filter dropdown
  const allTags = Array.from(new Set(
    Object.values(leadsByStage).flat().flatMap(l => l.tags)
  )).sort()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('admin_token')

      const pipelineRes = await fetch(`/api/admin/crm/pipeline?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!pipelineRes.ok) throw new Error('Falha ao carregar pipeline')
      const pipelineData = await pipelineRes.json()
      setPipeline(pipelineData.pipeline)
      setStages(pipelineData.stages)

      const leadsRes = await fetch(`/api/admin/crm/leads?tenantId=${TENANT_ID}&pipelineId=${pipelineData.pipeline.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!leadsRes.ok) throw new Error('Falha ao carregar leads')
      const leadsData = await leadsRes.json()

      const grouped: Record<string, LeadCard[]> = {}
      for (const stage of pipelineData.stages) { grouped[stage.id] = [] }
      for (const lead of leadsData.leads) {
        if (grouped[lead.stageId]) grouped[lead.stageId].push(lead)
      }
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

  useEffect(() => { fetchData() }, [fetchData])

  useCrmStream(TENANT_ID, useCallback((event) => {
    if (event.type === 'new-message' || event.type === 'lead-moved') fetchData()
  }, [fetchData]))

  const handleDragEnd = useCallback(async (result: DropResult) => {
    setIsDragging(false)
    if (!result.destination) return
    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const destLeads = leadsByStage[destination.droppableId] ?? []
    const filteredDest = destLeads.filter(l => l.id !== draggableId)
    const before = destination.index > 0 ? filteredDest[destination.index - 1]?.position ?? null : null
    const after = destination.index < filteredDest.length ? filteredDest[destination.index]?.position ?? null : null
    const newPosition = calcPosition(before, after)

    startTransition(() => {
      moveLeadOptimistic(draggableId, source.droppableId, destination.droppableId, newPosition)
      setOptimisticStages(stages)
    })
    playFeedback('drop')

    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/crm/leads/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId: draggableId, fromStageId: source.droppableId, toStageId: destination.droppableId, position: newPosition, tenantId: TENANT_ID }),
      })
      if (!res.ok) { fetchData(); return }

      const destStage = stages.find(s => s.id === destination.droppableId)
      if (destStage?.type === 'WON') { playFeedback('won'); addToast('Lead ganho!') }
      else if (destStage?.type === 'LOST') { playFeedback('lost') }
    } catch { fetchData() }
  }, [leadsByStage, stages, moveLeadOptimistic, setOptimisticStages, fetchData, addToast])

  const handleCreateLead = useCallback(async (data: {
    name: string; phone: string; email: string; stageId: string; expectedValue: string; source: string; tags: string
  }) => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...data, tenantId: TENANT_ID, pipelineId: pipeline?.id,
          expectedValue: data.expectedValue ? parseFloat(data.expectedValue) : null,
          tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      })
      if (!res.ok) throw new Error('Falha ao criar lead')
      const newLead = await res.json()
      addLeadOptimistic({ ...newLead, lastMessage: null })
      setShowNewLead(false)
      addToast('Lead criado com sucesso')
      playFeedback('click')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao criar lead', 'error')
    }
  }, [pipeline?.id, addLeadOptimistic, addToast])

  const getFilteredLeads = useCallback((stageId: string): LeadCard[] => {
    const leads = leadsByStage[stageId] ?? []
    return leads.filter(l => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!l.name.toLowerCase().includes(q) && !l.phone.includes(q) && !l.tags.some(t => t.toLowerCase().includes(q))) return false
      }
      if (scoreFilter !== 'all') {
        if (l.aiScore == null) return false
        if (scoreFilter === 'high' && l.aiScore < 70) return false
        if (scoreFilter === 'medium' && (l.aiScore < 40 || l.aiScore >= 70)) return false
        if (scoreFilter === 'low' && l.aiScore >= 40) return false
      }
      if (tagFilter && !l.tags.some(t => t.toLowerCase() === tagFilter.toLowerCase())) return false
      if (periodFilter !== 'all') {
        const refDate = l.lastInteractionAt ?? l.createdAt
        const diffDays = Math.floor((Date.now() - new Date(refDate).getTime()) / (24 * 60 * 60 * 1000))
        if (periodFilter === 'today' && diffDays > 0) return false
        if (periodFilter === '7d' && diffDays > 7) return false
        if (periodFilter === '30d' && diffDays > 30) return false
      }
      return true
    })
  }, [leadsByStage, searchQuery, scoreFilter, tagFilter, periodFilter])

  const hasActiveFilters = searchQuery.trim() || scoreFilter !== 'all' || tagFilter || periodFilter !== 'all'

  if (isLoading) return <KanbanSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <svg width="48" height="48" fill="none" stroke="#FF6B4A" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
        <p className="mt-4 text-sm" style={{ color: '#FF6B4A' }}>{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
          style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}>Tentar novamente</button>
      </div>
    )
  }

  return (
    <div>
      <style jsx global>{`
        @keyframes hotPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(255,107,74,0.1), inset 0 0 0 1px rgba(255,107,74,0.06); }
          50% { box-shadow: 0 0 20px rgba(255,107,74,0.2), inset 0 0 0 1px rgba(255,107,74,0.12); }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0EDE8' }}>{pipeline?.name ?? 'Pipeline'}</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B8A94' }}>
            {optimisticStages.reduce((acc, s) => acc + s.cachedLeadCount, 0)} leads · {formatCurrency(optimisticStages.reduce((acc, s) => acc + s.cachedTotalValue, 0))}
          </p>
        </div>
        <button onClick={() => setShowNewLead(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: '#D4AF37', color: '#0A0A0B' }}>+ Novo Lead</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" width="14" height="14" fill="none" stroke="#8B8A94" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar nome, telefone, tag..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30"
            style={{ background: '#111114', color: '#F0EDE8', border: '1px solid #2A2A32' }} />
        </div>
        <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs focus:outline-none"
          style={{ background: '#111114', color: scoreFilter !== 'all' ? '#D4AF37' : '#8B8A94', border: '1px solid #2A2A32' }}>
          <option value="all">Todos os scores</option>
          <option value="high">Score alto (70+)</option>
          <option value="medium">Score médio (40-70)</option>
          <option value="low">Score baixo (&lt;40)</option>
        </select>
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs focus:outline-none"
            style={{ background: '#111114', color: tagFilter ? '#D4AF37' : '#8B8A94', border: '1px solid #2A2A32' }}>
            <option value="">Todas as tags</option>
            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        )}
        <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs focus:outline-none"
          style={{ background: '#111114', color: periodFilter !== 'all' ? '#D4AF37' : '#8B8A94', border: '1px solid #2A2A32' }}>
          <option value="all">Qualquer período</option>
          <option value="today">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
        {hasActiveFilters && (
          <button onClick={() => { setSearchQuery(''); setScoreFilter('all'); setTagFilter(''); setPeriodFilter('all') }}
            className="px-2.5 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
            style={{ color: '#FF6B4A', border: '1px solid rgba(255,107,74,0.2)' }}>✕ Limpar</button>
        )}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6">
          {optimisticStages.sort((a, b) => a.order - b.order).map((stage, index) => (
            <StageColumn key={stage.id} stage={stage} leads={getFilteredLeads(stage.id)} index={index}
              isDraggingAny={isDragging} onClickLead={setDrawerLeadId} />
          ))}
        </div>
      </DragDropContext>

      {showNewLead && <NewLeadModal stages={stages} onClose={() => setShowNewLead(false)} onSave={handleCreateLead} />}

      <AnimatePresence>
        {drawerLeadId && <LeadDrawer leadId={drawerLeadId} stages={stages} onClose={() => setDrawerLeadId(null)} onLeadUpdated={fetchData} />}
      </AnimatePresence>
    </div>
  )
}
