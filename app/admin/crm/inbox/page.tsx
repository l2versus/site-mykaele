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
    HOT: '#FF6B4A', WARM: '#F0A500', COLD: '#4A7BFF', WON: '#2ECC8A', LOST: '#8B8A94',
  }
  return map[status] ?? '#8B8A94'
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

// ━━━ Skeleton ━━━

function InboxSkeleton() {
  return (
    <div className="flex h-[calc(100vh-10rem)] rounded-xl overflow-hidden" style={{ border: '1px solid #2A2A32' }}>
      <div className="w-80 border-r shrink-0" style={{ borderColor: '#2A2A32', background: '#111114' }}>
        <div className="p-3 border-b" style={{ borderColor: '#2A2A32' }}>
          <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1A1A1F' }} />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 border-b animate-pulse" style={{ borderColor: '#1A1A1F' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full shrink-0" style={{ background: '#1A1A1F' }} />
              <div className="flex-1 min-w-0">
                <div className="h-3.5 w-28 rounded mb-2" style={{ background: '#1A1A1F' }} />
                <div className="h-3 w-40 rounded" style={{ background: '#1A1A1F' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center" style={{ background: '#0A0A0B' }}>
        <EmptyChat />
      </div>
    </div>
  )
}

// ━━━ Empty States ━━━

function EmptyChat() {
  return (
    <div className="text-center opacity-40">
      <svg width="56" height="56" fill="none" stroke="#8B8A94" strokeWidth="1" viewBox="0 0 24 24" className="mx-auto">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <p className="text-sm mt-3" style={{ color: '#8B8A94' }}>Selecione uma conversa</p>
      <p className="text-xs mt-1" style={{ color: '#5A5A64' }}>As mensagens aparecerão aqui</p>
    </div>
  )
}

function EmptyConversations() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <svg width="40" height="40" fill="none" stroke="#5A5A64" strokeWidth="1" viewBox="0 0 24 24" className="mb-3">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <p className="text-sm font-medium" style={{ color: '#8B8A94' }}>Nenhuma conversa</p>
      <p className="text-xs mt-1 text-center" style={{ color: '#5A5A64' }}>
        Conecte o WhatsApp em<br />Integrações para começar
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
      <div
        className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
        style={{
          background: message.fromMe ? '#D4AF37' : '#1A1A1F',
          color: message.fromMe ? '#0A0A0B' : '#F0EDE8',
          borderBottomRightRadius: message.fromMe ? '4px' : '16px',
          borderBottomLeftRadius: message.fromMe ? '16px' : '4px',
        }}
      >
        {message.type === 'IMAGE' && message.mediaUrl && (
          <img src={message.mediaUrl} alt="" className="rounded-lg mb-1.5 max-h-52 object-cover" />
        )}
        {message.type === 'AUDIO' && (
          <div className="flex items-center gap-2 py-1">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            <div className="flex-1 h-1 rounded-full" style={{ background: message.fromMe ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)' }} />
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
      </div>
    </div>
  )
}

// ━━━ Day Separator ━━━

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px" style={{ background: '#2A2A32' }} />
      <span className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#1A1A1F', color: '#8B8A94' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: '#2A2A32' }} />
    </div>
  )
}

// ━━━ Lead Panel (3rd column) ━━━

function LeadPanel({ lead, onClose }: { lead: LeadInfo; onClose: () => void }) {
  const statusColor = getStatusColor(lead.status)

  return (
    <div className="w-72 shrink-0 border-l flex flex-col overflow-y-auto"
      style={{ borderColor: '#2A2A32', background: '#111114' }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: '#2A2A32' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium" style={{ color: '#8B8A94' }}>Perfil do Lead</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: '#8B8A94' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold"
            style={{ background: `${statusColor}18`, color: statusColor }}
          >
            {lead.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#F0EDE8' }}>{lead.name}</p>
            <p className="text-xs" style={{ color: '#8B8A94' }}>{maskPhone(lead.phone)}</p>
          </div>
        </div>
      </div>

      {/* Status & Stage */}
      <div className="p-4 border-b" style={{ borderColor: '#2A2A32' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8B8A94' }}>Status</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${statusColor}18`, color: statusColor }}>
            {getStatusLabel(lead.status)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8B8A94' }}>Etapa</span>
          <span className="text-xs font-medium" style={{ color: lead.stage.color ?? '#F0EDE8' }}>
            {lead.stage.name}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4 border-b grid grid-cols-2 gap-3" style={{ borderColor: '#2A2A32' }}>
        {/* AI Score */}
        <div className="rounded-lg p-2.5" style={{ background: '#1A1A1F' }}>
          <span className="text-[10px] block mb-1" style={{ color: '#8B8A94' }}>AI Score</span>
          <span className="text-base font-bold" style={{
            color: lead.aiScore != null ? (lead.aiScore >= 70 ? '#2ECC8A' : lead.aiScore >= 40 ? '#F0A500' : '#FF6B4A') : '#5A5A64'
          }}>
            {lead.aiScore != null ? lead.aiScore : '—'}
          </span>
        </div>
        {/* Value */}
        <div className="rounded-lg p-2.5" style={{ background: '#1A1A1F' }}>
          <span className="text-[10px] block mb-1" style={{ color: '#8B8A94' }}>Valor</span>
          <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>
            {lead.expectedValue ? currencyFmt.format(lead.expectedValue) : '—'}
          </span>
        </div>
        {/* Churn Risk */}
        <div className="rounded-lg p-2.5" style={{ background: '#1A1A1F' }}>
          <span className="text-[10px] block mb-1" style={{ color: '#8B8A94' }}>Risco Churn</span>
          <span className="text-sm font-bold" style={{
            color: lead.churnRisk != null ? (lead.churnRisk >= 70 ? '#FF6B4A' : lead.churnRisk >= 40 ? '#F0A500' : '#2ECC8A') : '#5A5A64'
          }}>
            {lead.churnRisk != null ? `${lead.churnRisk}%` : '—'}
          </span>
        </div>
        {/* Source */}
        <div className="rounded-lg p-2.5" style={{ background: '#1A1A1F' }}>
          <span className="text-[10px] block mb-1" style={{ color: '#8B8A94' }}>Fonte</span>
          <span className="text-xs font-medium truncate block" style={{ color: '#F0EDE8' }}>
            {lead.source ?? '—'}
          </span>
        </div>
      </div>

      {/* Golden Window */}
      {(lead.bestContactDays || lead.bestContactHours) && (
        <div className="p-4 border-b" style={{ borderColor: '#2A2A32' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: '#D4AF37' }}>
            Janela de Ouro
          </span>
          {lead.bestContactDays && (
            <p className="text-xs mb-1" style={{ color: '#F0EDE8' }}>
              <span style={{ color: '#8B8A94' }}>Dias: </span>{lead.bestContactDays}
            </p>
          )}
          {lead.bestContactHours && (
            <p className="text-xs" style={{ color: '#F0EDE8' }}>
              <span style={{ color: '#8B8A94' }}>Horário: </span>{lead.bestContactHours}
            </p>
          )}
        </div>
      )}

      {/* Tags */}
      {lead.tags.length > 0 && (
        <div className="p-4 border-b" style={{ borderColor: '#2A2A32' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: '#8B8A94' }}>Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {lead.tags.map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
              >{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-4">
        {lead.email && (
          <div className="mb-2">
            <span className="text-[10px] block" style={{ color: '#8B8A94' }}>E-mail</span>
            <span className="text-xs" style={{ color: '#F0EDE8' }}>{lead.email}</span>
          </div>
        )}
        <div className="mb-2">
          <span className="text-[10px] block" style={{ color: '#8B8A94' }}>Criado em</span>
          <span className="text-xs" style={{ color: '#F0EDE8' }}>
            {new Date(lead.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {lead.lastInteractionAt && (
          <div>
            <span className="text-[10px] block" style={{ color: '#8B8A94' }}>Última interação</span>
            <span className="text-xs" style={{ color: '#F0EDE8' }}>
              {new Date(lead.lastInteractionAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ━━━ Quick Replies Popover ━━━

function QuickRepliesPopover({ onSelect, onClose }: { onSelect: (text: string) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="absolute bottom-full left-0 mb-2 w-72 rounded-xl overflow-hidden shadow-2xl z-20"
      style={{ background: '#1A1A1F', border: '1px solid #2A2A32' }}
    >
      <div className="p-2">
        <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5" style={{ color: '#8B8A94' }}>
          Respostas rápidas
        </p>
        {QUICK_REPLIES.map((text, i) => (
          <button
            key={i}
            onClick={() => { onSelect(text); onClose() }}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors hover:bg-white/5"
            style={{ color: '#F0EDE8' }}
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
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [showLeadPanel, setShowLeadPanel] = useState(true)
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
      const res = await fetch(`/api/admin/crm/conversations?tenantId=${TENANT_ID}${searchParam}`, {
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
  }, [token, search])

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
        // Prepend older messages
        setMessages(prev => [...data.messages, ...prev])
      } else {
        setMessages(data.messages)
        // Scroll to bottom on initial load
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

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    if (selectedId) {
      setMessages([])
      setHasMore(false)
      setNextCursor(null)
      fetchMessages(selectedId)
    }
  }, [selectedId, fetchMessages])

  // SSE: real-time updates
  useCrmStream(TENANT_ID, useCallback((event) => {
    if (event.type === 'new-message') {
      playFeedback('message')
      fetchConversations()
      const convId = event.data.conversationId as string
      if (convId === selectedId) {
        fetchMessages(convId)
      }
    }
  }, [fetchConversations, fetchMessages, selectedId]))

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedId || isSending) return
    setIsSending(true)
    const content = newMessage
    setNewMessage('')

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Optimistic add
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
      addToast('Sugestão gerada pela IA', 'info')
    } catch {
      addToast('Concierge indisponível', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Infinite scroll (load older messages)
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
    <div className="flex h-[calc(100vh-10rem)] rounded-xl overflow-hidden" style={{ border: '1px solid #2A2A32' }}>

      {/* ━━━ Column 1: Conversation List ━━━ */}
      <div
        className="w-full sm:w-80 shrink-0 border-r flex flex-col"
        style={{
          borderColor: '#2A2A32',
          background: '#111114',
          display: selectedId && typeof window !== 'undefined' && window.innerWidth < 640 ? 'none' : 'flex',
        }}
      >
        {/* Search Header */}
        <div className="p-3 border-b" style={{ borderColor: '#2A2A32' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold" style={{ color: '#F0EDE8' }}>
              Conversas
              {totalUnread > 0 && (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#D4AF37', color: '#0A0A0B' }}
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </h2>
          </div>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" fill="none" stroke="#8B8A94" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg focus:outline-none"
              style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: '#8B8A94' }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            search ? (
              <div className="flex flex-col items-center py-16 opacity-50">
                <p className="text-xs" style={{ color: '#8B8A94' }}>Nenhum resultado para &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <EmptyConversations />
            )
          ) : (
            conversations.map(conv => {
              const isActive = conv.id === selectedId
              const statusColor = getStatusColor(conv.lead.status)

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className="w-full text-left px-3 py-3 border-b transition-colors"
                  style={{
                    borderColor: '#1A1A1F',
                    background: isActive ? 'rgba(212,175,55,0.06)' : 'transparent',
                    borderLeft: isActive ? '2px solid #D4AF37' : '2px solid transparent',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold relative"
                      style={{ background: `${statusColor}18`, color: statusColor }}
                    >
                      {conv.lead.name.charAt(0).toUpperCase()}
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                          style={{ background: '#D4AF37', color: '#0A0A0B' }}
                        >
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>
                          {conv.lead.name}
                        </span>
                        <span className="text-[10px] shrink-0 ml-2" style={{ color: conv.unreadCount > 0 ? '#D4AF37' : '#8B8A94' }}>
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      {/* Last message preview */}
                      <p className="text-xs truncate" style={{ color: '#8B8A94', fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>
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
                      {/* Tags */}
                      {conv.lead.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {conv.lead.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(212,175,55,0.08)', color: '#D4AF37' }}
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
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ━━━ Column 2: Chat ━━━ */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: '#0A0A0B' }}>
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyChat />
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0"
              style={{ borderColor: '#2A2A32', background: '#111114' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="sm:hidden p-1"
                  style={{ color: '#8B8A94' }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{ background: `${getStatusColor(selectedConv?.lead.status ?? '')}18`, color: getStatusColor(selectedConv?.lead.status ?? '') }}
                >
                  {selectedConv?.lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>{selectedConv?.lead.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]" style={{ color: '#8B8A94' }}>{selectedConv?.lead.phone}</span>
                    {selectedConv?.lead.stage && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: `${selectedConv.lead.stage.color ?? '#8B8A94'}18`, color: selectedConv.lead.stage.color ?? '#8B8A94' }}
                      >
                        {selectedConv.lead.stage.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedConv?.lead.aiScore != null && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded"
                    style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}
                  >
                    ★ {selectedConv.lead.aiScore}
                  </span>
                )}
                {selectedConv?.lead.expectedValue != null && selectedConv.lead.expectedValue > 0 && (
                  <span className="text-[10px] font-medium px-2 py-1 rounded hidden md:inline-block"
                    style={{ background: '#1A1A1F', color: '#D4AF37' }}
                  >
                    {currencyFmt.format(selectedConv.lead.expectedValue)}
                  </span>
                )}
                {/* Toggle lead panel */}
                <button
                  onClick={() => setShowLeadPanel(p => !p)}
                  className="p-1.5 rounded-lg transition-colors hidden lg:block"
                  style={{ background: showLeadPanel ? 'rgba(212,175,55,0.1)' : 'transparent', color: showLeadPanel ? '#D4AF37' : '#8B8A94' }}
                  title="Painel do lead"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
              {/* Load more indicator */}
              {isLoadingMore && (
                <div className="flex justify-center py-3">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#2A2A32', borderTopColor: '#D4AF37' }}
                  />
                </div>
              )}
              {hasMore && !isLoadingMore && (
                <div ref={messagesTopRef} className="h-1" />
              )}

              {isLoadingMessages ? (
                <div className="flex-1 flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#2A2A32', borderTopColor: '#D4AF37' }}
                  />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                  <svg width="32" height="32" fill="none" stroke="#5A5A64" strokeWidth="1" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-xs mt-2" style={{ color: '#5A5A64' }}>Início da conversa</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {groupedMessages.map((group, gi) => (
                    <div key={gi}>
                      <DaySeparator label={formatDateGroup(group.date)} />
                      {group.messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.15 }}
                        >
                          <MessageBubble message={msg} />
                        </motion.div>
                      ))}
                    </div>
                  ))}
                </AnimatePresence>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t shrink-0" style={{ borderColor: '#2A2A32', background: '#111114' }}>
              <div className="flex items-end gap-2 relative">
                {/* Quick Replies */}
                <AnimatePresence>
                  {showQuickReplies && (
                    <QuickRepliesPopover
                      onSelect={(text) => setNewMessage(text)}
                      onClose={() => setShowQuickReplies(false)}
                    />
                  )}
                </AnimatePresence>

                {/* Attachment / Quick reply button */}
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setShowQuickReplies(p => !p)}
                    className="p-2.5 rounded-lg transition-colors"
                    style={{ background: showQuickReplies ? 'rgba(212,175,55,0.15)' : '#1A1A1F', color: showQuickReplies ? '#D4AF37' : '#8B8A94' }}
                    title="Respostas rápidas"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="12" y2="13" />
                    </svg>
                  </button>

                  {/* Concierge AI */}
                  <button
                    onClick={handleConcierge}
                    disabled={isGenerating}
                    className="p-2.5 rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                    title="Gerar resposta com IA"
                  >
                    {isGenerating ? (
                      <div className="w-4 h-4 border-2 rounded-full animate-spin"
                        style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }}
                      />
                    ) : (
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Textarea */}
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
                  className="flex-1 resize-none rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                  style={{
                    background: '#1A1A1F',
                    color: '#F0EDE8',
                    border: '1px solid #2A2A32',
                    maxHeight: '120px',
                  }}
                />

                {/* Send */}
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || isSending}
                  className="shrink-0 p-2.5 rounded-lg transition-all disabled:opacity-30"
                  style={{ background: '#D4AF37', color: '#0A0A0B' }}
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#0A0A0B', borderTopColor: 'transparent' }}
                    />
                  ) : (
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ━━━ Column 3: Lead Panel ━━━ */}
      {selectedConv && showLeadPanel && (
        <div className="hidden lg:block">
          <LeadPanel lead={selectedConv.lead} onClose={() => setShowLeadPanel(false)} />
        </div>
      )}
    </div>
  )
}
