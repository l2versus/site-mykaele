'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// ━━━ Types ━━━

interface ActionItem {
  type: string
  config: Record<string, unknown>
}

interface AutomationItem {
  id: string
  name: string
  trigger: string
  isActive: boolean
  flowJson: {
    action?: string
    actions?: ActionItem[]
    conditions?: { field: string; op: string; value: string }[]
    triggerConditions?: { field: string; op: string; value: string }[]
    message?: string
    stageId?: string
    subject?: string
    body?: string
    webhookUrl?: string
    tag?: string
  }
  createdAt: string
  updatedAt: string
}

interface LogItem {
  id: string
  automationId: string
  status: string
  error: string | null
  jobId: string | null
  payload: Record<string, unknown> | null
  executedAt: string
  automation: { name: string; trigger: string }
}

// ━━━ Constants ━━━

const TRIGGER_LABELS: Record<string, string> = {
  NEW_MESSAGE_RECEIVED: 'Nova mensagem recebida',
  LEAD_STAGE_CHANGED: 'Lead mudou de estágio',
  LEAD_STAGE_CHANGED_WON: 'Lead ganho',
  LEAD_STAGE_CHANGED_LOST: 'Lead perdido',
  LEAD_CREATED: 'Lead criado',
  CONTACT_IDLE: 'Contato inativo',
  APPOINTMENT_BOOKED: 'Agendamento criado',
  APPOINTMENT_COMPLETED: 'Agendamento concluído',
}

const ACTION_LABELS: Record<string, string> = {
  SEND_MESSAGE: 'Enviar mensagem WhatsApp',
  SEND_EMAIL: 'Enviar e-mail',
  MOVE_STAGE: 'Mover para estágio',
  ADD_TAG: 'Adicionar tag',
  NOTIFY_TEAM: 'Notificar equipe',
  SEND_WEBHOOK: 'Enviar webhook',
}

const ACTION_ICONS: Record<string, string> = {
  SEND_MESSAGE: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  SEND_EMAIL: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  MOVE_STAGE: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  ADD_TAG: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  NOTIFY_TEAM: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  SEND_WEBHOOK: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
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
  LEAD_STAGE_CHANGED_WON: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  LEAD_STAGE_CHANGED_LOST: 'M18 6L6 18M6 6l12 12',
  LEAD_CREATED: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
  CONTACT_IDLE: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4l3 3',
  APPOINTMENT_BOOKED: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
  APPOINTMENT_COMPLETED: 'M22 11.08V12a10 10 0 1 1-5.93-9.14',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Map virtual triggers to DB trigger + triggerConditions
function resolveVirtualTrigger(trigger: string): { dbTrigger: string; triggerConditions?: { field: string; op: string; value: string }[] } {
  if (trigger === 'LEAD_STAGE_CHANGED_WON') {
    return { dbTrigger: 'LEAD_STAGE_CHANGED', triggerConditions: [{ field: 'stageType', op: 'eq', value: 'WON' }] }
  }
  if (trigger === 'LEAD_STAGE_CHANGED_LOST') {
    return { dbTrigger: 'LEAD_STAGE_CHANGED', triggerConditions: [{ field: 'stageType', op: 'eq', value: 'LOST' }] }
  }
  return { dbTrigger: trigger }
}

// Get display trigger from DB trigger + triggerConditions
function getDisplayTrigger(trigger: string, flowJson: AutomationItem['flowJson']): string {
  if (trigger === 'LEAD_STAGE_CHANGED' && flowJson?.triggerConditions) {
    const wonCond = flowJson.triggerConditions.find(c => c.field === 'stageType' && c.value === 'WON')
    if (wonCond) return 'LEAD_STAGE_CHANGED_WON'
    const lostCond = flowJson.triggerConditions.find(c => c.field === 'stageType' && c.value === 'LOST')
    if (lostCond) return 'LEAD_STAGE_CHANGED_LOST'
  }
  return trigger
}

// ━━━ Empty Action ━━━
function emptyAction(): ActionItem {
  return { type: 'SEND_MESSAGE', config: {} }
}

// ━━━ Skeleton ━━━
function AutomationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
      ))}
    </div>
  )
}

// ━━━ Empty State ━━━
function EmptyState({ onCreateFirst }: { onCreateFirst: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.1)' }}
      >
        <svg width="36" height="36" fill="none" stroke="var(--crm-gold)" strokeWidth="1.2" viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>Automatize seu CRM</p>
      <p className="text-xs mt-1.5 max-w-xs text-center" style={{ color: 'var(--crm-text-muted)' }}>
        Crie regras automáticas que reagem a eventos como novas mensagens,
        mudanças de estágio e agendamentos.
      </p>
      <button
        onClick={onCreateFirst}
        className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)', boxShadow: '0 4px 16px rgba(212,175,55,0.25)' }}
      >
        + Criar Automação
      </button>
    </div>
  )
}

// ━━━ Action Editor Row ━━━
function ActionRow({ action, index, total, onChange, onRemove }: {
  action: ActionItem
  index: number
  total: number
  onChange: (a: ActionItem) => void
  onRemove: () => void
}) {
  const updateConfig = (key: string, value: unknown) => {
    onChange({ ...action, config: { ...action.config, [key]: value } })
  }

  return (
    <div className="rounded-lg p-3 relative" style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
            {index + 1}
          </span>
          <select
            value={action.type}
            onChange={e => onChange({ type: e.target.value, config: {} })}
            className="px-2 py-1 rounded text-xs focus:outline-none"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          >
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {total > 1 && (
          <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--crm-text-muted)' }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Config fields based on action type */}
      {action.type === 'SEND_MESSAGE' && (
        <textarea
          value={(action.config.message as string) ?? ''}
          onChange={e => updateConfig('message', e.target.value)}
          placeholder="Olá {{nome}}, tudo bem? ..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
        />
      )}

      {action.type === 'SEND_EMAIL' && (
        <div className="space-y-2">
          <input
            value={(action.config.subject as string) ?? ''}
            onChange={e => updateConfig('subject', e.target.value)}
            placeholder="Assunto do e-mail"
            className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          />
          <textarea
            value={(action.config.body as string) ?? ''}
            onChange={e => updateConfig('body', e.target.value)}
            placeholder="Corpo do e-mail (suporta {{nome}}, {{email}})"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          />
          <p className="text-[9px]" style={{ color: '#5A5A64' }}>Lead precisa ter e-mail cadastrado</p>
        </div>
      )}

      {action.type === 'SEND_WEBHOOK' && (
        <div className="space-y-2">
          <input
            value={(action.config.webhookUrl as string) ?? ''}
            onChange={e => updateConfig('webhookUrl', e.target.value)}
            placeholder="https://exemplo.com/webhook"
            className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
          />
          <p className="text-[9px]" style={{ color: '#5A5A64' }}>Envia HTTP POST com dados do lead em JSON</p>
        </div>
      )}

      {action.type === 'ADD_TAG' && (
        <input
          value={(action.config.tag as string) ?? ''}
          onChange={e => updateConfig('tag', e.target.value)}
          placeholder="Nome da tag (ex: vip, interessado)"
          className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
        />
      )}

      {action.type === 'NOTIFY_TEAM' && (
        <input
          value={(action.config.message as string) ?? ''}
          onChange={e => updateConfig('message', e.target.value)}
          placeholder="Mensagem da notificação"
          className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
        />
      )}

      {action.type === 'MOVE_STAGE' && (
        <input
          value={(action.config.stageId as string) ?? ''}
          onChange={e => updateConfig('stageId', e.target.value)}
          placeholder="ID do estágio de destino"
          className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
        />
      )}
    </div>
  )
}

// ━━━ Create/Edit Modal ━━━
function AutomationModal({ onClose, onSave, existing }: {
  onClose: () => void
  onSave: (data: { name: string; trigger: string; flowJson: Record<string, unknown> }) => void
  existing?: AutomationItem | null
}) {
  // Determine display trigger for editing
  const displayTrigger = existing
    ? getDisplayTrigger(existing.trigger, existing.flowJson)
    : 'NEW_MESSAGE_RECEIVED'

  const [name, setName] = useState(existing?.name ?? '')
  const [trigger, setTrigger] = useState(displayTrigger)
  const [saving, setSaving] = useState(false)

  // Multi-action support
  const existingActions: ActionItem[] = existing?.flowJson?.actions ?? (
    existing?.flowJson?.action
      ? [{
        type: existing.flowJson.action,
        config: {
          ...(existing.flowJson.message ? { message: existing.flowJson.message } : {}),
          ...(existing.flowJson.stageId ? { stageId: existing.flowJson.stageId } : {}),
          ...(existing.flowJson.tag ? { tag: existing.flowJson.tag } : {}),
          ...(existing.flowJson.subject ? { subject: existing.flowJson.subject } : {}),
          ...(existing.flowJson.body ? { body: existing.flowJson.body } : {}),
          ...(existing.flowJson.webhookUrl ? { webhookUrl: existing.flowJson.webhookUrl } : {}),
        },
      }]
      : [emptyAction()]
  )

  const [actions, setActions] = useState<ActionItem[]>(existingActions)
  const [conditions, setConditions] = useState<{ field: string; op: string; value: string }[]>(
    existing?.flowJson?.conditions ?? []
  )

  const addAction = () => setActions(prev => [...prev, emptyAction()])
  const updateAction = (idx: number, a: ActionItem) => setActions(prev => prev.map((x, i) => i === idx ? a : x))
  const removeAction = (idx: number) => setActions(prev => prev.filter((_, i) => i !== idx))

  const addCondition = () => setConditions(prev => [...prev, { field: 'lead.status', op: 'eq', value: '' }])
  const removeCondition = (idx: number) => setConditions(prev => prev.filter((_, i) => i !== idx))
  const updateCondition = (idx: number, updates: Partial<{ field: string; op: string; value: string }>) => {
    setConditions(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || actions.length === 0) return
    setSaving(true)

    const { dbTrigger, triggerConditions } = resolveVirtualTrigger(trigger)

    onSave({
      name,
      trigger: dbTrigger,
      flowJson: {
        actions,
        conditions: conditions.length > 0 ? conditions : undefined,
        triggerConditions: triggerConditions ?? undefined,
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg rounded-2xl border p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--crm-text)' }}>
          {existing ? 'Editar Automação' : 'Nova Automação'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--crm-text-muted)' }}>Nome *</label>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="Ex: Boas-vindas automática"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--crm-text-muted)' }}>Quando (Gatilho) *</label>
            <select
              value={trigger} onChange={e => setTrigger(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
            >
              {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Actions (multi) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>
                Então (Ações) * <span className="font-normal">— {actions.length} ação(ões)</span>
              </label>
              <button type="button" onClick={addAction}
                className="text-[10px] px-2 py-1 rounded-lg transition-colors"
                style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
              >
                + Ação
              </button>
            </div>
            <div className="space-y-2">
              {actions.map((act, idx) => (
                <ActionRow
                  key={idx}
                  action={act}
                  index={idx}
                  total={actions.length}
                  onChange={a => updateAction(idx, a)}
                  onRemove={() => removeAction(idx)}
                />
              ))}
            </div>
          </div>

          {/* Variable hints */}
          <div className="rounded-lg p-2.5" style={{ background: 'rgba(74,123,255,0.06)', border: '1px solid rgba(74,123,255,0.1)' }}>
            <p className="text-[9px] font-medium" style={{ color: '#4A7BFF' }}>
              Variáveis disponíveis: {'{{nome}}'} {'{{telefone}}'} {'{{email}}'}
            </p>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>Condições (opcional)</label>
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
                  style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                >
                  {Object.entries(CONDITION_FIELDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={cond.op} onChange={e => updateCondition(idx, { op: e.target.value })}
                  className="w-28 px-2 py-1.5 rounded text-xs focus:outline-none"
                  style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                >
                  {Object.entries(CONDITION_OPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input value={cond.value} onChange={e => updateCondition(idx, { value: e.target.value })}
                  placeholder="valor"
                  className="w-24 px-2 py-1.5 rounded text-xs focus:outline-none"
                  style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
                <button type="button" onClick={() => removeCondition(idx)}
                  className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--crm-text-muted)' }}
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-lg p-3" style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>Resumo da regra</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--crm-text)' }}>
              <span style={{ color: 'var(--crm-gold)' }}>Quando</span> {TRIGGER_LABELS[trigger]?.toLowerCase() ?? trigger}
              {conditions.length > 0 && (
                <>
                  <span style={{ color: 'var(--crm-gold)' }}> se</span> {conditions.map((c, i) =>
                    `${CONDITION_FIELDS[c.field] ?? c.field} ${CONDITION_OPS[c.op] ?? c.op} "${c.value}"${i < conditions.length - 1 ? ' e ' : ''}`
                  ).join('')}
                </>
              )}
              <span style={{ color: 'var(--crm-gold)' }}> então</span>{' '}
              {actions.map((a, i) => (
                <span key={i}>
                  {ACTION_LABELS[a.type]?.toLowerCase() ?? a.type}
                  {i < actions.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
            >Cancelar</button>
            <button type="submit" disabled={saving || !name.trim() || actions.length === 0}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: 'var(--crm-gold)', color: 'var(--crm-bg)' }}
            >{saving ? 'Salvando...' : existing ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ━━━ Execution Log (real data from API) ━━━
function ExecutionLog({ logs, isLoading }: { logs: LogItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--crm-border)' }}>
        <div className="px-4 py-3" style={{ background: 'var(--crm-surface)', borderBottom: '1px solid var(--crm-border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>Log de Execução</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--crm-gold)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--crm-border)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
      <div className="px-4 py-3" style={{ background: 'var(--crm-surface)', borderBottom: '1px solid var(--crm-border)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>Log de Execução</span>
        <span className="text-[10px] ml-2" style={{ color: 'var(--crm-text-muted)' }}>
          {logs.length === 0 ? 'Nenhuma execução' : `${logs.length} últimas execuções`}
        </span>
      </div>
      {logs.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Nenhuma execução registrada ainda</p>
          <p className="text-[10px] mt-1" style={{ color: '#5A5A64' }}>As automações serão executadas quando os gatilhos dispararem</p>
        </div>
      ) : (
        logs.map(log => (
          <div key={log.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--crm-surface-2)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: log.status === 'SUCCESS' ? '#2ECC8A' : log.status === 'FAILED' ? '#FF6B4A' : 'var(--crm-text-muted)' }}
            />
            <span className="text-xs flex-1 truncate" style={{ color: 'var(--crm-text)' }}>{log.automation.name}</span>
            <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--crm-text-muted)' }}>
              {TRIGGER_LABELS[log.automation.trigger] ?? log.automation.trigger}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>{formatDate(log.executedAt)}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: log.status === 'SUCCESS' ? '#2ECC8A18' : log.status === 'FAILED' ? '#FF6B4A18' : '#8B8A9418',
                color: log.status === 'SUCCESS' ? '#2ECC8A' : log.status === 'FAILED' ? '#FF6B4A' : 'var(--crm-text-muted)',
              }}
            >
              {log.status === 'SUCCESS' ? 'OK' : log.status === 'FAILED' ? 'Erro' : 'Pulou'}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

// ━━━ Main Page ━━━
export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<AutomationItem | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerStatus, setTriggerStatus] = useState<Record<string, 'success' | 'error'>>({})
  const [showLog, setShowLog] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
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

  const fetchLogs = useCallback(async () => {
    if (!token) return
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/admin/crm/automations/logs?tenantId=${TENANT_ID}&limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs ?? [])
      }
    } catch {
      // Silently fail — logs are supplementary
    } finally {
      setLogsLoading(false)
    }
  }, [token])

  useEffect(() => { fetchAutomations() }, [fetchAutomations])

  useEffect(() => {
    if (showLog) fetchLogs()
  }, [showLog, fetchLogs])

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

  const handleEdit = async (data: { name: string; trigger: string; flowJson: Record<string, unknown> }) => {
    if (!editingAutomation) return
    try {
      const res = await fetch(`/api/admin/crm/automations/${editingAutomation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, tenantId: TENANT_ID }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar automação')
      setEditingAutomation(null)
      addToast('Automação atualizada')
      fetchAutomations()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao atualizar', 'error')
    }
  }

  const handleToggle = async (automation: AutomationItem) => {
    setToggling(automation.id)
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
      const res = await fetch(`/api/admin/crm/automations/${automationId}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Falha ao excluir')
      setAutomations(prev => prev.filter(a => a.id !== automationId))
      addToast('Automação excluída')
    } catch {
      addToast('Erro ao excluir', 'error')
    } finally {
      setDeleting(null)
    }
  }

  const handleTrigger = async (automationId: string) => {
    setTriggering(automationId)
    setTriggerStatus(prev => { const n = { ...prev }; delete n[automationId]; return n })
    try {
      const res = await fetch(`/api/admin/crm/automations/${automationId}/trigger?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setTriggerStatus(prev => ({ ...prev, [automationId]: 'success' }))
      addToast('Automação disparada!')
      // Refresh logs if visible
      if (showLog) fetchLogs()
    } catch (err) {
      setTriggerStatus(prev => ({ ...prev, [automationId]: 'error' }))
      addToast(err instanceof Error ? err.message : 'Erro ao disparar automação', 'error')
    } finally {
      setTriggering(null)
      setTimeout(() => {
        setTriggerStatus(prev => { const n = { ...prev }; delete n[automationId]; return n })
      }, 2000)
    }
  }

  if (isLoading) return <AutomationsSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm" style={{ color: '#FF6B4A' }}>{error}</p>
        <button onClick={fetchAutomations} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
        >Tentar novamente</button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--crm-text)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
              <svg width="16" height="16" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            Automações
          </h1>
          <p className="text-xs mt-1 ml-[42px]" style={{ color: 'var(--crm-text-muted)' }}>
            {automations.length} {automations.length === 1 ? 'regra' : 'regras'} · {automations.filter(a => a.isActive).length} ativas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {automations.length > 0 && (
            <>
              <button
                onClick={() => setShowLog(p => !p)}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: showLog ? 'rgba(212,175,55,0.08)' : 'var(--crm-surface-2)',
                  color: showLog ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                  border: '1px solid var(--crm-border)',
                }}
              >
                Log
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)', boxShadow: '0 4px 16px rgba(212,175,55,0.25)' }}
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
              const displayTrigger = getDisplayTrigger(automation.trigger, automation.flowJson)
              const iconPath = TRIGGER_ICONS[displayTrigger] ?? TRIGGER_ICONS.LEAD_CREATED
              const flowActions = automation.flowJson?.actions ?? []
              const singleAction = automation.flowJson?.action

              return (
                <motion.div
                  key={automation.id}
                  className="p-4 rounded-xl border transition-all"
                  style={{
                    background: 'var(--crm-surface)',
                    borderColor: automation.isActive ? 'rgba(212,175,55,0.2)' : 'var(--crm-border)',
                    boxShadow: automation.isActive ? '0 0 0 1px rgba(212,175,55,0.06)' : 'none',
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -1, boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: automation.isActive ? 'rgba(212,175,55,0.1)' : 'var(--crm-surface-2)' }}
                    >
                      <svg width="18" height="18" fill="none"
                        stroke={automation.isActive ? '#D4AF37' : 'var(--crm-text-muted)'}
                        strokeWidth="1.5" viewBox="0 0 24 24"
                      >
                        <path d={iconPath} />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--crm-text)' }}>
                          {automation.name}
                        </span>
                        {automation.isActive && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#2ECC8A' }} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--crm-surface-2)', color: '#D4AF37' }}>
                          {TRIGGER_LABELS[displayTrigger] ?? displayTrigger}
                        </span>
                        <span className="text-[10px]" style={{ color: '#5A5A64' }}>→</span>
                        {flowActions.length > 0 ? (
                          flowActions.map((act, ai) => (
                            <span key={ai} className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                              style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}
                            >
                              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path d={ACTION_ICONS[act.type] ?? ACTION_ICONS.SEND_MESSAGE} />
                              </svg>
                              {ACTION_LABELS[act.type] ?? act.type}
                            </span>
                          ))
                        ) : singleAction ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}>
                            {ACTION_LABELS[singleAction] ?? singleAction}
                          </span>
                        ) : null}
                        {automation.flowJson?.conditions && automation.flowJson.conditions.length > 0 && (
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
                      {/* Testar Agora */}
                      <button
                        onClick={() => handleTrigger(automation.id)}
                        disabled={triggering === automation.id || !!triggerStatus[automation.id]}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-70 hover:brightness-110"
                        style={{
                          background: triggerStatus[automation.id] === 'success'
                            ? '#2ECC8A18' : triggerStatus[automation.id] === 'error'
                            ? '#FF6B4A18' : 'rgba(212,175,55,0.08)',
                          color: triggerStatus[automation.id] === 'success'
                            ? '#2ECC8A' : triggerStatus[automation.id] === 'error'
                            ? '#FF6B4A' : '#D4AF37',
                          border: `1px solid ${triggerStatus[automation.id] === 'success'
                            ? '#2ECC8A30' : triggerStatus[automation.id] === 'error'
                            ? '#FF6B4A30' : 'rgba(212,175,55,0.15)'}`,
                        }}
                        title="Disparar manualmente (modo teste)"
                      >
                        {triggering === automation.id
                          ? 'Disparando...'
                          : triggerStatus[automation.id] === 'success'
                          ? 'Disparado'
                          : triggerStatus[automation.id] === 'error'
                          ? 'Erro'
                          : 'Testar'}
                      </button>
                      <button
                        onClick={() => setEditingAutomation(automation)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                        style={{ color: 'var(--crm-text-muted)' }}
                        title="Editar"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(automation.id)}
                        disabled={deleting === automation.id}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-50 hover:bg-white/5"
                        style={{ color: 'var(--crm-text-muted)' }}
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
                        style={{ background: automation.isActive ? '#D4AF37' : 'var(--crm-border)' }}
                      >
                        <span
                          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                          style={{
                            background: 'var(--crm-text)',
                            left: automation.isActive ? 'calc(100% - 22px)' : '2px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      </button>
                    </div>
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
          <ExecutionLog logs={logs} isLoading={logsLoading} />
        </motion.div>
      )}

      {/* Modal — Create */}
      {showModal && (
        <AutomationModal
          onClose={() => setShowModal(false)}
          onSave={handleCreate}
        />
      )}

      {/* Modal — Edit */}
      {editingAutomation && (
        <AutomationModal
          existing={editingAutomation}
          onClose={() => setEditingAutomation(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  )
}
