'use client'

import { useEffect, useState, useCallback } from 'react'
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
  patientId: string | null
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
  patientId: string | null
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

const STAGE_ICONS: Record<string, string> = {
  'Novo Contato': '✦',
  'Em Atendimento': '◎',
  'Proposta Enviada': '◈',
  'Negociação': '◇',
  'Fechado Ganho': '✓',
  'Fechado Perdido': '✕',
}

// Tags especiais com cores distintas para a recepcionista bater o olho
const TAG_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  VIP:        { bg: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)' },
  Importado:  { bg: 'rgba(74,123,255,0.08)', color: '#4A7BFF', border: '1px solid rgba(74,123,255,0.15)' },
  Recorrente: { bg: 'rgba(46,204,138,0.08)', color: '#2ECC8A', border: '1px solid rgba(46,204,138,0.15)' },
  Fiel:       { bg: 'rgba(168,85,247,0.08)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.15)' },
}

const DEFAULT_TAG_STYLE = { bg: 'rgba(212,175,55,0.06)', color: 'var(--crm-gold)', border: '1px solid rgba(212,175,55,0.1)' }

// Ícones premium para tags especiais — recepcionista bate o olho e identifica
const TAG_ICONS: Record<string, string> = {
  VIP: '♛',
  Recorrente: '↻',
  Fiel: '♥',
}

function getTagStyle(tag: string) {
  return TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE
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

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`
  return formatCurrency(value)
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Sem interação'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ontem'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}m`
  return `${Math.floor(days / 365)}a`
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
    <div>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-48 rounded-lg animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
          <div className="h-4 w-72 rounded-md mt-2 animate-pulse" style={{ background: 'var(--crm-surface)' }} />
        </div>
        <div className="h-10 w-32 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
            <div className="h-3 w-16 rounded mb-2" style={{ background: 'var(--crm-surface-2)' }} />
            <div className="h-6 w-24 rounded" style={{ background: 'var(--crm-surface-2)' }} />
          </div>
        ))}
      </div>
      {/* Columns skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[300px] rounded-xl" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
            <div className="px-3 py-3.5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
              <div className="h-4 w-24 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
              <div className="h-3 w-16 rounded mt-2 animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
            </div>
            <div className="p-2 space-y-2">
              {Array.from({ length: 3 - i % 2 }).map((_, j) => (
                <div key={j} className="rounded-xl p-3.5 space-y-2.5" style={{ background: 'var(--crm-bg)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
                    <div className="flex-1">
                      <div className="h-3.5 w-24 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
                      <div className="h-2.5 w-32 rounded mt-1.5 animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
                    </div>
                  </div>
                  <div className="h-9 rounded-lg animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
                  <div className="flex gap-2">
                    <div className="h-3 w-16 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
                    <div className="h-3 w-12 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ━━━ Avatar ━━━

function LeadAvatar({ name, status, size = 32 }: { name: string; status: string; size?: number }) {
  const color = STATUS_COLORS[status] ?? '#8B8A94'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold relative"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        color,
        fontSize: size * 0.34,
        border: `1.5px solid ${color}30`,
      }}
    >
      {initials}
    </div>
  )
}

// ━━━ Stat Card ━━━

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent?: string }) {
  return (
    <div
      className="rounded-xl p-3.5 transition-all duration-200 group"
      style={{
        background: 'var(--crm-surface)',
        border: '1px solid var(--crm-border)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent ?? 'var(--crm-gold)'; e.currentTarget.style.background = 'var(--crm-surface-2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--crm-border)'; e.currentTarget.style.background = 'var(--crm-surface)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm opacity-60">{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>{label}</span>
      </div>
      <p className="text-lg font-bold tracking-tight" style={{ color: accent ?? 'var(--crm-text)' }}>{value}</p>
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

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        variants={modalOverlayVariants} initial="hidden" animate="visible" exit="exit"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-md rounded-2xl border overflow-hidden"
          style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
          variants={modalContentVariants} initial="hidden" animate="visible" exit="exit"
        >
          {/* Gold accent top bar */}
          <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, var(--crm-gold), transparent)' }} />

          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--crm-gold-subtle)' }}>
                <svg width="20" height="20" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>Novo Lead</h2>
                <p className="text-[11px]" style={{ color: 'var(--crm-text-muted)' }}>Adicione um novo contato ao pipeline</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Nome *</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do contato"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Telefone *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="5511999999999"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Estágio</label>
                  <select value={stageId} onChange={e => setStageId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                    style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}>
                    {stages.filter(s => s.type === 'OPEN').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Valor esperado</label>
                  <input value={expectedValue} onChange={e => setExpectedValue(e.target.value)} placeholder="R$ 0"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                    style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Fonte</label>
                  <input value={source} onChange={e => setSource(e.target.value)} placeholder="Instagram, WhatsApp..."
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                    style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Tags</label>
                  <input value={tags} onChange={e => setTags(e.target.value)} placeholder="botox, vip"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                    style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-125"
                  style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
                >Cancelar</button>
                <button type="submit" disabled={saving || !name.trim() || !phone.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #C4A030)', color: '#0A0A0B', boxShadow: '0 4px 16px rgba(212,175,55,0.2)' }}
                >{saving ? 'Salvando...' : 'Criar Lead'}</button>
              </div>
            </form>
          </div>
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
            className="rounded-xl border cursor-grab active:cursor-grabbing overflow-hidden"
            style={{
              background: snapshot.isDragging ? 'var(--crm-surface-2)' : 'var(--crm-surface)',
              borderColor: snapshot.isDragging ? 'var(--crm-gold)' : isHot ? 'rgba(255,107,74,0.35)' : 'var(--crm-border)',
              ...(isHot && !snapshot.isDragging ? {
                animation: 'hotPulse 2.5s ease-in-out infinite',
              } : {}),
            }}
          >
            {/* Subtle status gradient at top */}
            <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${statusColor}60, transparent)` }} />

            <div className="p-3.5">
              {/* Header: Avatar + Name + Status */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <LeadAvatar name={lead.name} status={lead.status} size={32} />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold truncate block" style={{ color: 'var(--crm-text)' }}>{lead.name}</span>
                  <span className="text-[10px] block truncate" style={{ color: 'var(--crm-text-muted)' }}>{maskPhone(lead.phone)}</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-1 rounded-md shrink-0 uppercase tracking-widest"
                  style={{ background: statusColor + '12', color: statusColor, border: `1px solid ${statusColor}18` }}
                >{STATUS_LABELS[lead.status] ?? lead.status}</span>
                {lead.patientId && (
                  <span className="text-[9px] font-bold px-2 py-1 rounded-md shrink-0 uppercase tracking-widest"
                    style={{ background: 'rgba(46,204,138,0.10)', color: '#2ECC8A', border: '1px solid rgba(46,204,138,0.18)' }}
                  >Paciente</span>
                )}
              </div>

              {/* Last message preview */}
              {lead.lastMessage && (
                <div className="mb-2.5 px-2.5 py-2 rounded-lg" style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}>
                  <p className="text-[11px] truncate leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
                    <span className="font-medium" style={{ color: lead.lastMessage.fromMe ? 'var(--crm-gold)' : 'var(--crm-cold)' }}>
                      {lead.lastMessage.fromMe ? '↗ ' : '↙ '}
                    </span>
                    {lead.lastMessage.content.slice(0, 60)}{lead.lastMessage.content.length > 60 ? '…' : ''}
                  </p>
                </div>
              )}

              {/* Tags — "Importado" é flag interna, não polui o card */}
              {lead.tags.some(t => t !== 'Importado') && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {lead.tags.filter(t => t !== 'Importado').slice(0, 3).map(tag => {
                    const s = getTagStyle(tag)
                    const icon = TAG_ICONS[tag]
                    return (
                      <span key={tag} className={`text-[9px] px-2 py-0.5 rounded-md ${tag === 'VIP' ? 'font-bold tracking-wide' : 'font-medium'}`}
                        style={{ background: s.bg, color: s.color, border: s.border }}
                      >{icon ? `${icon} ` : ''}{tag}</span>
                    )
                  })}
                  {lead.tags.filter(t => t !== 'Importado').length > 3 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ color: 'var(--crm-text-muted)' }}>
                      +{lead.tags.filter(t => t !== 'Importado').length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Value + AI Score row */}
              <div className="flex items-center gap-2.5 mb-2.5">
                {lead.expectedValue != null && lead.expectedValue > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] opacity-50" style={{ color: 'var(--crm-gold)' }}>◆</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--crm-gold)' }}>{formatCurrency(lead.expectedValue)}</span>
                  </div>
                )}
                {lead.aiScore != null && scoreColor && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                    style={{ background: scoreColor + '10', color: scoreColor, border: `1px solid ${scoreColor}15` }}
                  >★ {lead.aiScore}</span>
                )}
              </div>

              {/* Golden Window */}
              {lead.bestContactDays && lead.bestContactHours && (
                <div className="text-[10px] mb-2.5 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
                  style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.08)', color: 'var(--crm-gold)' }}
                >
                  <span className="opacity-70">⏰</span>
                  <span className="font-medium">{lead.bestContactDays} · {lead.bestContactHours}</span>
                  {lead.bestContactBasis != null && lead.bestContactBasis > 0 && (
                    <span className="opacity-40 ml-auto">{lead.bestContactBasis} conv</span>
                  )}
                </div>
              )}

              {/* Footer: Time + Source */}
              <div className="flex items-center justify-between pt-2.5" style={{ borderTop: '1px solid var(--crm-border)' }}>
                <span className="text-[10px] flex items-center gap-1.5 font-medium" style={{ color: isHot ? 'var(--crm-hot)' : 'var(--crm-text-muted)' }}>
                  {isHot && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--crm-hot)' }} />}
                  {timeAgo(lead.lastMessage?.createdAt ?? lead.lastInteractionAt)}
                </span>
                {lead.source && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--crm-text-muted)', background: 'var(--crm-bg)' }}>{lead.source}</span>
                )}
              </div>
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
  const stageIcon = STAGE_ICONS[stage.name] ?? '◉'
  return (
    <motion.div
      className="shrink-0 w-[300px] md:w-[320px] rounded-xl flex flex-col max-h-[calc(100vh-22rem)] min-h-[320px]"
      style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
      variants={columnVariants} initial="hidden" animate="visible" custom={index}
    >
      {/* Column header */}
      <div className="relative px-4 py-3.5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${stageColor}, ${stageColor}40, transparent)` }} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xs" style={{ color: stageColor }}>{stageIcon}</span>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--crm-text)' }}>{stage.name}</span>
            <span className="text-[11px] font-bold w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: stageColor + '12', color: stageColor }}
            >{stage.cachedLeadCount}</span>
          </div>
        </div>
        {stage.cachedTotalValue > 0 && (
          <span className="text-[11px] font-semibold block mt-1" style={{ color: 'var(--crm-gold)' }}>
            {formatCompact(stage.cachedTotalValue)}
          </span>
        )}
      </div>

      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef} {...provided.droppableProps}
            className="flex-1 overflow-y-auto min-h-0 p-2 transition-all duration-200"
            style={{
              background: snapshot.isDraggingOver ? 'rgba(212,175,55,0.03)' : 'transparent',
              boxShadow: snapshot.isDraggingOver ? 'inset 0 0 40px rgba(212,175,55,0.02)' : 'none',
              minHeight: 80,
            }}
          >
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'var(--crm-surface-2)', border: '1px dashed var(--crm-border)' }}
                >
                  <svg width="20" height="20" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1" viewBox="0 0 24 24" className="opacity-30">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="text-[11px] font-medium" style={{ color: 'var(--crm-text-muted)', opacity: 0.4 }}>Arraste leads aqui</span>
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

function InfoItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
      <p className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--crm-text-muted)' }}>{label}</p>
      <p className="text-xs font-semibold" style={{ color: accent ?? 'var(--crm-text)' }}>{value}</p>
    </div>
  )
}

function DrawerSkeleton() {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
        <div className="flex-1">
          <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
          <div className="h-3 w-48 rounded mt-2 animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
      ))}
    </div>
  )
}

const ACTIVITY_LABELS: Record<string, string> = {
  LEAD_CREATED: 'Lead criado',
  LEAD_MOVED: 'Movido de estágio',
  LEAD_WON: 'Lead ganho',
  LEAD_LOST: 'Lead perdido',
  LEAD_CONVERTED: 'Convertido em paciente',
  MESSAGE_SENT: 'Mensagem enviada',
  MESSAGE_RECEIVED: 'Mensagem recebida',
  NOTE_ADDED: 'Nota adicionada',
  TAG_CHANGED: 'Tags alteradas',
  SCORE_UPDATED: 'Score atualizado',
}

const ACTIVITY_ICONS: Record<string, string> = {
  LEAD_CREATED: '✦',
  LEAD_MOVED: '↔',
  LEAD_WON: '✓',
  LEAD_LOST: '✕',
  LEAD_CONVERTED: '♦',
  MESSAGE_SENT: '↗',
  MESSAGE_RECEIVED: '↙',
  NOTE_ADDED: '✎',
  TAG_CHANGED: '#',
  SCORE_UPDATED: '★',
}

// ━━━ Lead Drawer ━━━

function LeadDrawer({ leadId, stages, onClose, onLeadUpdated }: {
  leadId: string; stages: StageData[]; onClose: () => void; onLeadUpdated: () => void
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'messages' | 'timeline'>('details')
  const [movingStage, setMovingStage] = useState(false)
  const [converting, setConverting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  const handleConvertToPatient = async () => {
    if (!lead || converting) return
    setConverting(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/crm/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao converter')
      }
      const data = await res.json()
      addToast(data.wasExisting ? `Vinculado ao paciente ${data.patientName}` : `Paciente ${data.patientName} criado`)
      playFeedback('won')
      setLead({ ...lead, patientId: data.patientId })
      onLeadUpdated()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao converter lead', 'error')
    } finally {
      setConverting(false)
    }
  }

  const handleDeleteLead = async () => {
    if (!lead || deleting) return
    setDeleting(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/crm/leads/${lead.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      addToast('Lead excluído com sucesso')
      onLeadUpdated()
      onClose()
    } catch {
      addToast('Erro ao excluir lead', 'error')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const statusColor = lead ? STATUS_COLORS[lead.status] ?? '#8B8A94' : '#8B8A94'
  const messages = lead?.conversations[0]?.messages?.slice().reverse() ?? []

  const TABS = [
    { key: 'details' as const, label: 'Detalhes', icon: '◉' },
    { key: 'messages' as const, label: `Chat (${messages.length})`, icon: '◆' },
    { key: 'timeline' as const, label: `Timeline (${lead?.activities.length ?? 0})`, icon: '◈' },
  ]

  return (
    <motion.div className="fixed inset-0 z-40" initial="hidden" animate="visible" exit="exit">
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-full max-w-lg border-l flex flex-col overflow-hidden"
        style={{ background: 'var(--crm-bg)', borderColor: 'var(--crm-border)' }}
        variants={drawerVariants}
      >
        {isLoading ? <DrawerSkeleton /> : lead ? (
          <>
            {/* Header */}
            <div className="p-5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
              <div className="flex items-center gap-3.5">
                <LeadAvatar name={lead.name} status={lead.status} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold truncate" style={{ color: 'var(--crm-text)' }}>{lead.name}</h3>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0"
                      style={{ background: statusColor + '12', color: statusColor, border: `1px solid ${statusColor}20` }}>
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                    {lead.phone}{lead.email ? ` · ${lead.email}` : ''}
                  </p>
                </div>
                <button onClick={onClose}
                  className="p-2 rounded-lg transition-all hover:bg-white/5"
                  style={{ color: 'var(--crm-text-muted)' }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>

              {/* Quick info bar */}
              <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid var(--crm-border)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: lead.stage.color ?? '#8B8A94' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--crm-text)' }}>{lead.stage.name}</span>
                </div>
                {lead.aiScore != null && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    style={{ background: getScoreColor(lead.aiScore) + '10', color: getScoreColor(lead.aiScore) }}>★ {lead.aiScore}</span>
                )}
                {lead.expectedValue != null && lead.expectedValue > 0 && (
                  <span className="text-xs font-bold ml-auto" style={{ color: 'var(--crm-gold)' }}>{formatCurrency(lead.expectedValue)}</span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex px-2 pt-1 border-b" style={{ borderColor: 'var(--crm-border)' }}>
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className="flex-1 py-2.5 text-[11px] font-medium transition-all relative flex items-center justify-center gap-1.5 rounded-t-lg"
                  style={{
                    color: activeTab === tab.key ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                    background: activeTab === tab.key ? 'var(--crm-gold-subtle)' : 'transparent',
                  }}
                >
                  <span className="opacity-60">{tab.icon}</span>
                  {tab.label}
                  {activeTab === tab.key && <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full" style={{ background: 'var(--crm-gold)' }} />}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {lead.tags.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.tags.filter(t => t !== 'Importado').map(tag => {
                          const s = getTagStyle(tag)
                          const icon = TAG_ICONS[tag]
                          return (
                            <span key={tag} className={`text-[10px] px-2.5 py-1 rounded-lg ${tag === 'VIP' ? 'font-bold tracking-wide' : 'font-medium'}`}
                              style={{ background: s.bg, color: s.color, border: s.border }}
                            >{icon ? `${icon} ` : ''}{tag}</span>
                          )
                        })}
                      </div>
                      {lead.tags.includes('Importado') && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <span className="text-[9px] px-2.5 py-1 rounded-full font-medium"
                            style={{ background: 'rgba(74,123,255,0.04)', color: 'var(--crm-text-muted)', border: '1px solid rgba(74,123,255,0.08)' }}>
                            ↓ Importado do sistema · Automações pausadas
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {lead.bestContactDays && lead.bestContactHours && (
                    <div className="rounded-xl p-3.5" style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.1)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--crm-gold)' }}>
                        <span>⏰</span> Janela de Ouro
                      </p>
                      <p className="text-sm font-bold" style={{ color: 'var(--crm-gold)' }}>{lead.bestContactDays} · {lead.bestContactHours}</p>
                      {lead.bestContactBasis != null && lead.bestContactBasis > 0 && (
                        <p className="text-[10px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>Base: {lead.bestContactBasis} conversões</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <InfoItem label="Fonte" value={lead.source ?? '—'} />
                    <InfoItem label="Criado em" value={new Date(lead.createdAt).toLocaleDateString('pt-BR')} />
                    <InfoItem label="Última interação" value={timeAgo(lead.lastInteractionAt)} />
                    <InfoItem label="Risco de Churn" value={lead.churnRisk != null ? `${lead.churnRisk}%` : '—'} accent={lead.churnRisk != null && lead.churnRisk >= 70 ? 'var(--crm-hot)' : undefined} />
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>Mover para</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stages.filter(s => s.id !== lead.stageId).map(s => (
                        <button key={s.id} onClick={() => handleMoveStage(s.id)} disabled={movingStage}
                          className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all hover:brightness-125 disabled:opacity-40"
                          style={{ background: (s.color ?? '#8B8A94') + '08', color: s.color ?? '#8B8A94', border: `1px solid ${(s.color ?? '#8B8A94')}15` }}
                        >{s.name}</button>
                      ))}
                    </div>
                  </div>

                  {/* Paciente section */}
                  {lead.patientId ? (
                    <Link href={`/admin/clientes?highlight=${lead.patientId}`}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                      style={{ background: 'rgba(46,204,138,0.06)', color: '#2ECC8A', border: '1px solid rgba(46,204,138,0.12)' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>
                      Ver Paciente
                    </Link>
                  ) : (
                    <button onClick={handleConvertToPatient} disabled={converting}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                      style={{ background: 'rgba(46,204,138,0.06)', color: '#2ECC8A', border: '1px solid rgba(46,204,138,0.12)' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                      {converting ? 'Convertendo...' : 'Converter em Paciente'}
                    </button>
                  )}

                  {lead.conversations.length > 0 && (
                    <Link href="/admin/crm/inbox"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                      style={{ background: 'rgba(212,175,55,0.06)', color: 'var(--crm-gold)', border: '1px solid rgba(212,175,55,0.1)' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      Abrir no Inbox
                    </Link>
                  )}

                  {/* Excluir lead (soft-delete) */}
                  <div className="pt-4 mt-4" style={{ borderTop: '1px solid var(--crm-border)' }}>
                    {!confirmDelete ? (
                      <button onClick={() => setConfirmDelete(true)}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all hover:brightness-110"
                        style={{ background: 'rgba(255,107,74,0.04)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                        </svg>
                        Excluir Lead
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-center" style={{ color: 'var(--crm-hot)' }}>Confirma a exclusão de {lead.name}?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmDelete(false)}
                            className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
                          >Cancelar</button>
                          <button onClick={handleDeleteLead} disabled={deleting}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                            style={{ background: 'rgba(255,107,74,0.1)', color: 'var(--crm-hot)', border: '1px solid rgba(255,107,74,0.2)' }}
                          >{deleting ? 'Excluindo...' : 'Sim, excluir'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'messages' && (
                <div className="space-y-2.5">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center py-16">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'var(--crm-surface)', border: '1px dashed var(--crm-border)' }}>
                        <svg width="24" height="24" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1" viewBox="0 0 24 24" className="opacity-30">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }}>Nenhuma mensagem</p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--crm-text-muted)', opacity: 0.3 }}>Conecte o WhatsApp para iniciar</p>
                    </div>
                  ) : messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px]"
                        style={{
                          background: msg.fromMe ? 'linear-gradient(135deg, #D4AF37, #C4A030)' : 'var(--crm-surface)',
                          color: msg.fromMe ? '#0A0A0B' : 'var(--crm-text)',
                          border: msg.fromMe ? 'none' : '1px solid var(--crm-border)',
                          borderBottomRightRadius: msg.fromMe ? '6px' : '16px',
                          borderBottomLeftRadius: msg.fromMe ? '16px' : '6px',
                          boxShadow: msg.fromMe ? '0 2px 12px rgba(212,175,55,0.2)' : 'none',
                        }}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        <span className={`text-[9px] block mt-1 ${msg.fromMe ? 'text-black/40' : ''}`} style={msg.fromMe ? undefined : { color: 'var(--crm-text-muted)' }}>
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
                <div className="space-y-0.5">
                  {lead.activities.length === 0 ? (
                    <div className="flex flex-col items-center py-16">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'var(--crm-surface)', border: '1px dashed var(--crm-border)' }}>
                        <svg width="24" height="24" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1" viewBox="0 0 24 24" className="opacity-30">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }}>Nenhuma atividade</p>
                    </div>
                  ) : lead.activities.map((activity, i) => (
                    <div key={activity.id} className="flex gap-3 py-2.5">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] shrink-0 mt-0.5"
                          style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}
                        >{ACTIVITY_ICONS[activity.type] ?? '•'}</div>
                        {i < lead.activities.length - 1 && <div className="w-px flex-1 mt-1.5" style={{ background: 'var(--crm-border)' }} />}
                      </div>
                      <div className="min-w-0 pb-1">
                        <p className="text-xs font-medium" style={{ color: 'var(--crm-text)' }}>{ACTIVITY_LABELS[activity.type] ?? activity.type.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>{new Date(activity.createdAt).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,107,74,0.08)', border: '1px solid rgba(255,107,74,0.15)' }}>
              <svg width="24" height="24" fill="none" stroke="var(--crm-hot)" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--crm-hot)' }}>Lead não encontrado</p>
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
    moveLeadOptimistic, addLeadOptimistic, removeLeadOptimistic,
  } = useCrmStore()
  const addToast = useToastStore(s => s.addToast)

  const [isDragging, setIsDragging] = useState(false)
  const [showNewLead, setShowNewLead] = useState(false)
  const [importing, setImporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null)

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

    moveLeadOptimistic(draggableId, source.droppableId, destination.droppableId, newPosition)
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
  }, [leadsByStage, stages, moveLeadOptimistic, fetchData, addToast])

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
      fetchData()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao criar lead', 'error')
    }
  }, [pipeline?.id, addLeadOptimistic, addToast, fetchData])

  const handleImportPatients = useCallback(async () => {
    if (importing) return
    setImporting(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/crm/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao importar')
      if (data.imported > 0) {
        // Toast rico com breakdown de classificação
        const parts = [`${data.imported} pacientes importados e classificados!`]
        if (data.classification) {
          const c = data.classification as { hot: number; warm: number; cold: number; vipCount: number }
          const details: string[] = []
          if (c.hot > 0) details.push(`${c.hot} quentes`)
          if (c.warm > 0) details.push(`${c.warm} mornos`)
          if (c.cold > 0) details.push(`${c.cold} frios`)
          if (details.length > 0) parts.push(`(${details.join(', ')})`)
          if (c.vipCount > 0) parts.push(`· ${c.vipCount} VIP`)
        }
        addToast(parts.join(' '))
        playFeedback('won')
        fetchData()
      } else {
        addToast(data.message || 'Nenhum paciente novo para importar', 'info')
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao importar pacientes', 'error')
    } finally {
      setImporting(false)
    }
  }, [importing, addToast, fetchData])

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

  // Computed stats
  const totalLeads = stages.reduce((acc, s) => acc + s.cachedLeadCount, 0)
  const totalValue = stages.reduce((acc, s) => acc + s.cachedTotalValue, 0)
  const wonStage = stages.find(s => s.type === 'WON')
  const conversionRate = totalLeads > 0 && wonStage ? Math.round((wonStage.cachedLeadCount / totalLeads) * 100) : 0

  if (isLoading) return <KanbanSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(255,107,74,0.08)', border: '1px solid rgba(255,107,74,0.15)' }}>
          <svg width="28" height="28" fill="none" stroke="var(--crm-hot)" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--crm-hot)' }}>Erro ao carregar</p>
        <p className="text-xs mb-5" style={{ color: 'var(--crm-text-muted)' }}>{error}</p>
        <button onClick={fetchData} className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-125"
          style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}>Tentar novamente</button>
      </div>
    )
  }

  return (
    <div>
      <style jsx global>{`
        @keyframes hotPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(255,107,74,0.08), inset 0 0 0 1px rgba(255,107,74,0.04); }
          50% { box-shadow: 0 0 24px rgba(255,107,74,0.16), inset 0 0 0 1px rgba(255,107,74,0.1); }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            {pipeline?.name ?? 'Pipeline'}
          </h1>
          <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--crm-text-muted)' }}>
            Gerencie seus leads e acompanhe conversões
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportPatients}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all hover:brightness-125 active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className={importing ? 'animate-spin' : ''}>
              {importing
                ? <><circle cx="12" cy="12" r="10" opacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" /></>
                : <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>
              }
            </svg>
            {importing ? 'Importando...' : 'Importar Pacientes'}
          </button>
          <button onClick={() => setShowNewLead(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #C4A030)', color: '#0A0A0B', boxShadow: '0 4px 20px rgba(212,175,55,0.2)' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Novo Lead
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Leads" value={String(totalLeads)} icon="◆" />
        <StatCard label="Valor Total" value={formatCompact(totalValue)} icon="◇" accent="var(--crm-gold)" />
        <StatCard label="Conversão" value={`${conversionRate}%`} icon="◈" accent="var(--crm-won)" />
        <StatCard label="Estágios" value={String(stages.length)} icon="◉" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30" width="14" height="14" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar nome, telefone, tag..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl text-[13px] focus:outline-none transition-all focus:ring-1 focus:ring-[#D4AF37]/30"
            style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          />
        </div>
        <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl text-[12px] font-medium focus:outline-none transition-all cursor-pointer"
          style={{ background: 'var(--crm-surface)', color: scoreFilter !== 'all' ? 'var(--crm-gold)' : 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}>
          <option value="all">Score</option>
          <option value="high">Alto (70+)</option>
          <option value="medium">Médio (40-70)</option>
          <option value="low">Baixo (&lt;40)</option>
        </select>
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl text-[12px] font-medium focus:outline-none transition-all cursor-pointer"
            style={{ background: 'var(--crm-surface)', color: tagFilter ? 'var(--crm-gold)' : 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}>
            <option value="">Tags</option>
            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        )}
        <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl text-[12px] font-medium focus:outline-none transition-all cursor-pointer"
          style={{ background: 'var(--crm-surface)', color: periodFilter !== 'all' ? 'var(--crm-gold)' : 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}>
          <option value="all">Período</option>
          <option value="today">Hoje</option>
          <option value="7d">7 dias</option>
          <option value="30d">30 dias</option>
        </select>
        {hasActiveFilters && (
          <button onClick={() => { setSearchQuery(''); setScoreFilter('all'); setTagFilter(''); setPeriodFilter('all') }}
            className="px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all hover:brightness-125"
            style={{ color: 'var(--crm-hot)', background: 'rgba(255,107,74,0.06)', border: '1px solid rgba(255,107,74,0.12)' }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6 scrollbar-none">
          {[...stages].sort((a, b) => a.order - b.order).map((stage, index) => (
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
