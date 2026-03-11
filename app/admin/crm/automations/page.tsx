'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

interface AutomationItem {
  id: string
  name: string
  trigger: string
  isActive: boolean
  flowJson: { action?: string; conditions?: { field: string; op: string; value: string }[]; message?: string; stageId?: string }
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

const ACTION_LABELS: Record<string, string> = {
  SEND_MESSAGE: 'Enviar mensagem',
  MOVE_STAGE: 'Mover para estágio',
  ADD_TAG: 'Adicionar tag',
  NOTIFY_TEAM: 'Notificar equipe',
}

const CONDITION_FIELDS: Record<string, string> = {
  'lead.status': 'Status do lead',
  'lead.aiScore': 'Score IA',
  'lead.tags': 'Tags',
  'lead.source': 'Fonte',
  'lead.expectedValue': 'Valor esperado',
}

const CONDITION_OPS: Record<string, string> = {
  eq: 'igual a',
  neq: 'diferente de',
  gt: 'maior que',
  lt: 'menor que',
  contains: 'contém',
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
        Crie regras automáticas que reagem a eventos como novas mensagens,
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

// ━━━ Create/Edit Modal with Actions + Conditions ━━━
function AutomationModal({ onClose, onSave, existing }: {
  onClose: () => void
  onSave: (data: { name: string; trigger: string; flowJson: Record<string, unknown> }) => void
  existing?: AutomationItem | null
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [trigger, setTrigger] = useState(existing?.trigger ?? 'NEW_MESSAGE_RECEIVED')
  const [action, setAction] = useState(existing?.flowJson?.action ?? 'SEND_MESSAGE')
  const [message, setMessage] = useState(existing?.flowJson?.message ?? '')
  const [conditions, setConditions] = useState<{ field: string; op: string; value: string }[]>(
    existing?.flowJson?.conditions ?? []
  )
  const [saving, setSaving] = useState(false)

  const addCondition = () => setConditions(prev => [...prev, { field: 'lead.status', op: 'eq', value: '' }])
  const removeCondition = (idx: number) => setConditions(prev => prev.filter((_, i) => i !== idx))
  const updateCondition = (idx: number, updates: Partial<{ field: string; op: string; value: string }>) => {
    setConditions(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    onSave({
      name,
      trigger,
      flowJson: {
        action,
        message: action === 'SEND_MESSAGE' ? message : undefined,
        conditions: conditions.length > 0 ? conditions : undefined,
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg rounded-2xl border p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: '#111114', borderColor: '#2A2A32' }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <h2 className="text-lg font-semibold mb-5" style={{ color: '#F0EDE8' }}>
          {existing ? 'Editar Automação' : 'Nova Automação'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Nome *</label>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="Ex: Boas-vindas automática"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Quando (Gatilho) *</label>
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

          {/* Action */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Então (Ação) *</label>
            <select
              value={action} onChange={e => setAction(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
            >
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Message (when action is SEND_MESSAGE) */}
          {action === 'SEND_MESSAGE' && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#8B8A94' }}>Mensagem</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Olá {{nome}}, tudo bem? Somos da Clínica..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none resize-none"
                style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
              />
              <p className="text-[9px] mt-1" style={{ color: '#8B8A94' }}>
                Variáveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{email}}'}
              </p>
            </div>
          )}

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: '#8B8A94' }}>Condições (opcional)</label>
              <button type="button" onClick={addCondition}
                className="text-[10px] px-2 py-1 rounded-lg transition-colors"
                style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
              >
                + Condição
              </button>
            </div>
            {conditions.length === 0 && (
              <p className="text-[10px] py-2" style={{ color: '#5A5A64' }}>Sem condições — executa sempre que o gatilho disparar</p>
            )}
            {conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <select value={cond.field} onChange={e => updateCondition(idx, { field: e.target.value })}
                  className="flex-1 px-2 py-1.5 rounded text-xs focus:outline-none"
                  style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
                >
                  {Object.entries(CONDITION_FIELDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={cond.op} onChange={e => updateCondition(idx, { op: e.target.value })}
                  className="w-28 px-2 py-1.5 rounded text-xs focus:outline-none"
                  style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
                >
                  {Object.entries(CONDITION_OPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input value={cond.value} onChange={e => updateCondition(idx, { value: e.target.value })}
                  placeholder="valor"
                  className="w-24 px-2 py-1.5 rounded text-xs focus:outline-none"
                  style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
                />
                <button type="button" onClick={() => removeCondition(idx)}
                  className="p-1 rounded hover:bg-white/5" style={{ color: '#8B8A94' }}
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-lg p-3" style={{ background: '#0A0A0B', border: '1px solid #2A2A32' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-1.5" style={{ color: '#8B8A94' }}>Resumo da regra</p>
            <p className="text-xs" style={{ color: '#F0EDE8' }}>
              <span style={{ color: '#D4AF37' }}>Quando</span> {TRIGGER_LABELS[trigger]?.toLowerCase() ?? trigger}
              {conditions.length > 0 && (
                <>
                  <span style={{ color: '#D4AF37' }}> se</span> {conditions.map((c, i) =>
                    `${CONDITION_FIELDS[c.field] ?? c.field} ${CONDITION_OPS[c.op] ?? c.op} "${c.value}"${i < conditions.length - 1 ? ' e ' : ''}`
                  ).join('')}
                </>
              )}
              <span style={{ color: '#D4AF37' }}> então</span> {ACTION_LABELS[action]?.toLowerCase() ?? action}
              {action === 'SEND_MESSAGE' && message && `: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`}
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

// ━━━ Execution Log (simulated from flowJson timestamps) ━━━
function ExecutionLog() {
  // Placeholder — real execution logs would come from BullMQ job history
  const logs = [
    { id: '1', automation: 'Boas-vindas', trigger: 'LEAD_CREATED', status: 'success', at: new Date(Date.now() - 3600000).toISOString() },
    { id: '2', automation: 'Follow-up 48h', trigger: 'CONTACT_IDLE', status: 'success', at: new Date(Date.now() - 7200000).toISOString() },
    { id: '3', automation: 'Pós-atendimento', trigger: 'APPOINTMENT_COMPLETED', status: 'skipped', at: new Date(Date.now() - 86400000).toISOString() },
  ]

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2A2A32' }}>
      <div className="px-4 py-2.5" style={{ background: '#111114', borderBottom: '1px solid #2A2A32' }}>
        <span className="text-xs font-medium" style={{ color: '#F0EDE8' }}>Log de Execução</span>
        <span className="text-[10px] ml-2" style={{ color: '#8B8A94' }}>Últimas execuções</span>
      </div>
      {logs.map(log => (
        <div key={log.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid #1A1A1F' }}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0`}
            style={{ background: log.status === 'success' ? '#2ECC8A' : log.status === 'error' ? '#FF6B4A' : '#8B8A94' }}
          />
          <span className="text-xs flex-1" style={{ color: '#F0EDE8' }}>{log.automation}</span>
          <span className="text-[10px]" style={{ color: '#8B8A94' }}>{TRIGGER_LABELS[log.trigger] ?? log.trigger}</span>
          <span className="text-[10px]" style={{ color: '#8B8A94' }}>{formatDate(log.at)}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
            style={{
              background: log.status === 'success' ? '#2ECC8A18' : log.status === 'error' ? '#FF6B4A18' : '#8B8A9418',
              color: log.status === 'success' ? '#2ECC8A' : log.status === 'error' ? '#FF6B4A' : '#8B8A94',
            }}
          >
            {log.status === 'success' ? 'OK' : log.status === 'error' ? 'Erro' : 'Pulou'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ━━━ Main Page ━━━
export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const addToast = useToastStore(s => s.addToast)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  const fetchAutomations = useCallback(async () => {
    if (!token) return
    try {
      setIsLoading(true)
      const res = await fetch(`/api/admin/crm/automations?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
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

  const handleCreate = async (data: { name: string; trigger: string; flowJson: Record<string, unknown> }) => {
    try {
      const res = await fetch('/api/admin/crm/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error('Falha ao criar automação')
      setShowModal(false)
      addToast('Automação criada')
      fetchAutomations()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao criar', 'error')
    }
  }

  const handleToggle = async (automation: AutomationItem) => {
    setToggling(automation.id)
    // Optimistic
    setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, isActive: !a.isActive } : a))
    try {
      const res = await fetch(`/api/admin/crm/automations/${automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !automation.isActive, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error()
      addToast(automation.isActive ? 'Automação desativada' : 'Automação ativada')
    } catch {
      setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, isActive: automation.isActive } : a))
      addToast('Erro ao alterar status', 'error')
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (automationId: string) => {
    if (!confirm('Excluir esta automação?')) return
    setDeleting(automationId)
    try {
      await fetch(`/api/admin/crm/automations/${automationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      })
      setAutomations(prev => prev.filter(a => a.id !== automationId))
      addToast('Automação excluída')
    } catch {
      addToast('Erro ao excluir', 'error')
    } finally {
      setDeleting(null)
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
            {automations.length} {automations.length === 1 ? 'regra' : 'regras'} · {automations.filter(a => a.isActive).length} ativas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {automations.length > 0 && (
            <>
              <button
                onClick={() => setShowLog(p => !p)}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: showLog ? 'rgba(212,175,55,0.1)' : '#1A1A1F',
                  color: showLog ? '#D4AF37' : '#8B8A94',
                  border: '1px solid #2A2A32',
                }}
              >
                Log
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: '#D4AF37', color: '#0A0A0B' }}
              >
                + Nova Regra
              </button>
            </>
          )}
        </div>
      </div>

      {automations.length === 0 ? (
        <EmptyState onCreateFirst={() => setShowModal(true)} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {automations.map((automation, i) => {
              const iconPath = TRIGGER_ICONS[automation.trigger] ?? TRIGGER_ICONS.LEAD_CREATED
              const flowAction = automation.flowJson?.action
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
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
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
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#2ECC8A' }} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#1A1A1F', color: '#D4AF37' }}>
                        {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
                      </span>
                      {flowAction && (
                        <>
                          <span className="text-[10px]" style={{ color: '#5A5A64' }}>→</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#1A1A1F', color: '#8B8A94' }}>
                            {ACTION_LABELS[flowAction] ?? flowAction}
                          </span>
                        </>
                      )}
                      {automation.flowJson?.conditions && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#4A7BFF18', color: '#4A7BFF' }}>
                          {automation.flowJson.conditions.length} condição(ões)
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] block mt-0.5" style={{ color: '#5A5A64' }}>
                      Atualizado: {formatDate(automation.updatedAt)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDelete(automation.id)}
                      disabled={deleting === automation.id}
                      className="p-1.5 rounded-lg transition-colors disabled:opacity-50 hover:bg-white/5"
                      style={{ color: '#8B8A94' }}
                      title="Excluir"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggle(automation)}
                      disabled={toggling === automation.id}
                      className="shrink-0 w-11 h-6 rounded-full relative transition-colors disabled:opacity-50"
                      style={{ background: automation.isActive ? '#D4AF37' : '#2A2A32' }}
                    >
                      <span
                        className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                        style={{
                          background: '#F0EDE8',
                          left: automation.isActive ? 'calc(100% - 22px)' : '2px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Execution Log */}
      {showLog && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ExecutionLog />
        </motion.div>
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
