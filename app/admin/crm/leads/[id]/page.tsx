'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'
import { playFeedback } from '@/lib/crm-feedback'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// ━━━ Types ━━━

interface StageInfo {
  id: string; name: string; color: string | null; type: string
}

interface MessageItem {
  id: string; fromMe: boolean; type: string; content: string
  status: string; createdAt: string
}

interface ConversationInfo {
  id: string; lastMessageAt: string; unreadCount: number
  messages: MessageItem[]
}

interface ActivityItem {
  id: string; type: string; payload: Record<string, unknown>
  createdBy: string | null; createdAt: string
}

interface LeadDetail {
  id: string; name: string; phone: string; email: string | null
  status: string; stageId: string; expectedValue: number | null
  aiScore: number | null; aiScoreLabel: string | null
  churnRisk: number | null
  bestContactDays: string | null; bestContactHours: string | null; bestContactBasis: number | null
  tags: string[]; source: string | null
  lastInteractionAt: string | null; createdAt: string
  patientId: string | null
  stage: StageInfo
  conversations: ConversationInfo[]
  activities: ActivityItem[]
}

interface ProposalItem {
  id: string; title: string; totalValue: number; status: string
  createdAt: string; sentAt: string | null
}

interface TaskItem {
  id: string; title: string; description: string | null; status: string
  priority: number; dueAt: string | null; completedAt: string | null
  createdAt: string
}

// ━━━ Constants ━━━

const STATUS_COLORS: Record<string, string> = {
  HOT: '#FF6B4A', WARM: '#F0A500', COLD: '#4A7BFF', WON: '#2ECC8A', LOST: 'var(--crm-text-muted)',
}
const STATUS_LABELS: Record<string, string> = {
  HOT: 'Quente', WARM: 'Morno', COLD: 'Frio', WON: 'Ganho', LOST: 'Perdido',
}
const ACTIVITY_LABELS: Record<string, string> = {
  LEAD_CREATED: 'Lead criado', LEAD_MOVED: 'Movido de estágio', LEAD_WON: 'Lead ganho',
  LEAD_LOST: 'Lead perdido', LEAD_CONVERTED: 'Convertido em paciente',
  MESSAGE_SENT: 'Mensagem enviada', MESSAGE_RECEIVED: 'Mensagem recebida',
  NOTE_ADDED: 'Nota adicionada', TAG_CHANGED: 'Tags alteradas', SCORE_UPDATED: 'Score atualizado',
  PROPOSAL_CREATED: 'Proposta criada', PROPOSAL_SENT: 'Proposta enviada',
  PROPOSAL_ACCEPTED: 'Proposta aceita', PROPOSAL_REJECTED: 'Proposta rejeitada',
  TASK_CREATED: 'Tarefa criada', TASK_COMPLETED: 'Tarefa concluída',
}
const ACTIVITY_ICONS: Record<string, string> = {
  LEAD_CREATED: '✦', LEAD_MOVED: '↔', LEAD_WON: '✓', LEAD_LOST: '✕',
  LEAD_CONVERTED: '♦', MESSAGE_SENT: '↗', MESSAGE_RECEIVED: '↙',
  NOTE_ADDED: '✎', TAG_CHANGED: '#', SCORE_UPDATED: '★',
  PROPOSAL_CREATED: '📄', PROPOSAL_SENT: '📨', PROPOSAL_ACCEPTED: '✅', PROPOSAL_REJECTED: '❌',
  TASK_CREATED: '📋', TASK_COMPLETED: '☑',
}
const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Normal', color: 'var(--crm-text-muted)' },
  1: { label: 'Alta', color: 'var(--crm-warm)' },
  2: { label: 'Urgente', color: 'var(--crm-hot)' },
}

const QUICK_REPLIES = [
  'Olá! Como posso ajudar?',
  'Vou verificar e retorno em instantes.',
  'Posso agendar um horário para você?',
  'Obrigada pelo contato! 💛',
  'Qual procedimento tem interesse?',
]

// ━━━ Helpers ━━━

function apiFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {}),
    },
  })
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function getScoreColor(score: number) {
  if (score >= 75) return '#2ECC8A'
  if (score >= 50) return '#F0A500'
  if (score >= 25) return '#FF6B4A'
  return '#4A7BFF'
}

type TabKey = 'details' | 'conversations' | 'timeline' | 'proposals' | 'tasks' | 'notes'

// ━━━ Main Page ━━━

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const addToast = useToastStore(s => s.addToast)

  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('details')
  const [showEdit, setShowEdit] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Conversation state
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const [startingConv, setStartingConv] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Proposals & tasks
  const [proposals, setProposals] = useState<ProposalItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])

  const loadLead = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch(`/api/admin/crm/leads/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLead(data.lead)
      if (data.lead.conversations?.[0]) {
        setConversationId(data.lead.conversations[0].id)
      }
    } catch {
      addToast('Erro ao carregar lead', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, addToast])

  useEffect(() => { loadLead() }, [loadLead])

  // Load proposals and tasks when switching to those tabs
  useEffect(() => {
    if (activeTab === 'proposals' && lead) {
      apiFetch(`/api/admin/crm/proposals?tenantId=${TENANT_ID}&leadId=${lead.id}`)
        .then(r => r.json())
        .then(d => { if (d.proposals) setProposals(d.proposals) })
        .catch(() => {})
    }
  }, [activeTab, lead])

  useEffect(() => {
    if (activeTab === 'tasks' && lead) {
      apiFetch(`/api/admin/crm/tasks?tenantId=${TENANT_ID}&leadId=${lead.id}`)
        .then(r => r.json())
        .then(d => { if (d.tasks) setTasks(d.tasks) })
        .catch(() => {})
    }
  }, [activeTab, lead])

  // Load messages when conversations tab is active
  useEffect(() => {
    if (activeTab === 'conversations' && conversationId) {
      apiFetch(`/api/admin/crm/conversations/messages?conversationId=${conversationId}`)
        .then(r => r.json())
        .then(d => { if (d.messages) setMessages(d.messages) })
        .catch(() => {})
    }
  }, [activeTab, conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ━━━ Actions ━━━

  const handleStartConversation = async () => {
    if (!lead || startingConv) return
    setStartingConv(true)
    try {
      const res = await apiFetch('/api/admin/crm/conversations/start', {
        method: 'POST',
        body: JSON.stringify({ leadId: lead.id, tenantId: TENANT_ID }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setConversationId(data.conversationId)
      setActiveTab('conversations')
      addToast(data.created ? 'Conversa criada' : 'Conversa aberta')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao iniciar conversa', 'error')
    } finally {
      setStartingConv(false)
    }
  }

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !conversationId || sending) return
    const content = msgInput.trim()
    setMsgInput('')
    setSending(true)

    // Optimistic
    const tempMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      fromMe: true, type: 'TEXT', content,
      status: 'SENDING', createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const res = await apiFetch('/api/admin/crm/conversations/messages', {
        method: 'POST',
        body: JSON.stringify({ conversationId, content, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      const msg = await res.json()
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...msg } : m))
      playFeedback('message')
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
      setMsgInput(content)
      addToast('Erro ao enviar mensagem', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    if (!lead || deleting) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/admin/crm/leads/${lead.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      addToast('Lead excluído')
      router.push('/admin/crm/pipeline')
    } catch {
      addToast('Erro ao excluir lead', 'error')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // ━━━ Tabs Config ━━━

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'details', label: 'Detalhes', icon: '◉' },
    { key: 'conversations', label: 'Conversas', icon: '◆' },
    { key: 'timeline', label: 'Timeline', icon: '◈' },
    { key: 'proposals', label: 'Propostas', icon: '📄' },
    { key: 'tasks', label: 'Tarefas', icon: '📋' },
    { key: 'notes', label: 'Notas', icon: '✎' },
  ]

  // ━━━ Loading / Error ━━━

  if (loading) return <LeadPageSkeleton />
  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(255,107,74,0.08)', border: '1px solid rgba(255,107,74,0.15)' }}>
          <svg width="28" height="28" fill="none" stroke="#FF6B4A" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--crm-hot)' }}>Lead não encontrado</p>
        <Link href="/admin/crm/pipeline" className="text-xs mt-3 underline" style={{ color: 'var(--crm-text-muted)' }}>
          Voltar ao Pipeline
        </Link>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[lead.status] ?? 'var(--crm-text-muted)'
  const allMessages = lead.conversations[0]?.messages?.slice().reverse() ?? []
  const displayMessages = messages.length > 0 ? messages : allMessages
  const hasConversation = !!conversationId || lead.conversations.length > 0

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Back + Breadcrumb ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()}
          className="p-2 rounded-lg transition-all hover:bg-white/5 active:scale-95"
          style={{ color: 'var(--crm-text-muted)' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <nav className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--crm-text-muted)' }}>
          <Link href="/admin/crm/pipeline" className="hover:underline">Pipeline</Link>
          <span>/</span>
          <span style={{ color: 'var(--crm-text)' }}>{lead.name}</span>
        </nav>
      </div>

      {/* ── Header Card ── */}
      <div className="rounded-2xl border p-4 sm:p-5 mb-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar + Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
              style={{ background: statusColor + '14', color: statusColor }}>
              {lead.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold truncate" style={{ color: 'var(--crm-text)' }}>{lead.name}</h1>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0"
                  style={{ background: statusColor + '12', color: statusColor, border: `1px solid ${statusColor}20` }}>
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: 'var(--crm-text-muted)' }}>
                <span>{lead.phone}</span>
                {lead.email && <span>{lead.email}</span>}
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: lead.stage.color ?? 'var(--crm-text-muted)' }} />
                  {lead.stage.name}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {lead.aiScore != null && (
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: getScoreColor(lead.aiScore) }}>★ {lead.aiScore}</p>
                <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Score</p>
              </div>
            )}
            {lead.expectedValue != null && lead.expectedValue > 0 && (
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: 'var(--crm-gold)' }}>{formatCurrency(lead.expectedValue)}</p>
                <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Valor</p>
              </div>
            )}
            {lead.churnRisk != null && (
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: lead.churnRisk >= 70 ? 'var(--crm-hot)' : 'var(--crm-text-muted)' }}>
                  {lead.churnRisk}%
                </p>
                <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Churn</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex items-center gap-2 mt-4 pt-4 flex-wrap" style={{ borderTop: '1px solid var(--crm-border)' }}>
          {hasConversation ? (
            <Link href="/admin/crm/inbox"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: 'rgba(46,204,138,0.1)', color: '#2ECC8A', border: '1px solid rgba(46,204,138,0.15)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Abrir Conversa
            </Link>
          ) : (
            <button onClick={handleStartConversation} disabled={startingConv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-50 active:scale-[0.97]"
              style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.15)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
              </svg>
              {startingConv ? 'Iniciando...' : 'Iniciar Conversa'}
            </button>
          )}

          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all hover:bg-white/5 active:scale-[0.97]"
            style={{ color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar
          </button>

          {lead.patientId ? (
            <Link href={`/admin/clientes?highlight=${lead.patientId}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all hover:bg-white/5 active:scale-[0.97]"
              style={{ color: '#2ECC8A', border: '1px solid rgba(46,204,138,0.12)' }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
              Ver Paciente
            </Link>
          ) : null}

          {/* More dropdown */}
          <div className="relative ml-auto">
            <button onClick={() => setShowMore(!showMore)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:bg-white/5 active:scale-[0.97]"
              style={{ color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}>
              Mais
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <AnimatePresence>
              {showMore && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border shadow-xl overflow-hidden"
                    style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
                  >
                    <Link href={`/admin/crm/proposals?leadId=${lead.id}`}
                      className="flex items-center gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-white/5"
                      style={{ color: 'var(--crm-text)' }}
                      onClick={() => setShowMore(false)}>
                      📄 Enviar Proposta
                    </Link>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs transition-colors hover:bg-white/5 text-left"
                      style={{ color: 'var(--crm-text)' }}
                      onClick={() => { setShowMore(false); setActiveTab('notes') }}>
                      ✎ Adicionar Nota
                    </button>
                    <div className="border-t" style={{ borderColor: 'var(--crm-border)' }} />
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs transition-colors hover:bg-white/5 text-left"
                      style={{ color: 'var(--crm-hot)' }}
                      onClick={() => { setShowMore(false); setConfirmDelete(true) }}>
                      🗑 Excluir Lead
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Golden Window Banner ── */}
      {lead.bestContactDays && lead.bestContactHours && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-3"
          style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.1)' }}>
          <span className="text-lg">⏰</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--crm-gold)' }}>
              Janela de Ouro: {lead.bestContactDays} · {lead.bestContactHours}
            </p>
            {lead.bestContactBasis != null && lead.bestContactBasis > 0 && (
              <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                Base: {lead.bestContactBasis} conversões
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none mb-4 border-b pb-px"
        style={{ borderColor: 'var(--crm-border)' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all rounded-t-lg relative"
            style={{
              color: activeTab === tab.key ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
              background: activeTab === tab.key ? 'var(--crm-gold-subtle)' : 'transparent',
            }}>
            <span className="opacity-60">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: 'var(--crm-gold)' }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="min-h-[400px]">
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Info cards */}
            <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
              <h3 className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: 'var(--crm-text-muted)' }}>
                Informações
              </h3>
              <div className="space-y-2.5">
                <InfoRow label="Telefone" value={lead.phone} />
                <InfoRow label="Email" value={lead.email ?? '—'} />
                <InfoRow label="Fonte" value={lead.source ?? '—'} />
                <InfoRow label="Criado em" value={formatDate(lead.createdAt)} />
                <InfoRow label="Última interação" value={timeAgo(lead.lastInteractionAt)} />
                <InfoRow label="Score IA" value={lead.aiScore != null ? `${lead.aiScore}/100 (${lead.aiScoreLabel ?? ''})` : '—'} />
              </div>
            </div>

            {/* Tags */}
            <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
              <h3 className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: 'var(--crm-text-muted)' }}>
                Tags
              </h3>
              {lead.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)', border: '1px solid rgba(212,175,55,0.1)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Nenhuma tag</p>
              )}

              <h3 className="text-[10px] uppercase tracking-wider font-semibold mt-5 mb-3" style={{ color: 'var(--crm-text-muted)' }}>
                Pipeline / Estágio
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: lead.stage.color ?? 'var(--crm-text-muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--crm-text)' }}>{lead.stage.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: statusColor + '12', color: statusColor }}>
                  {STATUS_LABELS[lead.status]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CONVERSATIONS TAB */}
        {activeTab === 'conversations' && (
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
            {!hasConversation ? (
              <div className="flex flex-col items-center py-16 px-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(37,211,102,0.06)', border: '1px dashed rgba(37,211,102,0.2)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(37,211,102,0.4)">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--crm-text)' }}>
                  Nenhuma conversa ainda
                </p>
                <p className="text-xs mb-4 text-center" style={{ color: 'var(--crm-text-muted)' }}>
                  Inicie uma conversa via WhatsApp com {lead.name}
                </p>
                <button onClick={handleStartConversation} disabled={startingConv}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: '#25D366', color: '#fff' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                  </svg>
                  {startingConv ? 'Iniciando...' : 'Enviar WhatsApp'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col h-[500px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {displayMessages.length === 0 ? (
                    <div className="flex flex-col items-center py-12">
                      <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Nenhuma mensagem ainda. Envie a primeira!</p>
                    </div>
                  ) : displayMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px]"
                        style={{
                          background: msg.fromMe ? 'linear-gradient(135deg, #D4AF37, #C4A030)' : 'var(--crm-bg)',
                          color: msg.fromMe ? 'var(--crm-bg)' : 'var(--crm-text)',
                          border: msg.fromMe ? 'none' : '1px solid var(--crm-border)',
                          borderBottomRightRadius: msg.fromMe ? '6px' : '16px',
                          borderBottomLeftRadius: msg.fromMe ? '16px' : '6px',
                          boxShadow: msg.fromMe ? '0 2px 12px rgba(212,175,55,0.2)' : 'none',
                          opacity: msg.status === 'SENDING' ? 0.6 : 1,
                        }}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        <span className={`text-[9px] block mt-1 ${msg.fromMe ? 'text-black/40' : ''}`}
                          style={msg.fromMe ? undefined : { color: 'var(--crm-text-muted)' }}>
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {msg.fromMe && msg.status === 'SENDING' && ' ⏳'}
                          {msg.fromMe && msg.status === 'SENT' && ' ✓'}
                          {msg.fromMe && (msg.status === 'DELIVERED' || msg.status === 'READ') && ' ✓✓'}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick replies */}
                <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                  {QUICK_REPLIES.map(qr => (
                    <button key={qr} onClick={() => setMsgInput(qr)}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all hover:brightness-125 shrink-0"
                      style={{ background: 'var(--crm-bg)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}>
                      {qr}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="p-3 border-t" style={{ borderColor: 'var(--crm-border)' }}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
                    />
                    <button onClick={handleSendMessage} disabled={!msgInput.trim() || sending}
                      className="p-2.5 rounded-xl transition-all disabled:opacity-30 hover:brightness-110 active:scale-95"
                      style={{ background: 'var(--crm-gold)', color: '#0A0A0B' }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
            {lead.activities.length === 0 ? (
              <EmptyState icon="⏰" title="Nenhuma atividade" subtitle="O histórico aparecerá aqui" />
            ) : (
              <div className="space-y-0.5">
                {lead.activities.map((activity, i) => (
                  <div key={activity.id} className="flex gap-3 py-2.5">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] shrink-0"
                        style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}>
                        {ACTIVITY_ICONS[activity.type] ?? '•'}
                      </div>
                      {i < lead.activities.length - 1 && (
                        <div className="w-px flex-1 mt-1.5" style={{ background: 'var(--crm-border)' }} />
                      )}
                    </div>
                    <div className="min-w-0 pb-1">
                      <p className="text-xs font-medium" style={{ color: 'var(--crm-text)' }}>
                        {ACTIVITY_LABELS[activity.type] ?? activity.type.replace(/_/g, ' ')}
                      </p>
                      {activity.payload && Object.keys(activity.payload).length > 0 && (
                        <p className="text-[10px] mt-0.5 truncate max-w-xs" style={{ color: 'var(--crm-text-muted)' }}>
                          {JSON.stringify(activity.payload).slice(0, 120)}
                        </p>
                      )}
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                        {formatDateTime(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROPOSALS TAB */}
        {activeTab === 'proposals' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Propostas</h3>
              <Link href={`/admin/crm/proposals?leadId=${lead.id}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-125"
                style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}>
                + Nova Proposta
              </Link>
            </div>
            {proposals.length === 0 ? (
              <div className="rounded-xl border p-8" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
                <EmptyState icon="📄" title="Nenhuma proposta" subtitle="Crie uma proposta para este lead" />
              </div>
            ) : (
              proposals.map(p => (
                <div key={p.id} className="rounded-xl border p-4 transition-all hover:brightness-105"
                  style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--crm-text)' }}>{p.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                        {formatDate(p.createdAt)} {p.sentAt ? `· Enviada ${formatDate(p.sentAt)}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: 'var(--crm-gold)' }}>{formatCurrency(p.totalValue)}</p>
                      <ProposalStatus status={p.status} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Tarefas</h3>
            {tasks.length === 0 ? (
              <div className="rounded-xl border p-8" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
                <EmptyState icon="📋" title="Nenhuma tarefa" subtitle="Tarefas vinculadas a este lead aparecerão aqui" />
              </div>
            ) : (
              tasks.map(t => {
                const prio = PRIORITY_LABELS[t.priority] ?? PRIORITY_LABELS[0]
                return (
                  <div key={t.id} className="rounded-xl border p-4"
                    style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)', opacity: t.status === 'COMPLETED' ? 0.5 : 1 }}>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-md border mt-0.5 flex items-center justify-center shrink-0"
                        style={{ borderColor: t.status === 'COMPLETED' ? 'var(--crm-won)' : 'var(--crm-border)', background: t.status === 'COMPLETED' ? 'rgba(46,204,138,0.1)' : 'transparent' }}>
                        {t.status === 'COMPLETED' && <span style={{ color: 'var(--crm-won)', fontSize: 10 }}>✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--crm-text)', textDecoration: t.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>{t.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${prio.color}14`, color: prio.color }}>
                            {prio.label}
                          </span>
                          {t.dueAt && (
                            <span className="text-[9px]" style={{ color: new Date(t.dueAt) < new Date() && t.status !== 'COMPLETED' ? 'var(--crm-hot)' : 'var(--crm-text-muted)' }}>
                              {formatDate(t.dueAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <NotesTab leadId={lead.id} activities={lead.activities.filter(a => a.type === 'NOTE_ADDED')} onNoteAdded={loadLead} />
        )}
      </div>

      {/* ── Edit Modal ── */}
      <AnimatePresence>
        {showEdit && lead && (
          <EditLeadModal lead={lead} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); loadLead() }} />
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
            <motion.div
              className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
              style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
              <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--crm-text)' }}>Excluir Lead</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--crm-text-muted)' }}>
                Confirma a exclusão de <strong style={{ color: 'var(--crm-text)' }}>{lead.name}</strong>?
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium"
                  style={{ color: 'var(--crm-text-muted)' }}>Cancelar</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                  style={{ background: 'rgba(255,107,74,0.1)', color: 'var(--crm-hot)', border: '1px solid rgba(255,107,74,0.2)' }}>
                  {deleting ? 'Excluindo...' : 'Sim, excluir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ━━━ Sub-components ━━━

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--crm-border)' }}>
      <span className="text-[11px] font-medium" style={{ color: 'var(--crm-text-muted)' }}>{label}</span>
      <span className="text-[11px] font-medium text-right" style={{ color: 'var(--crm-text)' }}>{value}</span>
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center py-8">
      <span className="text-2xl mb-3 opacity-30">{icon}</span>
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--crm-text-muted)' }}>{title}</p>
      <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }}>{subtitle}</p>
    </div>
  )
}

function ProposalStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Rascunho', color: 'var(--crm-text-muted)' },
    SENT: { label: 'Enviada', color: 'var(--crm-cold)' },
    VIEWED: { label: 'Visualizada', color: 'var(--crm-warm)' },
    ACCEPTED: { label: 'Aceita', color: 'var(--crm-won)' },
    REJECTED: { label: 'Rejeitada', color: 'var(--crm-hot)' },
    EXPIRED: { label: 'Expirada', color: 'var(--crm-text-muted)' },
  }
  const s = map[status] ?? map.DRAFT
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: `${s.color}14`, color: s.color }}>{s.label}</span>
  )
}

function LeadPageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--crm-surface)' }} />
      <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
      <div className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
      <div className="h-64 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
    </div>
  )
}

// ━━━ Notes Tab (with add note) ━━━

function NotesTab({
  leadId,
  activities,
  onNoteAdded,
}: {
  leadId: string
  activities: ActivityItem[]
  onNoteAdded: () => void
}) {
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const addToast = useToastStore(s => s.addToast)

  const handleAddNote = async () => {
    if (!noteText.trim() || saving) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/admin/crm/leads/${leadId}/activity`, {
        method: 'POST',
        body: JSON.stringify({ type: 'NOTE_ADDED', payload: { text: noteText.trim() } }),
      })
      if (!res.ok) throw new Error()
      setNoteText('')
      addToast('Nota adicionada')
      onNoteAdded()
    } catch {
      addToast('Erro ao adicionar nota', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Adicionar nota interna..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none mb-2"
          style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
        />
        <div className="flex justify-end">
          <button onClick={handleAddNote} disabled={!noteText.trim() || saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--crm-gold)', color: '#0A0A0B' }}>
            {saving ? 'Salvando...' : 'Adicionar Nota'}
          </button>
        </div>
      </div>

      {/* Notes list */}
      {activities.length === 0 ? (
        <div className="rounded-xl border p-8" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <EmptyState icon="✎" title="Nenhuma nota" subtitle="Adicione notas internas sobre este lead" />
        </div>
      ) : (
        activities.map(a => (
          <div key={a.id} className="rounded-xl border p-4"
            style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--crm-text)' }}>
              {(a.payload as { text?: string })?.text ?? JSON.stringify(a.payload)}
            </p>
            <p className="text-[10px] mt-2" style={{ color: 'var(--crm-text-muted)' }}>
              {formatDateTime(a.createdAt)}
            </p>
          </div>
        ))
      )}
    </div>
  )
}

// ━━━ Edit Lead Modal ━━━

function EditLeadModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadDetail
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(lead.name)
  const [phone, setPhone] = useState(lead.phone)
  const [email, setEmail] = useState(lead.email ?? '')
  const [source, setSource] = useState(lead.source ?? '')
  const [expectedValue, setExpectedValue] = useState(lead.expectedValue?.toString() ?? '')
  const [status, setStatus] = useState(lead.status)
  const [saving, setSaving] = useState(false)
  const addToast = useToastStore(s => s.addToast)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/admin/crm/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          source: source.trim() || null,
          expectedValue: expectedValue ? Number(expectedValue) : null,
          status,
        }),
      })
      if (!res.ok) throw new Error()
      addToast('Lead atualizado')
      onSaved()
    } catch {
      addToast('Erro ao atualizar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--crm-bg)', borderColor: 'var(--crm-border)', color: 'var(--crm-text)',
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        className="relative w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>Editar Lead</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--crm-text-muted)' }}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nome">
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label="Telefone">
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label="Fonte">
            <input type="text" value={source} onChange={e => setSource(e.target.value)}
              placeholder="Instagram, WhatsApp..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label="Valor Esperado (R$)">
            <input type="number" value={expectedValue} onChange={e => setExpectedValue(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle} />
          </Field>
          <Field label="Status">
            <div className="flex gap-2 flex-wrap">
              {(['COLD', 'WARM', 'HOT', 'WON', 'LOST'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: status === s ? STATUS_COLORS[s] + '20' : 'var(--crm-bg)',
                    color: status === s ? STATUS_COLORS[s] : 'var(--crm-text-muted)',
                    border: `1px solid ${status === s ? STATUS_COLORS[s] + '40' : 'var(--crm-border)'}`,
                  }}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t" style={{ borderColor: 'var(--crm-border)' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border hover:bg-white/5"
            style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-text-muted)' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--crm-gold)', color: '#000' }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}
