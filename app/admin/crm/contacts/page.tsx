'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

interface ContactLead {
  id: string
  name: string
  phone: string
  email: string | null
  status: 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST'
  stageId: string
  stageName: string
  expectedValue: number | null
  aiScore: number | null
  churnRisk: number | null
  tags: string[]
  source: string | null
  lastInteractionAt: string | null
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  HOT: '#FF6B4A',
  WARM: '#F0A500',
  COLD: '#4A7BFF',
  WON: '#2ECC8A',
  LOST: '#8B8A94',
}

const STATUS_LABELS: Record<string, string> = {
  HOT: 'Quente',
  WARM: 'Morno',
  COLD: 'Frio',
  WON: 'Ganho',
  LOST: 'Perdido',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
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

// ━━━ Skeleton ━━━
function ContactsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#111114' }} />
      ))}
    </div>
  )
}

// ━━━ Empty State ━━━
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(212,175,55,0.08)' }}
      >
        <svg width="28" height="28" fill="none" stroke="#D4AF37" strokeWidth="1.2" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </div>
      <p className="text-sm font-medium" style={{ color: '#F0EDE8' }}>Nenhum contato ainda</p>
      <p className="text-xs mt-1" style={{ color: '#8B8A94' }}>Crie leads no Pipeline para vê-los aqui</p>
    </div>
  )
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'name' | 'lastInteraction' | 'aiScore' | 'value'>('lastInteraction')

  const fetchContacts = useCallback(async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('admin_token')

      // Reutilizar API de pipeline para pegar stages
      const pipelineRes = await fetch(`/api/admin/crm/pipeline?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!pipelineRes.ok) throw new Error('Falha ao carregar pipeline')
      const pipelineData = await pipelineRes.json()

      const stageMap: Record<string, string> = {}
      for (const stage of pipelineData.stages) {
        stageMap[stage.id] = stage.name
      }

      // Buscar leads
      const leadsRes = await fetch(`/api/admin/crm/leads?tenantId=${TENANT_ID}&pipelineId=${pipelineData.pipeline.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!leadsRes.ok) throw new Error('Falha ao carregar contatos')
      const leadsData = await leadsRes.json()

      const mapped: ContactLead[] = leadsData.leads.map((lead: ContactLead & { stageId: string }) => ({
        ...lead,
        stageName: stageMap[lead.stageId] ?? 'Desconhecido',
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

  // Filtrar e ordenar
  const filteredContacts = contacts
    .filter(c => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.tags.some(t => t.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name)
        case 'aiScore': return (b.aiScore ?? 0) - (a.aiScore ?? 0)
        case 'value': return (b.expectedValue ?? 0) - (a.expectedValue ?? 0)
        case 'lastInteraction':
        default:
          return new Date(b.lastInteractionAt ?? b.createdAt).getTime() -
                 new Date(a.lastInteractionAt ?? a.createdAt).getTime()
      }
    })

  const stats = {
    total: contacts.length,
    hot: contacts.filter(c => c.status === 'HOT').length,
    warm: contacts.filter(c => c.status === 'WARM').length,
    cold: contacts.filter(c => c.status === 'COLD').length,
    won: contacts.filter(c => c.status === 'WON').length,
    totalValue: contacts.reduce((acc, c) => acc + (c.expectedValue ?? 0), 0),
  }

  if (isLoading) return <ContactsSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm" style={{ color: '#FF6B4A' }}>{error}</p>
        <button onClick={fetchContacts} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
        >Tentar novamente</button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0EDE8' }}>Contatos</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B8A94' }}>
            {stats.total} contatos · {formatCurrency(stats.totalValue)} em pipeline
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {([
          { label: 'Total', value: stats.total, color: '#D4AF37' },
          { label: 'Quentes', value: stats.hot, color: '#FF6B4A' },
          { label: 'Mornos', value: stats.warm, color: '#F0A500' },
          { label: 'Frios', value: stats.cold, color: '#4A7BFF' },
          { label: 'Ganhos', value: stats.won, color: '#2ECC8A' },
        ]).map(stat => (
          <motion.div
            key={stat.label}
            className="rounded-xl p-3 border"
            style={{ background: '#111114', borderColor: '#2A2A32' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#8B8A94' }}>{stat.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" width="14" height="14" fill="none" stroke="#8B8A94" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, telefone, email ou tag..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
            style={{ background: '#111114', color: '#F0EDE8', border: '1px solid #2A2A32' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm focus:outline-none"
          style={{ background: '#111114', color: '#F0EDE8', border: '1px solid #2A2A32' }}
        >
          <option value="ALL">Todos os status</option>
          <option value="HOT">Quentes</option>
          <option value="WARM">Mornos</option>
          <option value="COLD">Frios</option>
          <option value="WON">Ganhos</option>
          <option value="LOST">Perdidos</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 rounded-lg text-sm focus:outline-none"
          style={{ background: '#111114', color: '#F0EDE8', border: '1px solid #2A2A32' }}
        >
          <option value="lastInteraction">Última interação</option>
          <option value="name">Nome A-Z</option>
          <option value="aiScore">Score IA</option>
          <option value="value">Valor</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs mb-3" style={{ color: '#8B8A94' }}>
        {filteredContacts.length} {filteredContacts.length === 1 ? 'resultado' : 'resultados'}
      </p>

      {/* Table */}
      {filteredContacts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2A2A32' }}>
          {/* Desktop header */}
          <div className="hidden lg:grid grid-cols-[1fr_140px_100px_100px_100px_80px_100px] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium"
            style={{ background: '#111114', color: '#8B8A94', borderBottom: '1px solid #2A2A32' }}
          >
            <span>Contato</span>
            <span>Estágio</span>
            <span>Status</span>
            <span>Valor</span>
            <span>Score IA</span>
            <span>Risco</span>
            <span>Última vez</span>
          </div>

          <AnimatePresence>
            {filteredContacts.map((contact, i) => {
              const statusColor = STATUS_COLORS[contact.status] ?? '#8B8A94'
              const churnColor = contact.churnRisk != null
                ? contact.churnRisk >= 70 ? '#FF6B4A' : contact.churnRisk >= 40 ? '#F0A500' : '#2ECC8A'
                : '#8B8A94'

              return (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-1 lg:grid-cols-[1fr_140px_100px_100px_100px_80px_100px] gap-2 px-4 py-3 items-center transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid #1A1A1F' }}
                >
                  {/* Contato */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ background: statusColor + '18', color: statusColor }}
                    >
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>{contact.name}</p>
                      <p className="text-[11px] truncate" style={{ color: '#8B8A94' }}>
                        {contact.phone}
                        {contact.email && ` · ${contact.email}`}
                      </p>
                      {contact.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5 lg:hidden">
                          {contact.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9px] px-1 py-0.5 rounded"
                              style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                            >{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Estágio */}
                  <div className="hidden lg:block">
                    <span className="text-xs" style={{ color: '#F0EDE8' }}>{contact.stageName}</span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded inline-block"
                      style={{ background: statusColor + '18', color: statusColor }}
                    >
                      {STATUS_LABELS[contact.status] ?? contact.status}
                    </span>
                  </div>

                  {/* Valor */}
                  <div className="hidden lg:block">
                    <span className="text-xs font-medium" style={{ color: contact.expectedValue ? '#D4AF37' : '#8B8A94' }}>
                      {contact.expectedValue ? formatCurrency(contact.expectedValue) : '—'}
                    </span>
                  </div>

                  {/* Score IA */}
                  <div className="hidden lg:block">
                    {contact.aiScore != null ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1A1A1F' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${contact.aiScore}%`,
                              background: contact.aiScore >= 70 ? '#2ECC8A' : contact.aiScore >= 40 ? '#F0A500' : '#4A7BFF',
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold w-7 text-right" style={{ color: '#F0EDE8' }}>
                          {contact.aiScore}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px]" style={{ color: '#8B8A94' }}>—</span>
                    )}
                  </div>

                  {/* Risco Churn */}
                  <div className="hidden lg:block">
                    {contact.churnRisk != null ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: churnColor + '18', color: churnColor }}
                      >
                        {contact.churnRisk}%
                      </span>
                    ) : (
                      <span className="text-[10px]" style={{ color: '#8B8A94' }}>—</span>
                    )}
                  </div>

                  {/* Última interação */}
                  <div className="hidden lg:block">
                    <span className="text-[11px]" style={{ color: '#8B8A94' }}>
                      {timeAgo(contact.lastInteractionAt)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
