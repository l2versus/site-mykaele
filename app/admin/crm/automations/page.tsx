'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

interface AutomationItem {
  id: string
  name: string
  trigger: string
  isActive: boolean
  flowJson: unknown
  createdAt: string
  updatedAt: string
}

const TRIGGER_LABELS: Record<string, string> = {
  NEW_MESSAGE_RECEIVED: 'Nova mensagem recebida',
  LEAD_STAGE_CHANGED: 'Lead mudou de estágio',
  LEAD_CREATED: 'Lead criado',
  CONTACT_IDLE: 'Contato inativo',
  APPOINTMENT_BOOKED: 'Agendamento criado',
  APPOINTMENT_COMPLETED: 'Agendamento concluído',
}

const TRIGGER_ICONS: Record<string, string> = {
  NEW_MESSAGE_RECEIVED: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  LEAD_STAGE_CHANGED: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  LEAD_CREATED: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
  CONTACT_IDLE: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4l3 3',
  APPOINTMENT_BOOKED: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
  APPOINTMENT_COMPLETED: 'M22 11.08V12a10 10 0 1 1-5.93-9.14',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ━━━ Skeleton ━━━
function AutomationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#111114' }} />
      ))}
    </div>
  )
}

// ━━━ Empty State ━━━
function EmptyState({ onCreateFirst }: { onCreateFirst: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(212,175,55,0.08)' }}
      >
        <svg width="36" height="36" fill="none" stroke="#D4AF37" strokeWidth="1.2" viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      <p className="text-base font-semibold" style={{ color: '#F0EDE8' }}>Automatize seu CRM</p>
      <p className="text-xs mt-1 max-w-xs text-center" style={{ color: '#8B8A94' }}>
        Crie fluxos automáticos que reagem a eventos como novas mensagens,
        mudanças de estágio e agendamentos.
      </p>
      <button
        onClick={onCreateFirst}
        className="mt-6 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
        style={{ background: '#D4AF37', color: '#0A0A0B' }}
      >
        + Criar Automação
      </button>
    </div>
  )
}

// ━━━ Create/Edit Modal ━━━
function AutomationModal({ onClose, onSave, existing }: {
  onClose: () => void
  onSave: (data: { name: string; trigger: string }) => void
  existing?: AutomationItem | null
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [trigger, setTrigger] = useState(existing?.trigger ?? 'NEW_MESSAGE_RECEIVED')
  const [saving, setSaving] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    onSave({ name, trigger })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md rounded-2xl border p-6"
        style={{ background: '#111114', borderColor: '#2A2A32' }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#F0EDE8' }}>
          {existing ? 'Editar Automação' : 'Nova Automação'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Nome *</label>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="Ex: Boas-vindas automática"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Gatilho *</label>
            <select
              value={trigger} onChange={e => setTrigger(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
            >
              {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Placeholder visual para o construtor React Flow */}
          <div className="rounded-lg p-4 text-center" style={{ background: '#0A0A0B', border: '1px dashed #2A2A32' }}>
            <svg className="mx-auto mb-2 opacity-30" width="32" height="32" fill="none" stroke="#D4AF37" strokeWidth="1.2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="8" y="14" width="7" height="7" rx="1" />
              <line x1="6.5" y1="10" x2="6.5" y2="14" />
              <line x1="17.5" y1="10" x2="17.5" y2="14" />
            </svg>
            <p className="text-[10px]" style={{ color: '#8B8A94' }}>
              O editor visual de fluxo estará disponível após criar a automação
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: '#1A1A1F', color: '#8B8A94', border: '1px solid #2A2A32' }}
            >Cancelar</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: '#D4AF37', color: '#0A0A0B' }}
            >{saving ? 'Salvando...' : existing ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  const fetchAutomations = useCallback(async () => {
    if (!token) return
    try {
      setIsLoading(true)
      const res = await fetch(`/api/admin/crm/automations?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        // Se a rota não existe ainda, mostrar estado vazio
        if (res.status === 404) {
          setAutomations([])
          setError(null)
          return
        }
        throw new Error('Falha ao carregar automações')
      }
      const data = await res.json()
      setAutomations(data.automations ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => { fetchAutomations() }, [fetchAutomations])

  const handleCreate = async (data: { name: string; trigger: string }) => {
    try {
      const res = await fetch('/api/admin/crm/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, tenantId: TENANT_ID, flowJson: { nodes: [], edges: [] } }),
      })
      if (!res.ok) throw new Error('Falha ao criar automação')
      setShowModal(false)
      fetchAutomations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar')
    }
  }

  const handleToggle = async (automation: AutomationItem) => {
    setToggling(automation.id)
    try {
      await fetch(`/api/admin/crm/automations/${automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !automation.isActive, tenantId: TENANT_ID }),
      })
      setAutomations(prev => prev.map(a =>
        a.id === automation.id ? { ...a, isActive: !a.isActive } : a
      ))
    } catch {
      // revert silently
    } finally {
      setToggling(null)
    }
  }

  if (isLoading) return <AutomationsSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm" style={{ color: '#FF6B4A' }}>{error}</p>
        <button onClick={fetchAutomations} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
        >Tentar novamente</button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0EDE8' }}>Automações</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B8A94' }}>
            {automations.length} {automations.length === 1 ? 'automação' : 'automações'} · {automations.filter(a => a.isActive).length} ativas
          </p>
        </div>
        {automations.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: '#D4AF37', color: '#0A0A0B' }}
          >
            + Nova Automação
          </button>
        )}
      </div>

      {automations.length === 0 ? (
        <EmptyState onCreateFirst={() => setShowModal(true)} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {automations.map((automation, i) => {
              const iconPath = TRIGGER_ICONS[automation.trigger] ?? TRIGGER_ICONS.LEAD_CREATED
              return (
                <motion.div
                  key={automation.id}
                  className="flex items-center gap-4 p-4 rounded-xl border transition-colors"
                  style={{
                    background: '#111114',
                    borderColor: automation.isActive ? 'rgba(212,175,55,0.2)' : '#2A2A32',
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: automation.isActive ? 'rgba(212,175,55,0.1)' : '#1A1A1F' }}
                  >
                    <svg width="18" height="18" fill="none"
                      stroke={automation.isActive ? '#D4AF37' : '#8B8A94'}
                      strokeWidth="1.5" viewBox="0 0 24 24"
                    >
                      <path d={iconPath} />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>
                        {automation.name}
                      </span>
                      {automation.isActive && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#2ECC8A' }} />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>
                        {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
                      </span>
                      <span className="text-[10px]" style={{ color: '#8B8A94' }}>
                        Atualizado: {formatDate(automation.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(automation)}
                    disabled={toggling === automation.id}
                    className="flex-shrink-0 w-11 h-6 rounded-full relative transition-colors disabled:opacity-50"
                    style={{
                      background: automation.isActive ? '#D4AF37' : '#2A2A32',
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                      style={{
                        background: '#F0EDE8',
                        left: automation.isActive ? 'calc(100% - 22px)' : '2px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Visual builder info card */}
          <div className="rounded-xl p-4 mt-6" style={{ background: '#111114', border: '1px dashed #2A2A32' }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(212,175,55,0.08)' }}
              >
                <svg width="16" height="16" fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="8" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: '#F0EDE8' }}>Editor Visual de Fluxo</p>
                <p className="text-xs mt-0.5" style={{ color: '#8B8A94' }}>
                  O construtor visual com React Flow permite criar fluxos complexos com
                  condições, ações e delays. Clique em uma automação para editar o fluxo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AutomationModal
          onClose={() => setShowModal(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}
