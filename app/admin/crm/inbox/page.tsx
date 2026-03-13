'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCrmStream } from '@/hooks/use-crm-stream'
import { playFeedback } from '@/lib/crm-feedback'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

const QUICK_REPLIES = [
  'Olá! Como posso ajudar?',
  'Vou verificar e retorno em instantes.',
  'Posso agendar um horário para você?',
  'Obrigada pelo contato! 💛',
  'Qual procedimento tem interesse?',
]

// ━━━ Types ━━━

interface LeadInfo {
  id: string
  name: string
  phone: string
  email: string | null
  status: string
  aiScore: number | null
  expectedValue: number | null
  tags: string[]
  source: string | null
  stageId: string
  churnRisk: number | null
  bestContactDays: string | null
  bestContactHours: string | null
  lastInteractionAt: string | null
  createdAt: string
  stage: { name: string; color: string | null }
}

interface LastMessage {
  content: string
  fromMe: boolean
  type: string
  createdAt: string
}

interface ConversationItem {
  id: string
  remoteJid: string
  unreadCount: number
  lastMessageAt: string
  assignedToUserId: string | null
  channelType: string // whatsapp, instagram, facebook, telegram, email
  lead: LeadInfo
  lastMessage: LastMessage | null
}

interface MessageItem {
  id: string
  fromMe: boolean
  type: string
  content: string
  mediaMimeType: string | null
  mediaUrl: string | null
  isClinicalMedia: boolean
  status: string
  createdAt: string
}

interface StageInfo {
  id: string
  name: string
  type: string
  color: string | null
  order: number
}

// ━━━ Helpers ━━━

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' })
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000)

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday: 'long' })
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    HOT: '#FF6B4A', WARM: '#F0A500', COLD: '#4A7BFF', WON: '#2ECC8A', LOST: 'var(--crm-text-muted)',
  }
  return map[status] ?? 'var(--crm-text-muted)'
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    HOT: 'Quente', WARM: 'Morno', COLD: 'Frio', WON: 'Ganho', LOST: 'Perdido',
  }
  return map[status] ?? status
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 11) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 5)}****-${digits.slice(-4)}`
  }
  return phone
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len) + '…'
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// ━━━ Channel Config ━━━

const CHANNEL_ICONS: Record<string, { label: string; color: string; path: string }> = {
  whatsapp: {
    label: 'WhatsApp',
    color: '#25D366',
    path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  },
  instagram: {
    label: 'Instagram',
    color: '#E4405F',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  facebook: {
    label: 'Messenger',
    color: '#0084FF',
    path: 'M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.1l3.131 3.259L19.752 8.1l-6.559 6.863z',
  },
  telegram: {
    label: 'Telegram',
    color: '#229ED9',
    path: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  },
  email: {
    label: 'Email',
    color: '#7C6AEF',
    path: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  },
}

const CHANNEL_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Messenger' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'email', label: 'Email' },
]

function ChannelIcon({ channel, size = 12 }: { channel: string; size?: number }) {
  const cfg = CHANNEL_ICONS[channel]
  if (!cfg) return null

  // Email uses stroke-based SVG, others use fill
  if (channel === 'email') {
    return (
      <svg width={size} height={size} fill="none" stroke={cfg.color} strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={cfg.color}>
      <path d={cfg.path} />
    </svg>
  )
}

// ━━━ Skeleton ━━━

function InboxSkeleton() {
  return (
    <div className="flex h-[calc(100vh-10rem)] rounded-2xl overflow-hidden" style={{ border: '1px solid var(--crm-border)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
      <div className="w-80 border-r shrink-0" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}>
        <div className="p-3.5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <div className="h-9 rounded-lg animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3.5 border-b animate-pulse" style={{ borderColor: 'var(--crm-surface-2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full shrink-0" style={{ background: 'var(--crm-surface-2)' }} />
              <div className="flex-1 min-w-0">
                <div className="h-3.5 w-28 rounded mb-2" style={{ background: 'var(--crm-surface-2)' }} />
                <div className="h-3 w-40 rounded" style={{ background: 'var(--crm-surface-2)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--crm-bg)' }}>
        <EmptyChat />
      </div>
    </div>
  )
}

// ━━━ Empty States ━━━

function EmptyChat() {
  return (
    <div className="text-center opacity-40">
      <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(212,175,55,0.06)' }}>
        <svg width="36" height="36" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--crm-text-muted)' }}>Selecione uma conversa</p>
      <p className="text-xs mt-1.5" style={{ color: '#5A5A64' }}>As mensagens aparecerão aqui</p>
    </div>
  )
}

function EmptyConversations() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(212,175,55,0.06)' }}>
        <svg width="28" height="28" fill="none" stroke="#5A5A64" strokeWidth="1.2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--crm-text-muted)' }}>Nenhuma conversa</p>
      <p className="text-xs mt-1 text-center max-w-[200px]" style={{ color: '#5A5A64' }}>
        Conecte o WhatsApp em Integrações para começar
      </p>
    </div>
  )
}

// ━━━ Message Bubble ━━━

function MessageBubble({ message }: { message: MessageItem }) {
  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const statusIcon = message.fromMe ? (
    message.status === 'READ' ? (
      <span style={{ color: '#4A7BFF' }}>✓✓</span>
    ) : message.status === 'DELIVERED' ? (
      <span>✓✓</span>
    ) : message.status === 'SENT' ? (
      <span>✓</span>
    ) : message.status === 'SENDING' ? (
      <span className="animate-pulse">○</span>
    ) : null
  ) : null

  return (
    <div className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
        style={{
          background: message.fromMe
            ? 'linear-gradient(135deg, #D4AF37, #B8962E)'
            : 'var(--crm-surface-2)',
          color: message.fromMe ? 'var(--crm-bg)' : 'var(--crm-text)',
          borderBottomRightRadius: message.fromMe ? '4px' : '16px',
          borderBottomLeftRadius: message.fromMe ? '16px' : '4px',
          boxShadow: message.fromMe
            ? '0 2px 12px rgba(212,175,55,0.2)'
            : '0 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        {message.type === 'IMAGE' && message.mediaUrl && (
          <img src={message.mediaUrl} alt="" className="rounded-lg mb-1.5 max-h-52 object-cover" />
        )}
        {message.type === 'AUDIO' && (
          <div className="flex items-center gap-2 py-1">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: message.fromMe ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)' }}>
              <div className="h-full w-1/3 rounded-full" style={{ background: message.fromMe ? 'rgba(0,0,0,0.3)' : 'rgba(212,175,55,0.5)' }} />
            </div>
            <span className="text-[10px] opacity-60">Áudio</span>
          </div>
        )}
        {message.type === 'DOCUMENT' && (
          <div className="flex items-center gap-2 py-1">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><polyline points="14 2 14 8 20 8" /></svg>
            <span className="text-xs opacity-70">Documento</span>
          </div>
        )}
        {message.type === 'VIDEO' && (
          <div className="flex items-center gap-2 py-1">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            <span className="text-xs opacity-70">Vídeo</span>
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <span className={`text-[10px] flex items-center gap-1 mt-0.5 ${message.fromMe ? 'text-black/40 justify-end' : 'text-white/30'}`}>
          {time}
          {statusIcon}
        </span>
      </motion.div>
    </div>
  )
}

// ━━━ Day Separator ━━━

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ background: 'var(--crm-border)' }} />
      <span className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full" style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--crm-border)' }} />
    </div>
  )
}

// ━━━ Lead Panel (3rd column) ━━━

function LeadPanel({ lead, onClose, stages, onStageChange, isMovingStage, aiInsight, isLoadingInsight, convSummary, isLoadingSummary, scoreBreakdown }: {
  lead: LeadInfo
  onClose: () => void
  stages: StageInfo[]
  onStageChange: (leadId: string, fromStageId: string, toStageId: string) => void
  isMovingStage: boolean
  aiInsight: { insight: string; sentiment: string; engagementLevel: string; detectedIntents: string[] } | null
  isLoadingInsight: boolean
  convSummary: { summary: string; sentiment: string; sentimentLabel: string; topics: string[]; nextAction: string; buyingSignal: string } | null
  isLoadingSummary: boolean
  scoreBreakdown: { score: number; label: string; factors: Array<{ name: string; weight: number; score: number; label: string; detail: string }> } | null
}) {
  const statusColor = getStatusColor(lead.status)
  const [stageOpen, setStageOpen] = useState(false)
  const [scoreExpanded, setScoreExpanded] = useState(false)

  return (
    <div className="w-72 shrink-0 border-l flex flex-col overflow-y-auto crm-scroll"
      style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface)' }}
    >
      {/* Header */}
      <div className="p-4 border-b relative overflow-hidden" style={{ borderColor: 'var(--crm-border)' }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ background: `radial-gradient(circle at 50% 0%, ${statusColor}, transparent 70%)` }} />
        <div className="flex items-center justify-between mb-3 relative z-10">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Perfil do Lead</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--crm-text-muted)' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold"
              style={{ background: `${statusColor}18`, color: statusColor }}
            >
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: 'var(--crm-surface)', background: statusColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--crm-text)' }}>{lead.name}</p>
            <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>{maskPhone(lead.phone)}</p>
          </div>
        </div>
      </div>

      {/* Status & Stage Dropdown */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--crm-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Status</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${statusColor}18`, color: statusColor }}>
            {getStatusLabel(lead.status)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--crm-text-muted)' }}>
            Etapa do Funil
          </span>
          <div className="relative">
            <button
              onClick={() => setStageOpen(p => !p)}
              disabled={isMovingStage}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: 'var(--crm-surface-2)',
                border: `1px solid ${stageOpen ? 'var(--crm-gold)' : 'var(--crm-border)'}`,
                color: lead.stage.color ?? 'var(--crm-text)',
                boxShadow: stageOpen ? '0 0 0 1px rgba(212,175,55,0.2)' : 'none',
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: lead.stage.color ?? 'var(--crm-text-muted)' }} />
                <span className="truncate">{lead.stage.name}</span>
              </div>
              {isMovingStage ? (
                <div className="w-3 h-3 border rounded-full animate-spin shrink-0" style={{ borderColor: 'var(--crm-border)', borderTopColor: 'var(--crm-gold)' }} />
              ) : (
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0 transition-transform" style={{ transform: stageOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </button>
            <AnimatePresence>
              {stageOpen && stages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden shadow-2xl z-30"
                  style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', backdropFilter: 'blur(20px)' }}
                >
                  <div className="py-1.5 max-h-56 overflow-y-auto crm-scroll">
                    {stages.map(stage => {
                      const isActive = stage.id === lead.stageId
                      return (
                        <button
                          key={stage.id}
                          onClick={() => {
                            if (!isActive) onStageChange(lead.id, lead.stageId, stage.id)
                            setStageOpen(false)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all"
                          style={{
                            background: isActive ? 'rgba(212,175,55,0.06)' : 'transparent',
                            color: isActive ? 'var(--crm-gold)' : 'var(--crm-text)',
                          }}
                          onMouseEnter={e => { if (!isActive) (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { if (!isActive) (e.target as HTMLElement).style.background = 'transparent' }}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color ?? 'var(--crm-text-muted)' }} />
                          <span className="truncate font-medium">{stage.name}</span>
                          {stage.type === 'WON' && <span className="text-[9px] ml-auto shrink-0" style={{ color: 'var(--crm-won)' }}>Ganho</span>}
                          {stage.type === 'LOST' && <span className="text-[9px] ml-auto shrink-0" style={{ color: 'var(--crm-text-muted)' }}>Perdido</span>}
                          {isActive && (
                            <svg width="12" height="12" fill="none" stroke="var(--crm-gold)" strokeWidth="2.5" viewBox="0 0 24 24" className="ml-auto shrink-0">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4 border-b grid grid-cols-2 gap-2.5" style={{ borderColor: 'var(--crm-border)' }}>
        <button
          onClick={() => scoreBreakdown && setScoreExpanded(e => !e)}
          className="rounded-xl p-2.5 text-left transition-all"
          style={{
            background: scoreExpanded ? 'rgba(212,175,55,0.06)' : 'var(--crm-surface-2)',
            border: scoreExpanded ? '1px solid rgba(212,175,55,0.15)' : '1px solid transparent',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>AI Score</span>
            {scoreBreakdown && (
              <svg
                width="8" height="8" fill="none" stroke="var(--crm-text-muted)" strokeWidth="2" viewBox="0 0 24 24"
                style={{ transform: scoreExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </div>
          <span className="text-base font-bold block mt-1" style={{
            color: (scoreBreakdown?.score ?? lead.aiScore) != null
              ? ((scoreBreakdown?.score ?? lead.aiScore ?? 0) >= 70 ? 'var(--crm-won)' : (scoreBreakdown?.score ?? lead.aiScore ?? 0) >= 40 ? 'var(--crm-warm)' : 'var(--crm-hot)')
              : '#5A5A64'
          }}>
            {scoreBreakdown?.score ?? lead.aiScore ?? '—'}
            {scoreBreakdown?.label && (
              <span className="text-[9px] font-medium ml-1.5 opacity-70">{scoreBreakdown.label}</span>
            )}
          </span>
        </button>
        <div className="rounded-xl p-2.5" style={{ background: 'var(--crm-surface-2)' }}>
          <span className="text-[9px] uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Valor</span>
          <span className="text-sm font-bold" style={{ color: 'var(--crm-gold)' }}>
            {lead.expectedValue ? currencyFmt.format(lead.expectedValue) : '—'}
          </span>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: 'var(--crm-surface-2)' }}>
          <span className="text-[9px] uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Risco Churn</span>
          <span className="text-sm font-bold" style={{
            color: lead.churnRisk != null ? (lead.churnRisk >= 70 ? 'var(--crm-hot)' : lead.churnRisk >= 40 ? 'var(--crm-warm)' : 'var(--crm-won)') : '#5A5A64'
          }}>
            {lead.churnRisk != null ? `${lead.churnRisk}%` : '—'}
          </span>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: 'var(--crm-surface-2)' }}>
          <span className="text-[9px] uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>Fonte</span>
          <span className="text-xs font-medium truncate block" style={{ color: 'var(--crm-text)' }}>
            {lead.source ?? '—'}
          </span>
        </div>
      </div>

      {/* Score Breakdown */}
      <AnimatePresence>
        {scoreExpanded && scoreBreakdown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b overflow-hidden"
            style={{ borderColor: 'var(--crm-border)' }}
          >
            <div className="px-4 pb-4 space-y-2">
              {scoreBreakdown.factors.map(factor => (
                <div key={factor.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium" style={{ color: 'var(--crm-text)' }}>
                      {factor.name}
                      <span className="ml-1 opacity-50 text-[9px]">{Math.round(factor.weight * 100)}%</span>
                    </span>
                    <span className="text-[10px] font-bold tabular-nums" style={{
                      color: factor.score >= 70 ? 'var(--crm-won)' : factor.score >= 40 ? 'var(--crm-warm)' : 'var(--crm-hot)',
                    }}>
                      {factor.score}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--crm-surface-2)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${factor.score}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="h-full rounded-full"
                      style={{
                        background: factor.score >= 70
                          ? 'linear-gradient(90deg, #2ECC8A, #26A870)'
                          : factor.score >= 40
                            ? 'linear-gradient(90deg, #F0A500, #D49200)'
                            : 'linear-gradient(90deg, #FF6B4A, #E0553A)',
                      }}
                    />
                  </div>
                  <p className="text-[9px] leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
                    {factor.detail}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Golden Window */}
      {(lead.bestContactDays || lead.bestContactHours) && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <div className="rounded-xl p-3" style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)' }}>
            <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2" style={{ color: 'var(--crm-gold)' }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              Janela de Ouro
            </span>
            {lead.bestContactDays && (
              <p className="text-xs mb-0.5" style={{ color: 'var(--crm-text)' }}>
                <span style={{ color: 'var(--crm-text-muted)' }}>Dias: </span>{lead.bestContactDays}
              </p>
            )}
            {lead.bestContactHours && (
              <p className="text-xs" style={{ color: 'var(--crm-text)' }}>
                <span style={{ color: 'var(--crm-text-muted)' }}>Horário: </span>{lead.bestContactHours}
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Insight */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--crm-border)' }}>
        {isLoadingInsight ? (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(212,175,55,0.03)', border: '1px solid rgba(212,175,55,0.08)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded animate-pulse" style={{ background: 'rgba(212,175,55,0.2)' }} />
              <div className="w-20 h-2.5 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
            </div>
            <div className="w-full h-2 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
            <div className="w-3/4 h-2 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
          </div>
        ) : aiInsight ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-3 relative overflow-hidden"
            style={{
              background: aiInsight.sentiment === 'urgent'
                ? 'rgba(255,107,74,0.04)'
                : aiInsight.sentiment === 'positive'
                  ? 'rgba(46,204,138,0.04)'
                  : aiInsight.sentiment === 'negative'
                    ? 'rgba(255,107,74,0.04)'
                    : 'rgba(212,175,55,0.03)',
              border: `1px solid ${
                aiInsight.sentiment === 'urgent'
                  ? 'rgba(255,107,74,0.15)'
                  : aiInsight.sentiment === 'positive'
                    ? 'rgba(46,204,138,0.12)'
                    : aiInsight.sentiment === 'negative'
                      ? 'rgba(255,107,74,0.12)'
                      : 'rgba(212,175,55,0.08)'
              }`,
            }}
          >
            {/* Shimmer accent */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-[1px]"
              style={{
                background: aiInsight.sentiment === 'positive'
                  ? 'linear-gradient(90deg, transparent, rgba(46,204,138,0.4), transparent)'
                  : aiInsight.sentiment === 'urgent' || aiInsight.sentiment === 'negative'
                    ? 'linear-gradient(90deg, transparent, rgba(255,107,74,0.4), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)',
              }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />

            <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2" style={{
              color: aiInsight.sentiment === 'positive' ? 'var(--crm-won)'
                : aiInsight.sentiment === 'urgent' || aiInsight.sentiment === 'negative' ? 'var(--crm-hot)'
                : 'var(--crm-gold)',
            }}>
              <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
              Insight da IA
            </span>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--crm-text)' }}>
              {aiInsight.insight}
            </p>
            {aiInsight.detectedIntents.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {aiInsight.detectedIntents.map(intent => (
                  <span key={intent} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(212,175,55,0.08)', color: 'var(--crm-gold)' }}
                  >{intent}</span>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(139,138,148,0.04)', border: '1px solid var(--crm-border)' }}>
            <svg width="12" height="12" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
            <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Sem insight disponível</span>
          </div>
        )}
      </div>

      {/* Conversation Summary */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--crm-border)' }}>
        {isLoadingSummary ? (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(74,123,255,0.03)', border: '1px solid rgba(74,123,255,0.08)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded animate-pulse" style={{ background: 'rgba(74,123,255,0.2)' }} />
              <div className="w-24 h-2.5 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
            </div>
            <div className="w-full h-2 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
            <div className="w-2/3 h-2 rounded animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
          </div>
        ) : convSummary ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-3 space-y-2.5"
            style={{
              background: 'rgba(74,123,255,0.03)',
              border: '1px solid rgba(74,123,255,0.1)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--crm-cold)' }}>
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Resumo da Conversa
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{
                background: convSummary.sentiment === 'positive' ? 'rgba(46,204,138,0.1)'
                  : convSummary.sentiment === 'negative' ? 'rgba(255,107,74,0.1)'
                  : convSummary.sentiment === 'urgent' ? 'rgba(255,107,74,0.15)'
                  : 'rgba(139,138,148,0.1)',
                color: convSummary.sentiment === 'positive' ? '#2ECC8A'
                  : convSummary.sentiment === 'negative' || convSummary.sentiment === 'urgent' ? '#FF6B4A'
                  : 'var(--crm-text-muted)',
              }}>
                {convSummary.sentimentLabel}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--crm-text)' }}>
              {convSummary.summary}
            </p>

            {convSummary.topics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {convSummary.topics.map(topic => (
                  <span key={topic} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(74,123,255,0.08)', color: 'var(--crm-cold)' }}
                  >{topic}</span>
                ))}
              </div>
            )}

            {convSummary.nextAction && (
              <div className="flex items-start gap-1.5 pt-1 border-t" style={{ borderColor: 'rgba(74,123,255,0.08)' }}>
                <svg width="10" height="10" fill="none" stroke="var(--crm-gold)" strokeWidth="2" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="text-[10px] leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
                  {convSummary.nextAction}
                </span>
              </div>
            )}

            {convSummary.buyingSignal && convSummary.buyingSignal !== 'none' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-medium" style={{ color: 'var(--crm-text-muted)' }}>Sinal de compra:</span>
                <span className="text-[9px] font-bold" style={{
                  color: convSummary.buyingSignal === 'hot' ? 'var(--crm-hot)'
                    : convSummary.buyingSignal === 'warm' ? 'var(--crm-warm)'
                    : 'var(--crm-cold)',
                }}>
                  {convSummary.buyingSignal === 'hot' ? 'Forte' : convSummary.buyingSignal === 'warm' ? 'Moderado' : 'Fraco'}
                </span>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(139,138,148,0.04)', border: '1px solid var(--crm-border)' }}>
            <svg width="12" height="12" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Sem resumo disponível</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {lead.tags.length > 0 && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <span className="text-[9px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--crm-text-muted)' }}>Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {lead.tags.map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(212,175,55,0.08)', color: 'var(--crm-gold)' }}
              >{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-4 space-y-3">
        {lead.email && (
          <div>
            <span className="text-[9px] uppercase tracking-wider block mb-0.5" style={{ color: 'var(--crm-text-muted)' }}>E-mail</span>
            <span className="text-xs" style={{ color: 'var(--crm-text)' }}>{lead.email}</span>
          </div>
        )}
        <div>
          <span className="text-[9px] uppercase tracking-wider block mb-0.5" style={{ color: 'var(--crm-text-muted)' }}>Criado em</span>
          <span className="text-xs" style={{ color: 'var(--crm-text)' }}>
            {new Date(lead.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {lead.lastInteractionAt && (
          <div>
            <span className="text-[9px] uppercase tracking-wider block mb-0.5" style={{ color: 'var(--crm-text-muted)' }}>Última interação</span>
            <span className="text-xs" style={{ color: 'var(--crm-text)' }}>
              {new Date(lead.lastInteractionAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ━━━ Quick Replies Popover ━━━

// ━━━ Template Types ━━━

interface CrmTemplate {
  id: string
  type: 'whatsapp' | 'email'
  name: string
  category: string
  content: string
  variables: string[]
  isActive: boolean
}

function applyTemplateVariables(content: string, lead: LeadInfo | null, stage?: { name: string }): string {
  if (!lead) return content
  return content
    .replaceAll('{{nome}}', lead.name || '')
    .replaceAll('{{telefone}}', lead.phone || '')
    .replaceAll('{{email}}', lead.email || '')
    .replaceAll('{{estagio}}', stage?.name || lead.stage?.name || '')
    .replaceAll('{{pipeline}}', '')
    .replaceAll('{{valor}}', lead.expectedValue != null ? `R$ ${lead.expectedValue.toLocaleString('pt-BR')}` : '')
}

// ━━━ Template Picker Popover ━━━

function TemplatePicker({ templates, lead, onSelect, onClose }: {
  templates: CrmTemplate[]
  lead: LeadInfo | null
  onSelect: (text: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)

  const filtered = templates.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)
  })

  const categoryMap: Record<string, string> = {
    'boas-vindas': 'Boas-vindas', 'follow-up': 'Follow-up', 'cobranca': 'Cobrança',
    'confirmacao': 'Confirmação', 'pos-atendimento': 'Pós-atendimento',
    'lembrete': 'Lembrete', 'geral': 'Geral',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 mb-2 w-80 rounded-xl overflow-hidden shadow-2xl z-20"
      style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', backdropFilter: 'blur(20px)' }}
    >
      <div className="p-2.5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar modelo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px] focus:outline-none"
            style={{ background: 'var(--crm-surface)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-center py-4" style={{ color: 'var(--crm-text-muted)' }}>
            Nenhum modelo encontrado
          </p>
        ) : (
          filtered.map(t => {
            const preview = applyTemplateVariables(t.content, lead)
            const isHovered = previewId === t.id
            return (
              <button
                key={t.id}
                onClick={() => { onSelect(preview); onClose() }}
                onMouseEnter={() => setPreviewId(t.id)}
                onMouseLeave={() => setPreviewId(null)}
                className="w-full text-left px-2.5 py-2 rounded-lg transition-all hover:bg-white/5"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--crm-text)' }}>
                    {t.name}
                  </span>
                  <span className="text-[9px] px-1 py-0.5 rounded shrink-0" style={{ background: 'var(--crm-surface)', color: 'var(--crm-text-muted)' }}>
                    {categoryMap[t.category] ?? t.category}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
                  {isHovered
                    ? (preview.length > 120 ? preview.slice(0, 120) + '…' : preview)
                    : (t.content.length > 80 ? t.content.slice(0, 80) + '…' : t.content)
                  }
                </p>
              </button>
            )
          })
        )}
      </div>
    </motion.div>
  )
}

function QuickRepliesPopover({ onSelect, onClose }: { onSelect: (text: string) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 mb-2 w-72 rounded-xl overflow-hidden shadow-2xl z-20"
      style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', backdropFilter: 'blur(20px)' }}
    >
      <div className="p-2">
        <p className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5" style={{ color: 'var(--crm-text-muted)' }}>
          Respostas rápidas
        </p>
        {QUICK_REPLIES.map((text, i) => (
          <button
            key={i}
            onClick={() => { onSelect(text); onClose() }}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all hover:bg-white/5 hover:translate-x-0.5"
            style={{ color: 'var(--crm-text)' }}
          >
            {text}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ━━━ Main Inbox ━━━

export default function InboxPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [crmTemplates, setCrmTemplates] = useState<CrmTemplate[]>([])
  const [showLeadPanel, setShowLeadPanel] = useState(true)
  const [stages, setStages] = useState<StageInfo[]>([])
  const [isMovingStage, setIsMovingStage] = useState(false)
  const [aiInsight, setAiInsight] = useState<{ insight: string; sentiment: string; engagementLevel: string; detectedIntents: string[] } | null>(null)
  const [isLoadingInsight, setIsLoadingInsight] = useState(false)
  const [smartReplies, setSmartReplies] = useState<string[]>([])
  const [isLoadingSmartReplies, setIsLoadingSmartReplies] = useState(false)
  const [convSummary, setConvSummary] = useState<{
    summary: string; sentiment: string; sentimentLabel: string
    topics: string[]; nextAction: string; buyingSignal: string
  } | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [scoreBreakdown, setScoreBreakdown] = useState<{
    score: number; label: string
    factors: Array<{ name: string; weight: number; score: number; label: string; detail: string }>
  } | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesTopRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const addToast = useToastStore(s => s.addToast)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!token) return
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const channelParam = channelFilter ? `&channel=${channelFilter}` : ''
      const res = await fetch(`/api/admin/crm/conversations?tenantId=${TENANT_ID}${searchParam}${channelParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [token, search, channelFilter])

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/templates?tenantId=${TENANT_ID}&type=whatsapp`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setCrmTemplates((data.templates as CrmTemplate[]).filter(t => t.isActive))
    } catch {
      // silently fail
    }
  }, [token])

  // Fetch messages
  const fetchMessages = useCallback(async (conversationId: string, cursor?: string) => {
    if (!token) return
    if (!cursor) setIsLoadingMessages(true)
    else setIsLoadingMore(true)

    try {
      const cursorParam = cursor ? `&cursor=${cursor}` : ''
      const res = await fetch(`/api/admin/crm/conversations/messages?conversationId=${conversationId}${cursorParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()

      if (cursor) {
        setMessages(prev => [...data.messages, ...prev])
      } else {
        setMessages(data.messages)
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
      }
      setHasMore(data.hasMore)
      setNextCursor(data.nextCursor)
    } catch {
      // silently fail
    } finally {
      setIsLoadingMessages(false)
      setIsLoadingMore(false)
    }
  }, [token])

  // Fetch stages para o dropdown do Lead Panel
  const fetchStages = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/pipeline?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.stages) setStages(data.stages)
    } catch {
      // silently fail
    }
  }, [token])

  // Fetch AI insight for selected lead
  const fetchAiInsight = useCallback(async (leadId: string) => {
    if (!token) return
    setIsLoadingInsight(true)
    setAiInsight(null)
    try {
      const res = await fetch(`/api/admin/crm/ai/insight?leadId=${leadId}&tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.insight) setAiInsight(data)
    } catch {
      // Silencioso — insight é um bônus, não bloqueia UX
    } finally {
      setIsLoadingInsight(false)
    }
  }, [token])

  // Smart Replies — gera 3 sugestões curtas via IA
  const fetchSmartReplies = useCallback(async (convId: string) => {
    if (!token) return
    setIsLoadingSmartReplies(true)
    setSmartReplies([])
    try {
      const res = await fetch('/api/admin/crm/smart-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: convId, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (Array.isArray(data.suggestions)) setSmartReplies(data.suggestions)
    } catch {
      // Silencioso — smart replies são opcionais
    } finally {
      setIsLoadingSmartReplies(false)
    }
  }, [token])

  // Conversation summary — resumo automático via Gemini
  const fetchConvSummary = useCallback(async (convId: string) => {
    if (!token) return
    setIsLoadingSummary(true)
    setConvSummary(null)
    try {
      const res = await fetch(`/api/admin/crm/conversations/summary?conversationId=${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.summary) setConvSummary(data)
    } catch {
      // Silencioso
    } finally {
      setIsLoadingSummary(false)
    }
  }, [token])

  // Score breakdown — AI Score com explainability
  const fetchScoreBreakdown = useCallback(async (leadId: string) => {
    if (!token) return
    setScoreBreakdown(null)
    try {
      const res = await fetch(`/api/admin/crm/ai/score?leadId=${leadId}&tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.score !== undefined) setScoreBreakdown(data)
    } catch {
      // Silencioso
    }
  }, [token])

  useEffect(() => { fetchConversations(); fetchStages(); fetchTemplates() }, [fetchConversations, fetchStages, fetchTemplates])

  useEffect(() => {
    if (selectedId) {
      setMessages([])
      setHasMore(false)
      setNextCursor(null)
      fetchMessages(selectedId)

      // Buscar insight e score do lead selecionado
      const conv = conversations.find(c => c.id === selectedId)
      if (conv?.lead?.id) {
        fetchAiInsight(conv.lead.id)
        fetchScoreBreakdown(conv.lead.id)
      }

      // Gerar smart replies para a conversa
      setSmartReplies([])
      fetchSmartReplies(selectedId)

      // Gerar resumo da conversa
      fetchConvSummary(selectedId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, fetchMessages, fetchAiInsight, fetchSmartReplies, fetchConvSummary])

  // SSE: real-time updates — cirúrgico, sem refetch total
  useCrmStream(TENANT_ID, useCallback((event) => {
    if (event.type === 'new-message') {
      const { conversationId: convId, fromMe, content, messageType, messageId, leadId } = event.data as {
        conversationId: string; fromMe: boolean; content: string; messageType: string; messageId: string; leadId: string
      }

      // Só toca som se não é mensagem nossa (evita duplo feedback no envio)
      if (!fromMe) playFeedback('message')

      // Atualizar lista de conversas: reordenar e incrementar unread
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === convId)
        if (idx === -1) {
          // Nova conversa — precisamos buscar a lista completa
          fetchConversations()
          return prev
        }
        const updated = [...prev]
        const conv = { ...updated[idx] }
        conv.lastMessageAt = new Date().toISOString()
        conv.lastMessage = {
          content: content ?? '',
          fromMe,
          type: messageType ?? 'TEXT',
          createdAt: new Date().toISOString(),
        }
        if (!fromMe && convId !== selectedId) {
          conv.unreadCount = conv.unreadCount + 1
        }
        // Mover para o topo
        updated.splice(idx, 1)
        updated.unshift(conv)
        return updated
      })

      // Se é a conversa ativa, inserir a mensagem diretamente (sem refetch)
      if (convId === selectedId && !fromMe) {
        const newMsg: MessageItem = {
          id: messageId ?? `sse-${Date.now()}`,
          fromMe,
          type: messageType ?? 'TEXT',
          content: content ?? '',
          mediaMimeType: null,
          mediaUrl: null,
          isClinicalMedia: false,
          status: 'RECEIVED',
          createdAt: new Date().toISOString(),
        }
        setMessages(prev => {
          // Deduplicação
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

        // Atualizar smart replies com a nova mensagem
        fetchSmartReplies(convId)
      }
    }
  }, [fetchConversations, selectedId, fetchSmartReplies]))

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedId || isSending) return
    setIsSending(true)
    const content = newMessage
    setNewMessage('')
    setSmartReplies([])

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const optimisticMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      fromMe: true,
      type: 'TEXT',
      content,
      mediaMimeType: null,
      mediaUrl: null,
      isClinicalMedia: false,
      status: 'SENDING',
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const res = await fetch('/api/admin/crm/conversations/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: selectedId, content, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      await fetchMessages(selectedId)
      playFeedback('click')
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      addToast('Falha ao enviar mensagem', 'error')
    } finally {
      setIsSending(false)
    }
  }

  // Move lead to different stage
  const handleStageChange = async (leadId: string, fromStageId: string, toStageId: string) => {
    if (fromStageId === toStageId || isMovingStage) return
    setIsMovingStage(true)

    // Otimista: atualizar lead no estado local
    const destStage = stages.find(s => s.id === toStageId)
    if (destStage) {
      setConversations(prev => prev.map(c =>
        c.lead.id === leadId
          ? { ...c, lead: { ...c.lead, stageId: toStageId, stage: { name: destStage.name, color: destStage.color } } }
          : c
      ))
    }

    try {
      const res = await fetch('/api/admin/crm/leads/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId, fromStageId, toStageId, position: 1.0, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      addToast('Estágio atualizado', 'success')
      playFeedback('drop')
    } catch {
      // Reverter otimista
      const origStage = stages.find(s => s.id === fromStageId)
      if (origStage) {
        setConversations(prev => prev.map(c =>
          c.lead.id === leadId
            ? { ...c, lead: { ...c.lead, stageId: fromStageId, stage: { name: origStage.name, color: origStage.color } } }
            : c
        ))
      }
      addToast('Falha ao mover estágio', 'error')
    } finally {
      setIsMovingStage(false)
    }
  }

  // Concierge RAG
  const handleConcierge = async () => {
    if (!selectedId || isGenerating) return
    setIsGenerating(true)
    try {
      const res = await fetch('/api/admin/crm/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: selectedId, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNewMessage(data.reply)
      // Auto-resize textarea e focar para edição
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(data.reply.length, data.reply.length)
        }
      }, 50)
      playFeedback('click')
      addToast('Sugestão da IA pronta — revise e envie', 'info')
    } catch {
      addToast('Concierge indisponível', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current || !hasMore || isLoadingMore || !selectedId) return
    if (chatContainerRef.current.scrollTop < 60) {
      fetchMessages(selectedId, nextCursor ?? undefined)
    }
  }, [hasMore, isLoadingMore, selectedId, nextCursor, fetchMessages])

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const selectedConv = conversations.find(c => c.id === selectedId)

  // Group messages by day
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: MessageItem[] }[] = []
    let currentDate = ''

    for (const msg of messages) {
      const msgDate = new Date(msg.createdAt)
      const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`
      if (dateKey !== currentDate) {
        currentDate = dateKey
        groups.push({ date: msg.createdAt, messages: [msg] })
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    }
    return groups
  }, [messages])

  // Total unread badge
  const totalUnread = useMemo(() =>
    conversations.reduce((sum, c) => sum + c.unreadCount, 0)
  , [conversations])

  if (isLoading) return <InboxSkeleton />

  return (
    <div className="flex h-[calc(100vh-10rem)] rounded-2xl overflow-hidden" style={{ border: '1px solid var(--crm-border)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>

      {/* ━━━ Column 1: Conversation List ━━━ */}
      <div
        className="w-full sm:w-80 shrink-0 border-r flex flex-col"
        style={{
          borderColor: 'var(--crm-border)',
          background: 'var(--crm-surface)',
          display: selectedId && typeof window !== 'undefined' && window.innerWidth < 640 ? 'none' : 'flex',
        }}
      >
        {/* Search Header */}
        <div className="p-3.5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--crm-text)' }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-gold)' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Conversas
              {totalUnread > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'var(--crm-gold)', color: 'var(--crm-bg)' }}
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </h2>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" fill="none" stroke="var(--crm-text-muted)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl transition-all focus:outline-none focus:ring-1"
              style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/5 transition-colors"
                style={{ color: 'var(--crm-text-muted)' }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Channel Filter */}
          <div className="flex gap-1 mt-2.5 overflow-x-auto crm-scroll pb-0.5">
            {CHANNEL_FILTERS.map(f => {
              const isActive = channelFilter === f.key
              const cfg = f.key ? CHANNEL_ICONS[f.key] : null
              return (
                <button
                  key={f.key}
                  onClick={() => setChannelFilter(f.key)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all shrink-0"
                  style={{
                    background: isActive
                      ? (cfg ? `${cfg.color}18` : 'rgba(212,175,55,0.12)')
                      : 'transparent',
                    color: isActive
                      ? (cfg?.color ?? 'var(--crm-gold)')
                      : 'var(--crm-text-muted)',
                    border: isActive
                      ? `1px solid ${cfg?.color ?? 'var(--crm-gold)'}30`
                      : '1px solid transparent',
                  }}
                >
                  {cfg && <ChannelIcon channel={f.key} size={10} />}
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            search ? (
              <div className="flex flex-col items-center py-16 opacity-50">
                <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Nenhum resultado para &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <EmptyConversations />
            )
          ) : (
            conversations.map(conv => {
              const isActive = conv.id === selectedId
              const statusColor = getStatusColor(conv.lead.status)

              return (
                <motion.button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className="w-full text-left px-3.5 py-3 border-b transition-all"
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.1 }}
                  style={{
                    borderColor: 'var(--crm-surface-2)',
                    background: isActive ? 'rgba(212,175,55,0.06)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--crm-gold)' : '2px solid transparent',
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar + Channel Badge */}
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: `${statusColor}18`, color: statusColor }}
                      >
                        {conv.lead.name.charAt(0).toUpperCase()}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-lg"
                          style={{ background: 'var(--crm-gold)', color: 'var(--crm-bg)', minWidth: '18px', height: '18px' }}
                        >
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                      {/* Channel icon badge */}
                      <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full flex items-center justify-center border-[1.5px]"
                        style={{
                          borderColor: 'var(--crm-surface)',
                          background: CHANNEL_ICONS[conv.channelType]?.color ? `${CHANNEL_ICONS[conv.channelType].color}20` : 'var(--crm-surface-2)',
                        }}
                        title={CHANNEL_ICONS[conv.channelType]?.label ?? conv.channelType}
                      >
                        <ChannelIcon channel={conv.channelType} size={8} />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ borderColor: 'var(--crm-surface)', background: statusColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--crm-text)' }}>
                          {conv.lead.name}
                        </span>
                        <span className="text-[10px] shrink-0 ml-2 font-medium" style={{ color: conv.unreadCount > 0 ? 'var(--crm-gold)' : 'var(--crm-text-muted)' }}>
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--crm-text-muted)', fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>
                        {conv.lastMessage ? (
                          <>
                            {conv.lastMessage.fromMe && <span style={{ color: '#5A5A64' }}>Você: </span>}
                            {conv.lastMessage.type !== 'TEXT'
                              ? conv.lastMessage.type === 'IMAGE' ? '📷 Foto'
                                : conv.lastMessage.type === 'AUDIO' ? '🎤 Áudio'
                                : conv.lastMessage.type === 'VIDEO' ? '🎥 Vídeo'
                                : conv.lastMessage.type === 'DOCUMENT' ? '📎 Documento'
                                : truncate(conv.lastMessage.content, 40)
                              : truncate(conv.lastMessage.content, 40)
                            }
                          </>
                        ) : (
                          <span style={{ color: '#5A5A64' }}>Sem mensagens</span>
                        )}
                      </p>
                      {conv.lead.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {conv.lead.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: 'rgba(212,175,55,0.06)', color: 'var(--crm-gold)' }}
                            >{tag}</span>
                          ))}
                          {conv.lead.tags.length > 2 && (
                            <span className="text-[9px] px-1 py-0.5" style={{ color: '#5A5A64' }}>
                              +{conv.lead.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              )
            })
          )}
        </div>
      </div>

      {/* ━━━ Column 2: Chat ━━━ */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--crm-bg)' }}>
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyChat />
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0"
              style={{
                borderColor: 'var(--crm-border)',
                background: 'rgba(17,17,20,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSelectedId(null)}
                  className="sm:hidden p-1"
                  style={{ color: 'var(--crm-text-muted)' }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div className="relative">
                  <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
                    style={{ background: `${getStatusColor(selectedConv?.lead.status ?? '')}18`, color: getStatusColor(selectedConv?.lead.status ?? '') }}
                  >
                    {selectedConv?.lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px]"
                    style={{ borderColor: 'rgba(17,17,20,0.92)', background: getStatusColor(selectedConv?.lead.status ?? '') }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--crm-text)' }}>{selectedConv?.lead.name}</p>
                  <div className="flex items-center gap-2">
                    {selectedConv && (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          background: `${CHANNEL_ICONS[selectedConv.channelType]?.color ?? '#888'}12`,
                          color: CHANNEL_ICONS[selectedConv.channelType]?.color ?? 'var(--crm-text-muted)',
                        }}
                      >
                        <ChannelIcon channel={selectedConv.channelType} size={9} />
                        {CHANNEL_ICONS[selectedConv.channelType]?.label ?? selectedConv.channelType}
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>{selectedConv?.lead.phone}</span>
                    {selectedConv?.lead.stage && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${selectedConv.lead.stage.color ?? 'var(--crm-text-muted)'}18`, color: selectedConv.lead.stage.color ?? 'var(--crm-text-muted)' }}
                      >
                        {selectedConv.lead.stage.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedConv?.lead.aiScore != null && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(212,175,55,0.08)', color: 'var(--crm-gold)' }}
                  >
                    ★ {selectedConv.lead.aiScore}
                  </span>
                )}
                {selectedConv?.lead.expectedValue != null && selectedConv.lead.expectedValue > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-lg hidden md:inline-block"
                    style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-gold)' }}
                  >
                    {currencyFmt.format(selectedConv.lead.expectedValue)}
                  </span>
                )}
                <button
                  onClick={() => setShowLeadPanel(p => !p)}
                  className="p-2 rounded-lg transition-all hidden lg:block"
                  style={{
                    background: showLeadPanel ? 'rgba(212,175,55,0.08)' : 'transparent',
                    color: showLeadPanel ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                  }}
                  title="Painel do lead"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-4 py-3"
              onScroll={handleScroll}
            >
              {isLoadingMore && (
                <div className="flex justify-center py-3">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--crm-border)', borderTopColor: 'var(--crm-gold)' }}
                  />
                </div>
              )}
              {hasMore && !isLoadingMore && (
                <div ref={messagesTopRef} className="h-1" />
              )}

              {isLoadingMessages ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--crm-border)', borderTopColor: 'var(--crm-gold)' }}
                  />
                  <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Carregando mensagens...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(212,175,55,0.04)' }}>
                    <svg width="24" height="24" fill="none" stroke="#5A5A64" strokeWidth="1" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium" style={{ color: '#5A5A64' }}>Início da conversa</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {groupedMessages.map((group, gi) => (
                    <div key={gi}>
                      <DaySeparator label={formatDateGroup(group.date)} />
                      {group.messages.map((msg) => (
                        <MessageBubble key={msg.id} message={msg} />
                      ))}
                    </div>
                  ))}
                </AnimatePresence>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t shrink-0" style={{
              borderColor: 'var(--crm-border)',
              background: 'rgba(17,17,20,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}>
              {/* Smart Reply Chips */}
              <AnimatePresence>
                {(smartReplies.length > 0 || isLoadingSmartReplies) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-3.5 pt-2.5 pb-0"
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <svg width="12" height="12" fill="var(--crm-gold)" viewBox="0 0 24 24" className="shrink-0 opacity-60">
                        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                      </svg>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--crm-text-muted)' }}>
                        Sugestões IA
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {isLoadingSmartReplies ? (
                        <>
                          {[1, 2, 3].map(i => (
                            <div
                              key={i}
                              className="h-7 rounded-lg animate-pulse"
                              style={{ background: 'var(--crm-surface-2)', width: `${60 + i * 20}px` }}
                            />
                          ))}
                        </>
                      ) : (
                        smartReplies.map((reply, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.08, type: 'spring', stiffness: 400, damping: 25 }}
                            onClick={() => {
                              setNewMessage(reply)
                              setSmartReplies([])
                              playFeedback('click')
                              setTimeout(() => {
                                if (textareaRef.current) {
                                  textareaRef.current.style.height = 'auto'
                                  textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
                                  textareaRef.current.focus()
                                }
                              }, 50)
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-125 active:scale-95 cursor-pointer max-w-60 truncate"
                            style={{
                              background: 'rgba(212,175,55,0.06)',
                              border: '1px solid rgba(212,175,55,0.15)',
                              color: 'var(--crm-text)',
                            }}
                            whileHover={{ borderColor: 'rgba(212,175,55,0.35)' }}
                            title={reply}
                          >
                            {reply}
                          </motion.button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-3.5">
              <div className="flex items-end gap-2 relative">
                <AnimatePresence>
                  {showQuickReplies && (
                    <QuickRepliesPopover
                      onSelect={(text) => setNewMessage(text)}
                      onClose={() => setShowQuickReplies(false)}
                    />
                  )}
                  {showTemplates && crmTemplates.length > 0 && (
                    <TemplatePicker
                      templates={crmTemplates}
                      lead={selectedConv?.lead ?? null}
                      onSelect={(text) => setNewMessage(text)}
                      onClose={() => setShowTemplates(false)}
                    />
                  )}
                </AnimatePresence>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => { setShowQuickReplies(p => !p); setShowTemplates(false) }}
                    className="p-2.5 rounded-xl transition-all"
                    style={{ background: showQuickReplies ? 'rgba(212,175,55,0.12)' : 'var(--crm-surface-2)', color: showQuickReplies ? 'var(--crm-gold)' : 'var(--crm-text-muted)' }}
                    title="Respostas rápidas"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="12" y2="13" />
                    </svg>
                  </button>

                  {crmTemplates.length > 0 && (
                    <button
                      onClick={() => { setShowTemplates(p => !p); setShowQuickReplies(false) }}
                      className="p-2.5 rounded-xl transition-all"
                      style={{ background: showTemplates ? 'rgba(212,175,55,0.12)' : 'var(--crm-surface-2)', color: showTemplates ? 'var(--crm-gold)' : 'var(--crm-text-muted)' }}
                      title="Usar modelo"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </button>
                  )}

                  <motion.button
                    onClick={handleConcierge}
                    disabled={isGenerating}
                    className="relative p-2.5 rounded-xl transition-all disabled:cursor-wait group overflow-hidden"
                    style={{
                      background: isGenerating
                        ? 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,150,46,0.1))'
                        : 'rgba(212,175,55,0.08)',
                      color: 'var(--crm-gold)',
                      boxShadow: isGenerating ? '0 0 16px rgba(212,175,55,0.15)' : 'none',
                    }}
                    whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(212,175,55,0.2)' }}
                    whileTap={{ scale: 0.92 }}
                    title="Concierge IA — gerar sugestão de resposta"
                  >
                    {/* Shimmer sweep enquanto gera */}
                    {isGenerating && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.12) 50%, transparent 100%)',
                        }}
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    {isGenerating ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                          <path d="M12 3V6M12 18V21M6 12H3M21 12H18M5.636 5.636L7.758 7.758M16.242 16.242L18.364 18.364M5.636 18.364L7.758 16.242M16.242 7.758L18.364 5.636" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                    ) : (
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                        <path d="M20 3v4M22 5h-4" opacity="0.6" />
                      </svg>
                    )}
                  </motion.button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Digite uma mensagem..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all"
                  style={{
                    background: 'var(--crm-surface-2)',
                    color: 'var(--crm-text)',
                    border: '1px solid var(--crm-border)',
                    maxHeight: '120px',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                  }}
                />

                <motion.button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || isSending}
                  className="shrink-0 p-2.5 rounded-xl transition-all disabled:opacity-30"
                  whileTap={{ scale: 0.94 }}
                  style={{
                    background: newMessage.trim() ? 'linear-gradient(135deg, #D4AF37, #B8962E)' : 'var(--crm-surface-2)',
                    color: newMessage.trim() ? 'var(--crm-bg)' : 'var(--crm-text-muted)',
                    boxShadow: newMessage.trim() ? '0 2px 12px rgba(212,175,55,0.25)' : 'none',
                  }}
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'var(--crm-bg)', borderTopColor: 'transparent' }}
                    />
                  ) : (
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </motion.button>
              </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ━━━ Column 3: Lead Panel ━━━ */}
      {selectedConv && showLeadPanel && (
        <div className="hidden lg:block">
          <LeadPanel
            lead={selectedConv.lead}
            onClose={() => setShowLeadPanel(false)}
            stages={stages}
            onStageChange={handleStageChange}
            isMovingStage={isMovingStage}
            aiInsight={aiInsight}
            isLoadingInsight={isLoadingInsight}
            convSummary={convSummary}
            isLoadingSummary={isLoadingSummary}
            scoreBreakdown={scoreBreakdown}
          />
        </div>
      )}
    </div>
  )
}
