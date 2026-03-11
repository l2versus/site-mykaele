'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCrmStream } from '@/hooks/use-crm-stream'
import { playFeedback } from '@/lib/crm-feedback'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

interface ConversationItem {
  id: string
  remoteJid: string
  unreadCount: number
  lastMessageAt: string
  lead: {
    id: string
    name: string
    phone: string
    status: string
    aiScore: number | null
    expectedValue: number | null
    tags: string[]
  }
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

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' })
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ━━━ Skeleton ━━━
function InboxSkeleton() {
  return (
    <div className="flex h-[calc(100vh-10rem)] rounded-xl overflow-hidden" style={{ border: '1px solid #2A2A32' }}>
      <div className="w-80 border-r" style={{ borderColor: '#2A2A32', background: '#111114' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-3 border-b animate-pulse" style={{ borderColor: '#1A1A1F' }}>
            <div className="h-4 w-32 rounded mb-2" style={{ background: '#1A1A1F' }} />
            <div className="h-3 w-48 rounded" style={{ background: '#1A1A1F' }} />
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center" style={{ background: '#0A0A0B' }}>
        <div className="text-center opacity-30">
          <svg width="48" height="48" fill="none" stroke="#8B8A94" strokeWidth="1" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Selecione uma conversa</p>
        </div>
      </div>
    </div>
  )
}

// ━━━ Message Bubble ━━━
function MessageBubble({ message }: { message: MessageItem }) {
  return (
    <div className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
        style={{
          background: message.fromMe ? '#D4AF37' : '#1A1A1F',
          color: message.fromMe ? '#0A0A0B' : '#F0EDE8',
          borderBottomRightRadius: message.fromMe ? '4px' : '16px',
          borderBottomLeftRadius: message.fromMe ? '16px' : '4px',
        }}
      >
        {message.type === 'IMAGE' && message.mediaUrl && (
          <img src={message.mediaUrl} alt="" className="rounded-lg mb-1 max-h-48 object-cover" />
        )}
        {message.type === 'AUDIO' && (
          <div className="flex items-center gap-2 py-1">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            <span className="text-xs opacity-70">Áudio</span>
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <span className={`text-[10px] block mt-1 ${message.fromMe ? 'text-black/40' : 'text-white/30'}`}>
          {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          {message.fromMe && message.status === 'SENT' && ' ✓'}
          {message.fromMe && message.status === 'DELIVERED' && ' ✓✓'}
          {message.fromMe && message.status === 'READ' && ' ✓✓'}
        </span>
      </div>
    </div>
  )
}

// ━━━ Main Inbox ━━━
export default function InboxPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/conversations?tenantId=${TENANT_ID}`, {
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
  }, [token])

  // Fetch messages
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!token) return
    const res = await fetch(`/api/admin/crm/conversations/messages?conversationId=${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json()
    setMessages(data.messages)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [token])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId)
  }, [selectedId, fetchMessages])

  // SSE: atualizar em tempo real
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

  // Enviar mensagem
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedId || isSending) return
    setIsSending(true)
    const content = newMessage
    setNewMessage('')

    // Optimistic
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
      await fetch('/api/admin/crm/conversations/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: selectedId, content, tenantId: TENANT_ID }),
      })
      await fetchMessages(selectedId)
      playFeedback('click')
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
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
    } catch {
      // silently fail
    } finally {
      setIsGenerating(false)
    }
  }

  const selectedConv = conversations.find(c => c.id === selectedId)

  if (isLoading) return <InboxSkeleton />

  return (
    <div className="flex h-[calc(100vh-10rem)] rounded-xl overflow-hidden" style={{ border: '1px solid #2A2A32' }}>
      {/* Lista de conversas */}
      <div className="w-full sm:w-80 flex-shrink-0 border-r flex flex-col"
        style={{ borderColor: '#2A2A32', background: '#111114', display: selectedId && typeof window !== 'undefined' && window.innerWidth < 640 ? 'none' : 'flex' }}
      >
        <div className="p-3 border-b" style={{ borderColor: '#2A2A32' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#F0EDE8' }}>Conversas</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <svg width="32" height="32" fill="none" stroke="#8B8A94" strokeWidth="1.2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Nenhuma conversa ainda</p>
              <p className="text-[10px] mt-1" style={{ color: '#8B8A94' }}>Conecte o WhatsApp em Integrações</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className="w-full text-left p-3 border-b transition-colors"
                style={{
                  borderColor: '#1A1A1F',
                  background: conv.id === selectedId ? '#1A1A1F' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>
                    {conv.lead.name}
                  </span>
                  <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: '#8B8A94' }}>
                    {formatTime(conv.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs truncate" style={{ color: '#8B8A94' }}>
                    {conv.lead.phone}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: '#D4AF37', color: '#0A0A0B' }}
                    >
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>
                {conv.lead.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {conv.lead.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1 py-0.5 rounded"
                        style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                      >{tag}</span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Painel de chat */}
      <div className="flex-1 flex flex-col" style={{ background: '#0A0A0B' }}>
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center opacity-30">
              <svg width="48" height="48" fill="none" stroke="#8B8A94" strokeWidth="1" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: '#2A2A32', background: '#111114' }}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedId(null)}
                  className="sm:hidden p-1"
                  style={{ color: '#8B8A94' }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: '#D4AF37', color: '#0A0A0B' }}
                >
                  {selectedConv?.lead.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#F0EDE8' }}>{selectedConv?.lead.name}</p>
                  <p className="text-[10px]" style={{ color: '#8B8A94' }}>{selectedConv?.lead.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConv?.lead.aiScore != null && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded"
                    style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}
                  >
                    ★ {selectedConv.lead.aiScore}
                  </span>
                )}
                {selectedConv?.lead.expectedValue != null && selectedConv.lead.expectedValue > 0 && (
                  <span className="text-[10px] font-medium px-2 py-1 rounded"
                    style={{ background: '#1A1A1F', color: '#D4AF37' }}
                  >
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(selectedConv.lead.expectedValue)}
                  </span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <MessageBubble message={msg} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t" style={{ borderColor: '#2A2A32', background: '#111114' }}>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleConcierge}
                  disabled={isGenerating}
                  className="flex-shrink-0 p-2.5 rounded-lg transition-colors disabled:opacity-50"
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
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Digite uma mensagem..."
                  rows={1}
                  className="flex-1 resize-none rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32', maxHeight: '120px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || isSending}
                  className="flex-shrink-0 p-2.5 rounded-lg transition-all disabled:opacity-30"
                  style={{ background: '#D4AF37', color: '#0A0A0B' }}
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
