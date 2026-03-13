'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'
import {
  getWhatsAppStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  restartWhatsApp,
} from '../../../../actions/crm/whatsapp-connection'

// ━━━ Types ━━━

type TabId = 'general' | 'pipeline' | 'whatsapp' | 'notifications' | 'team' | 'ai' | 'knowledge'

interface BusinessHour {
  day: string
  enabled: boolean
  open: string
  close: string
}

interface PipelineStage {
  id: string
  name: string
  color: string
  type: 'OPEN' | 'WON' | 'LOST'
  leadCount: number
}

interface NotificationEvent {
  id: string
  label: string
  email: boolean
  whatsapp: boolean
  browser: boolean
  frequency: 'immediate' | 'hourly' | 'daily'
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Vendedor' | 'Suporte'
  status: 'online' | 'offline'
  lastActive: string
}

interface AiFeature {
  id: string
  name: string
  description: string
  enabled: boolean
  isBeta?: boolean
}

interface KnowledgeSource {
  id: string
  name: string
  type: 'Texto' | 'Arquivo'
  chunks: number
  usageCount: number
  language: string
  updatedBy: string
  updatedAt: string
}

// ━━━ Constants ━━━

const STAGE_COLORS = ['#4A7BFF', '#F0A500', '#FF6B4A', '#D4AF37', '#2ECC8A', 'var(--crm-text-muted)']

const TIMEZONES = [
  'America/Fortaleza',
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Recife',
  'America/Bahia',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Rio_Branco',
]

const FREQUENCY_LABELS: Record<string, string> = {
  immediate: 'Imediatamente',
  hourly: 'A cada hora',
  daily: 'Uma vez por dia',
}

const AI_MODELS = ['GPT-4o', 'GPT-4o-mini', 'Claude 3.5']

// ━━━ Tab definitions ━━━

const TABS: { id: TabId; label: string; iconPath: string }[] = [
  {
    id: 'general',
    label: 'Geral',
    iconPath: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    iconPath: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    iconPath: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z',
  },
  {
    id: 'notifications',
    label: 'Notificações',
    iconPath: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  },
  {
    id: 'team',
    label: 'Equipe',
    iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  },
  {
    id: 'ai',
    label: 'IA',
    iconPath: 'M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22 M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93 M9 12h6 M8 16h8',
  },
  {
    id: 'knowledge',
    label: 'Conhecimento',
    iconPath: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  },
]

// ━━━ Animation variants ━━━

const tabContentVariants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

// ━━━ Reusable Components ━━━

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--crm-text)' }}>
      {children}
    </h3>
  )
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
    >
      {children}
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-1"
        style={{
          background: 'var(--crm-surface-2)',
          border: '1px solid var(--crm-border)',
          color: 'var(--crm-text)',
          borderRadius: '8px',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--crm-gold)'; e.currentTarget.style.outline = '1px solid var(--crm-gold)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-200 appearance-none cursor-pointer"
        style={{
          background: 'var(--crm-surface-2)',
          border: '1px solid var(--crm-border)',
          color: 'var(--crm-text)',
          borderRadius: '8px',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({ enabled, onToggle, size = 'md' }: { enabled: boolean; onToggle: () => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 'w-8' : 'w-10'
  const h = size === 'sm' ? 'h-4' : 'h-5'
  const dot = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const translate = size === 'sm' ? 'translateX(16px)' : 'translateX(20px)'

  return (
    <button
      onClick={onToggle}
      className={`${w} ${h} rounded-full relative transition-colors duration-200 flex-shrink-0`}
      style={{ background: enabled ? '#D4AF37' : 'var(--crm-border)' }}
    >
      <span
        className={`${dot} rounded-full absolute top-0.5 left-0.5 transition-transform duration-200`}
        style={{
          background: enabled ? 'var(--crm-bg)' : 'var(--crm-text-muted)',
          transform: enabled ? translate : 'translateX(0)',
        }}
      />
    </button>
  )
}

// ━━━ Tab: Geral ━━━

function GeneralTab() {
  const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
  const PROVIDER_KEY = 'crm-general'

  const [workspaceName, setWorkspaceName] = useState('Clínica Mykaele Procópio')
  const [timezone, setTimezone] = useState('America/Fortaleza')
  const [language, setLanguage] = useState('pt-BR')
  const [currency] = useState('BRL')
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([
    { day: 'Segunda', enabled: true, open: '08:00', close: '18:00' },
    { day: 'Terça', enabled: true, open: '08:00', close: '18:00' },
    { day: 'Quarta', enabled: true, open: '08:00', close: '18:00' },
    { day: 'Quinta', enabled: true, open: '08:00', close: '18:00' },
    { day: 'Sexta', enabled: true, open: '08:00', close: '18:00' },
    { day: 'Sábado', enabled: true, open: '09:00', close: '14:00' },
    { day: 'Domingo', enabled: false, open: '09:00', close: '13:00' },
  ])
  const hasFetched = useRef(false)

  const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null

  // Carregar configurações gerais do banco
  useEffect(() => {
    if (hasFetched.current || !token) return
    hasFetched.current = true

    fetch(`/api/admin/crm/settings?tenantId=${TENANT_ID}&provider=${PROVIDER_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          const s = data.settings
          if (s.workspaceName) setWorkspaceName(s.workspaceName as string)
          if (s.timezone) setTimezone(s.timezone as string)
          if (s.language) setLanguage(s.language as string)
          if (s.businessHours) {
            try { setBusinessHours(s.businessHours as BusinessHour[]) } catch { /* ignore */ }
          }
        }
      })
      .catch(() => { /* primeira vez sem settings */ })
  }, [TENANT_ID, token])

  // Salvar quando o botão global "Salvar" é clicado
  useEffect(() => {
    const handleSaveEvent = () => {
      if (!token) return
      fetch('/api/admin/crm/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          provider: PROVIDER_KEY,
          workspaceName,
          timezone,
          language,
          businessHours,
        }),
      }).catch(err => { console.error('[GeneralTab] save error:', err) })
    }
    window.addEventListener('crm-settings-save', handleSaveEvent)
    return () => window.removeEventListener('crm-settings-save', handleSaveEvent)
  }, [token, TENANT_ID, workspaceName, timezone, language, businessHours])

  const toggleDay = (idx: number) => {
    setBusinessHours(prev => prev.map((h, i) => i === idx ? { ...h, enabled: !h.enabled } : h))
  }

  const updateHour = (idx: number, field: 'open' | 'close', value: string) => {
    setBusinessHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionTitle>Workspace</SectionTitle>
        <SectionCard>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Nome do workspace" value={workspaceName} onChange={setWorkspaceName} />
            <SelectField
              label="Fuso horário"
              value={timezone}
              onChange={setTimezone}
              options={TIMEZONES.map(tz => ({ value: tz, label: tz.replace('America/', '').replace(/_/g, ' ') }))}
            />
            <SelectField
              label="Idioma"
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'pt-BR', label: 'Português (Brasil)' },
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
              ]}
            />
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                Moeda
              </label>
              <div
                className="w-full rounded-lg px-3 py-2.5 text-sm flex items-center gap-2"
                style={{
                  background: 'var(--crm-surface-2)',
                  border: '1px solid var(--crm-border)',
                  color: 'var(--crm-text)',
                  borderRadius: '8px',
                  opacity: 0.7,
                }}
              >
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--crm-gold)' }}>
                  R$
                </span>
                {currency} - Real Brasileiro
              </div>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      <motion.div variants={staggerItem}>
        <SectionTitle>Horário Comercial</SectionTitle>
        <SectionCard>
          <div className="space-y-2">
            {businessHours.map((bh, idx) => (
              <div
                key={bh.day}
                className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-150"
                style={{
                  background: bh.enabled ? 'rgba(212,175,55,0.03)' : 'transparent',
                }}
              >
                <Toggle enabled={bh.enabled} onToggle={() => toggleDay(idx)} size="sm" />
                <span
                  className="w-20 text-sm font-medium"
                  style={{ color: bh.enabled ? 'var(--crm-text)' : 'var(--crm-text-muted)' }}
                >
                  {bh.day}
                </span>
                {bh.enabled ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="time"
                      value={bh.open}
                      onChange={e => updateHour(idx, 'open', e.target.value)}
                      className="rounded-md px-2 py-1 text-xs outline-none"
                      style={{
                        background: 'var(--crm-surface-2)',
                        border: '1px solid var(--crm-border)',
                        color: 'var(--crm-text)',
                      }}
                    />
                    <span className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>até</span>
                    <input
                      type="time"
                      value={bh.close}
                      onChange={e => updateHour(idx, 'close', e.target.value)}
                      className="rounded-md px-2 py-1 text-xs outline-none"
                      style={{
                        background: 'var(--crm-surface-2)',
                        border: '1px solid var(--crm-border)',
                        color: 'var(--crm-text)',
                      }}
                    />
                  </div>
                ) : (
                  <span className="ml-auto text-xs" style={{ color: 'var(--crm-text-muted)' }}>Fechado</span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </motion.div>
    </motion.div>
  )
}

// ━━━ Tab: Pipeline (CRUD Real — banco de dados) ━━━

function PipelineTab() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addingStage, setAddingStage] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const addToast = useToastStore(s => s.addToast)
  const hasFetched = useRef(false)

  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'

  // Buscar token do localStorage
  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('admin_token') || localStorage.getItem('token') || document.cookie.match(/token=([^;]+)/)?.[1] || null
  }, [])

  // Carregar estágios do banco
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }

    fetch(`/api/admin/crm/stages?tenantId=${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.stages) {
          setPipelineId(data.pipeline?.id || null)
          setStages(data.stages.map((s: { id: string; name: string; color: string | null; type: string; cachedLeadCount: number }) => ({
            id: s.id,
            name: s.name,
            color: s.color || '#4A7BFF',
            type: s.type as 'OPEN' | 'WON' | 'LOST',
            leadCount: s.cachedLeadCount,
          })))
        }
      })
      .catch(err => {
        console.error('[PipelineTab] fetch error:', err)
        addToast('Erro ao carregar estágios')
      })
      .finally(() => setLoading(false))
  }, [tenantId, getToken, addToast])

  // Editar nome inline
  const startEdit = (stage: PipelineStage) => {
    setEditingId(stage.id)
    setEditingName(stage.name)
  }

  const finishEdit = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null)
      setEditingName('')
      return
    }

    const oldStage = stages.find(s => s.id === editingId)
    if (!oldStage || oldStage.name === editingName.trim()) {
      setEditingId(null)
      setEditingName('')
      return
    }

    // Optimistic update
    const trimmedName = editingName.trim()
    setStages(prev => prev.map(s => s.id === editingId ? { ...s, name: trimmedName } : s))
    setEditingId(null)
    setEditingName('')

    const token = getToken()
    if (!token) return

    setSavingId(editingId)
    try {
      const res = await fetch(`/api/admin/crm/stages/${oldStage.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      addToast('Nome atualizado')
    } catch {
      // Reverter
      setStages(prev => prev.map(s => s.id === oldStage.id ? { ...s, name: oldStage.name } : s))
      addToast('Erro ao atualizar nome')
    } finally {
      setSavingId(null)
    }
  }

  // Alterar cor
  const changeColor = async (stageId: string, color: string) => {
    setColorPickerId(null)

    // Optimistic update
    const oldStage = stages.find(s => s.id === stageId)
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, color } : s))

    const token = getToken()
    if (!token) return

    setSavingId(stageId)
    try {
      const res = await fetch(`/api/admin/crm/stages/${stageId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
    } catch {
      if (oldStage) setStages(prev => prev.map(s => s.id === stageId ? { ...s, color: oldStage.color } : s))
      addToast('Erro ao atualizar cor')
    } finally {
      setSavingId(null)
    }
  }

  // Alterar tipo
  const changeType = async (stageId: string, type: 'OPEN' | 'WON' | 'LOST') => {
    const oldStage = stages.find(s => s.id === stageId)
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, type } : s))

    const token = getToken()
    if (!token) return

    setSavingId(stageId)
    try {
      const res = await fetch(`/api/admin/crm/stages/${stageId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
    } catch {
      if (oldStage) setStages(prev => prev.map(s => s.id === stageId ? { ...s, type: oldStage.type } : s))
      addToast('Erro ao atualizar tipo')
    } finally {
      setSavingId(null)
    }
  }

  // Deletar estágio (com trava de segurança no backend)
  const removeStage = async (stageId: string) => {
    const token = getToken()
    if (!token) return

    setDeletingId(stageId)
    try {
      const res = await fetch(`/api/admin/crm/stages/${stageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'STAGE_HAS_LEADS') {
          addToast(`${data.error}`)
        } else {
          addToast(data.error || 'Erro ao deletar estágio')
        }
        return
      }

      setStages(prev => prev.filter(s => s.id !== stageId))
      addToast('Estágio removido')
    } catch {
      addToast('Erro ao deletar estágio')
    } finally {
      setDeletingId(null)
    }
  }

  // Adicionar novo estágio
  const addStage = async () => {
    if (!pipelineId) {
      addToast('Pipeline não encontrado')
      return
    }

    const token = getToken()
    if (!token) return

    setAddingStage(true)
    try {
      const newColor = STAGE_COLORS[stages.length % STAGE_COLORS.length]
      const res = await fetch('/api/admin/crm/stages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          pipelineId,
          name: 'Nova Etapa',
          color: newColor,
          type: 'OPEN',
        }),
      })

      if (!res.ok) throw new Error('Erro ao criar')

      const data = await res.json()
      const newStage: PipelineStage = {
        id: data.stage.id,
        name: data.stage.name,
        color: data.stage.color || newColor,
        type: data.stage.type,
        leadCount: 0,
      }

      // Inserir antes das colunas WON/LOST
      setStages(prev => {
        const open = prev.filter(s => s.type === 'OPEN')
        const nonOpen = prev.filter(s => s.type !== 'OPEN')
        return [...open, newStage, ...nonOpen]
      })
      addToast('Etapa criada')

      // Iniciar edição do nome imediatamente
      setTimeout(() => {
        setEditingId(data.stage.id)
        setEditingName('Nova Etapa')
      }, 100)
    } catch {
      addToast('Erro ao criar etapa')
    } finally {
      setAddingStage(false)
    }
  }

  // Drag-and-drop para reordenar
  const handleDragStart = (idx: number) => {
    setDragIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  const handleDrop = async (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null)
      setDragOverIdx(null)
      return
    }

    // Reordenar localmente
    const reordered = [...stages]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(dropIdx, 0, moved)
    setStages(reordered)
    setDragIdx(null)
    setDragOverIdx(null)

    // Persistir no banco
    const token = getToken()
    if (!token) return

    try {
      const res = await fetch('/api/admin/crm/stages', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          stages: reordered.map((s, idx) => ({ id: s.id, order: idx })),
        }),
      })
      if (!res.ok) throw new Error('Erro ao reordenar')
      addToast('Ordem atualizada')
    } catch {
      addToast('Erro ao salvar ordem')
    }
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    OPEN: { label: 'Aberto', color: '#4A7BFF' },
    WON: { label: 'Ganho', color: '#2ECC8A' },
    LOST: { label: 'Perdido', color: 'var(--crm-text-muted)' },
  }

  // Skeleton de carregamento
  if (loading) {
    return (
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
        <motion.div variants={staggerItem}>
          <SectionTitle>Etapas do Pipeline</SectionTitle>
          <SectionCard>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-center gap-3 py-2.5 px-3">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--crm-border)' }} />
                  <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: 'var(--crm-border)' }} />
                  <div className="flex-1 h-4 rounded animate-pulse" style={{ background: 'var(--crm-border)' }} />
                  <div className="w-14 h-5 rounded animate-pulse" style={{ background: 'var(--crm-border)' }} />
                  <div className="w-16 h-4 rounded animate-pulse" style={{ background: 'var(--crm-border)' }} />
                </div>
              ))}
            </div>
          </SectionCard>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem}>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Etapas do Pipeline</SectionTitle>
          {stages.length > 0 && (
            <span className="text-[10px] font-medium px-2 py-1 rounded-md" style={{ background: 'rgba(212,175,55,0.06)', color: 'var(--crm-text-muted)' }}>
              {stages.length} etapa{stages.length !== 1 ? 's' : ''} &middot; salva automaticamente
            </span>
          )}
        </div>
        <SectionCard>
          {stages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.1)' }}
              >
                <svg width="24" height="24" fill="none" stroke="var(--crm-gold)" strokeWidth="1.2" viewBox="0 0 24 24">
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Nenhuma etapa configurada</p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'var(--crm-text-muted)' }}>
                Crie as etapas do funil de vendas do seu CRM
              </p>
              <button
                onClick={addStage}
                disabled={addingStage}
                className="px-5 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)' }}
              >
                {addingStage ? 'Criando...' : '+ Criar primeira etapa'}
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg group transition-all duration-150 hover:bg-white/[0.02]"
                    style={{
                      opacity: dragIdx === idx ? 0.4 : 1,
                      borderTop: dragOverIdx === idx && dragIdx !== null && dragIdx !== idx ? '2px solid var(--crm-gold)' : '2px solid transparent',
                    }}
                  >
                    {/* Drag handle */}
                    <svg width="14" height="14" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24" className="opacity-40 group-hover:opacity-80 cursor-grab flex-shrink-0">
                      <line x1="8" y1="6" x2="8" y2="6.01" />
                      <line x1="16" y1="6" x2="16" y2="6.01" />
                      <line x1="8" y1="12" x2="8" y2="12.01" />
                      <line x1="16" y1="12" x2="16" y2="12.01" />
                      <line x1="8" y1="18" x2="8" y2="18.01" />
                      <line x1="16" y1="18" x2="16" y2="18.01" />
                    </svg>

                    {/* Color dot + picker */}
                    <div className="relative">
                      <button
                        onClick={() => setColorPickerId(colorPickerId === stage.id ? null : stage.id)}
                        className="w-4 h-4 rounded-full transition-transform hover:scale-125 flex-shrink-0"
                        style={{ background: stage.color, boxShadow: `0 0 8px ${stage.color}40` }}
                      />
                      <AnimatePresence>
                        {colorPickerId === stage.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-2 flex gap-1.5 p-2 rounded-lg z-10"
                            style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                          >
                            {STAGE_COLORS.map(c => (
                              <button
                                key={c}
                                onClick={() => changeColor(stage.id, c)}
                                className="w-5 h-5 rounded-full transition-transform hover:scale-125"
                                style={{
                                  background: c,
                                  outline: stage.color === c ? '2px solid var(--crm-text)' : 'none',
                                  outlineOffset: '2px',
                                }}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Name */}
                    {editingId === stage.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={finishEdit}
                        onKeyDown={e => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') { setEditingId(null); setEditingName('') } }}
                        className="flex-1 bg-transparent text-sm outline-none px-2 py-1 rounded-md"
                        style={{ color: 'var(--crm-text)', border: '1px solid var(--crm-gold)' }}
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(stage)}
                        className="flex-1 text-sm font-medium cursor-text flex items-center gap-2"
                        style={{ color: 'var(--crm-text)' }}
                      >
                        {stage.name}
                        {savingId === stage.id && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin flex-shrink-0">
                            <circle cx="12" cy="12" r="10" stroke="var(--crm-gold)" strokeWidth="2" opacity="0.3" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--crm-gold)" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                    )}

                    {/* Type badge */}
                    <select
                      value={stage.type}
                      onChange={e => changeType(stage.id, e.target.value as 'OPEN' | 'WON' | 'LOST')}
                      className="text-[10px] font-bold px-2 py-1 rounded-md outline-none cursor-pointer appearance-none"
                      style={{
                        background: `${TYPE_LABELS[stage.type].color}15`,
                        color: TYPE_LABELS[stage.type].color,
                        border: 'none',
                      }}
                    >
                      <option value="OPEN">Aberto</option>
                      <option value="WON">Ganho</option>
                      <option value="LOST">Perdido</option>
                    </select>

                    {/* Lead count */}
                    <span className="text-xs tabular-nums" style={{ color: 'var(--crm-text-muted)' }}>
                      {stage.leadCount} lead{stage.leadCount !== 1 ? 's' : ''}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => removeStage(stage.id)}
                      disabled={deletingId === stage.id}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/10 disabled:opacity-30"
                    >
                      {deletingId === stage.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                          <circle cx="12" cy="12" r="10" stroke="#FF6B4A" strokeWidth="2" opacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="#FF6B4A" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" fill="none" stroke="#FF6B4A" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addStage}
                disabled={addingStage}
                className="mt-4 w-full py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border border-dashed disabled:opacity-50"
                style={{
                  borderColor: 'var(--crm-border)',
                  color: 'var(--crm-text-muted)',
                  background: 'transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--crm-gold)'
                  e.currentTarget.style.color = 'var(--crm-gold)'
                  e.currentTarget.style.background = 'rgba(212,175,55,0.04)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--crm-border)'
                  e.currentTarget.style.color = 'var(--crm-text-muted)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {addingStage ? 'Criando...' : '+ Adicionar Etapa'}
              </button>
            </>
          )}
        </SectionCard>
      </motion.div>

      {/* Pipeline Preview */}
      {stages.length > 0 && (
        <motion.div variants={staggerItem}>
          <SectionTitle>Visualização</SectionTitle>
          <SectionCard>
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              {stages.map((stage, idx) => (
                <div key={stage.id} className="flex items-center gap-1 flex-shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ background: stage.color, boxShadow: `0 0 10px ${stage.color}40` }}
                    />
                    <span className="text-[9px] font-medium max-w-[60px] truncate text-center" style={{ color: 'var(--crm-text-muted)' }}>
                      {stage.name}
                    </span>
                  </div>
                  {idx < stages.length - 1 && (
                    <div className="w-6 h-px flex-shrink-0 mt-[-12px]" style={{ background: 'var(--crm-border)' }} />
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </motion.div>
      )}
    </motion.div>
  )
}

// ━━━ Tab: WhatsApp ━━━

type WaConnectionState = 'open' | 'close' | 'connecting' | 'unknown'

function WhatsAppTab() {
  const [connectionState, setConnectionState] = useState<WaConnectionState>('unknown')
  const [qrBase64, setQrBase64] = useState<string | null>(null)
  const [instanceName, setInstanceName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addToast = useToastStore(s => s.addToast)

  // ━━━ Auto-reply state ━━━
  const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
  const [arEnabled, setArEnabled] = useState(false)
  const [arMessage, setArMessage] = useState(
    'Olá {{nome}}! Obrigada por entrar em contato com a Mykaele Home Spa. Em breve retornaremos!'
  )
  const [arDelay, setArDelay] = useState(4000)
  const [arSaving, setArSaving] = useState(false)
  const arFetched = useRef(false)

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('admin_token') || localStorage.getItem('token') || null
  }, [])

  // Carregar config de auto-reply do banco
  useEffect(() => {
    if (arFetched.current) return
    arFetched.current = true
    const token = getToken()
    if (!token) return

    fetch(`/api/admin/crm/settings?tenantId=${TENANT_ID}&provider=auto-reply`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          const s = data.settings
          if (s.enabled !== undefined) setArEnabled(s.enabled as boolean)
          if (typeof s.message === 'string' && s.message) setArMessage(s.message)
          if (typeof s.delayMs === 'number') setArDelay(s.delayMs)
        }
      })
      .catch(() => { /* primeira vez sem settings */ })
  }, [TENANT_ID, getToken])

  // Salvar config de auto-reply
  const saveAutoReply = useCallback(async (enabled: boolean, message: string, delayMs: number) => {
    const token = getToken()
    if (!token) return

    setArSaving(true)
    try {
      const res = await fetch('/api/admin/crm/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          provider: 'auto-reply',
          enabled,
          message,
          delayMs,
        }),
      })
      if (res.ok) {
        addToast(enabled ? 'Auto-resposta ativada' : 'Auto-resposta desativada')
      }
    } catch {
      addToast('Erro ao salvar auto-resposta')
    }
    setArSaving(false)
  }, [TENANT_ID, getToken, addToast])

  // Salvar quando o botão global "Salvar" é clicado
  useEffect(() => {
    const handleSaveEvent = () => {
      void saveAutoReply(arEnabled, arMessage, arDelay)
    }
    window.addEventListener('crm-settings-save', handleSaveEvent)
    return () => window.removeEventListener('crm-settings-save', handleSaveEvent)
  }, [arEnabled, arMessage, arDelay, saveAutoReply])

  // Limpa polling e timeouts
  const clearTimers = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    if (qrTimeoutRef.current) { clearTimeout(qrTimeoutRef.current); qrTimeoutRef.current = null }
  }, [])

  // Busca status da conexão
  const fetchStatus = useCallback(async () => {
    try {
      const result = await getWhatsAppStatus()
      if (result.ok && result.data) {
        const newState = result.data.state
        setConnectionState(newState)
        setInstanceName(result.data.instanceName)
        setError(null)

        // Se conectou, limpar QR e parar polling
        if (newState === 'open') {
          setQrBase64(null)
          clearTimers()
        }
      } else if (result.error) {
        // Erro de auth ou tenant — mostrar como desconectado sem travar
        setConnectionState('close')
        if (result.error === 'Não autorizado') {
          setError('Sessão expirada. Faça logout e login novamente.')
        } else {
          setError(result.error)
        }
      }
    } catch {
      // Silencioso — polling não deve crashar a UI
    } finally {
      setLoading(false)
    }
  }, [clearTimers])

  // Busca status inicial ao montar
  useEffect(() => {
    fetchStatus()
    return clearTimers
  }, [fetchStatus, clearTimers])

  // Inicia polling quando QR está visível
  const startPolling = useCallback(() => {
    clearTimers()

    pollingRef.current = setInterval(() => {
      fetchStatus()
    }, 4000)

    // QR expira em 45s — solicitar novo automaticamente
    qrTimeoutRef.current = setTimeout(() => {
      setQrBase64(null)
      setError('QR Code expirou. Clique para gerar um novo.')
      clearTimers()
    }, 45_000)
  }, [fetchStatus, clearTimers])

  // Handler: Gerar QR Code
  const handleConnect = useCallback(async () => {
    setActionLoading(true)
    setError(null)
    setQrBase64(null)

    try {
      const result = await connectWhatsApp()

      if (!result.ok || !result.data) {
        setError(result.error || 'Erro desconhecido')
        return
      }

      setQrBase64(result.data.base64)
      setInstanceName(result.data.instanceName)
      setConnectionState('connecting')
      startPolling()
    } catch {
      setError('Falha na comunicação com o servidor')
    } finally {
      setActionLoading(false)
    }
  }, [startPolling])

  // Handler: Desconectar
  const handleDisconnect = useCallback(async () => {
    setActionLoading(true)
    setError(null)

    try {
      const result = await disconnectWhatsApp()

      if (result.ok) {
        setConnectionState('close')
        setQrBase64(null)
        setInstanceName(null)
        addToast('WhatsApp desconectado com sucesso')
      } else {
        setError(result.error || 'Erro ao desconectar')
      }
    } catch {
      setError('Falha na comunicação com o servidor')
    } finally {
      setActionLoading(false)
    }
  }, [addToast])

  // Handler: Reiniciar
  const handleRestart = useCallback(async () => {
    setActionLoading(true)
    setError(null)

    try {
      const result = await restartWhatsApp()

      if (result.ok) {
        addToast('Instância reiniciada. Aguarde a reconexão...')
        setConnectionState('connecting')
        setTimeout(fetchStatus, 3000)
      } else {
        setError(result.error || 'Erro ao reiniciar')
      }
    } catch {
      setError('Falha na comunicação com o servidor')
    } finally {
      setActionLoading(false)
    }
  }, [addToast, fetchStatus])

  const isConnected = connectionState === 'open'
  const isConnecting = connectionState === 'connecting' || qrBase64 !== null

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      {/* Header */}
      <motion.div variants={staggerItem}>
        <SectionTitle>Conexão WhatsApp</SectionTitle>
        <p className="text-xs -mt-1 mb-4" style={{ color: 'var(--crm-text-muted)' }}>
          Conecte o WhatsApp da clínica para enviar e receber mensagens pelo CRM
        </p>
      </motion.div>

      {/* Status Card */}
      <motion.div variants={staggerItem}>
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        >
          {/* Status Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--crm-border)' }}>
            <div className="flex items-center gap-3">
              {/* WhatsApp Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: isConnected
                    ? 'rgba(46,204,138,0.1)'
                    : 'rgba(139,138,148,0.1)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isConnected ? '#2ECC8A' : 'var(--crm-text-muted)'}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                </svg>
              </div>

              <div>
                <h4 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                  WhatsApp Business
                </h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                  {instanceName ? `Instância: ${instanceName}` : 'Nenhuma instância configurada'}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(139,138,148,0.1)' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--crm-text-muted)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>Verificando...</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(46,204,138,0.1)' }}>
                <div className="relative">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#2ECC8A' }} />
                  <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: '#2ECC8A', opacity: 0.4 }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: '#2ECC8A' }}>Conectado</span>
              </div>
            ) : isConnecting ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(240,165,0,0.1)' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#F0A500' }} />
                <span className="text-xs font-semibold" style={{ color: '#F0A500' }}>Aguardando leitura</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,107,74,0.1)' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: '#FF6B4A' }} />
                <span className="text-xs font-semibold" style={{ color: '#FF6B4A' }}>Desconectado</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-5">
            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-4 py-3 rounded-lg flex items-center gap-2.5 text-xs"
                style={{ background: 'rgba(255,107,74,0.08)', border: '1px solid rgba(255,107,74,0.15)' }}
              >
                <svg width="14" height="14" fill="none" stroke="#FF6B4A" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ color: '#FF6B4A' }}>{error}</span>
              </motion.div>
            )}

            {/* State: Connected */}
            {isConnected && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="space-y-5"
              >
                {/* Connected illustration */}
                <div className="flex flex-col items-center py-6">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(46,204,138,0.15), rgba(46,204,138,0.05))',
                      border: '1px solid rgba(46,204,138,0.2)',
                    }}
                  >
                    <svg width="36" height="36" fill="none" stroke="#2ECC8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <h4 className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>
                    Tudo pronto!
                  </h4>
                  <p className="text-xs mt-1 text-center max-w-xs" style={{ color: 'var(--crm-text-muted)' }}>
                    O WhatsApp está conectado e pronto para enviar e receber mensagens pelo CRM.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleRestart}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                    style={{
                      background: 'var(--crm-surface-2)',
                      border: '1px solid var(--crm-border)',
                      color: 'var(--crm-text-muted)',
                    }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Reiniciar
                  </button>

                  <button
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                    style={{
                      background: 'rgba(255,107,74,0.08)',
                      border: '1px solid rgba(255,107,74,0.2)',
                      color: '#FF6B4A',
                    }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Desconectar
                  </button>
                </div>
              </motion.div>
            )}

            {/* State: QR Code visible */}
            {qrBase64 && !isConnected && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex flex-col items-center py-4"
              >
                {/* QR Code container */}
                <div
                  className="relative p-4 rounded-2xl mb-5"
                  style={{
                    background: '#FFFFFF',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Scanning indicator corners */}
                  <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 rounded-tl-md" style={{ borderColor: '#25D366' }} />
                  <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 rounded-tr-md" style={{ borderColor: '#25D366' }} />
                  <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 rounded-bl-md" style={{ borderColor: '#25D366' }} />
                  <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 rounded-br-md" style={{ borderColor: '#25D366' }} />

                  {/* Scanning line animation */}
                  <div className="absolute inset-x-4 top-4 bottom-4 overflow-hidden rounded-lg pointer-events-none">
                    <motion.div
                      className="absolute inset-x-0 h-0.5"
                      style={{ background: 'linear-gradient(90deg, transparent, #25D366, transparent)' }}
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                    alt="QR Code WhatsApp"
                    className="w-56 h-56 rounded-lg relative z-10"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--crm-text)' }}>
                  Escaneie o QR Code
                </h4>
                <p className="text-xs text-center max-w-xs mb-4" style={{ color: 'var(--crm-text-muted)' }}>
                  Abra o WhatsApp no celular &rarr; Configurações &rarr; Dispositivos conectados &rarr; Conectar dispositivo
                </p>

                {/* Progress timer */}
                <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: 'var(--crm-border)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #25D366, #2ECC8A)' }}
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 45, ease: 'linear' }}
                  />
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  QR Code expira em 45 segundos
                </p>

                <button
                  onClick={() => { setQrBase64(null); clearTimers(); setConnectionState('close') }}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                  style={{
                    background: 'var(--crm-surface-2)',
                    border: '1px solid var(--crm-border)',
                    color: 'var(--crm-text-muted)',
                  }}
                >
                  Cancelar
                </button>
              </motion.div>
            )}

            {/* State: Disconnected — show connect button */}
            {!isConnected && !qrBase64 && !loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex flex-col items-center py-8"
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,138,148,0.1), rgba(139,138,148,0.03))',
                    border: '1px solid var(--crm-border)',
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                </div>

                <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--crm-text)' }}>
                  WhatsApp não conectado
                </h4>
                <p className="text-xs text-center max-w-xs mb-5" style={{ color: 'var(--crm-text-muted)' }}>
                  Conecte um número de WhatsApp para enviar e receber mensagens diretamente pelo CRM
                </p>

                <button
                  onClick={handleConnect}
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #25D366, #128C7E)',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 16px rgba(37,211,102,0.25)',
                  }}
                >
                  {actionLoading ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Gerando QR Code...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                      </svg>
                      Conectar Aparelho
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="w-20 h-20 rounded-2xl animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
                <div className="w-40 h-4 rounded-lg animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
                <div className="w-56 h-3 rounded-lg animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ━━━ Auto-resposta ━━━ */}
      <motion.div variants={staggerItem}>
        <SectionTitle>Auto-resposta</SectionTitle>
        <p className="text-xs -mt-1 mb-4" style={{ color: 'var(--crm-text-muted)' }}>
          Envie uma mensagem automática de boas-vindas quando um novo lead entra em contato pelo WhatsApp
        </p>
      </motion.div>

      <motion.div variants={staggerItem}>
        <SectionCard>
          <div className="space-y-5">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: arEnabled ? 'rgba(46,204,138,0.1)' : 'rgba(139,138,148,0.08)',
                  }}
                >
                  <svg width="16" height="16" fill="none" stroke={arEnabled ? '#2ECC8A' : 'var(--crm-text-muted)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                    Resposta automática
                  </h4>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                    Envia uma vez por lead (nunca repete)
                  </p>
                </div>
              </div>
              <Toggle
                enabled={arEnabled}
                onToggle={() => {
                  const next = !arEnabled
                  setArEnabled(next)
                  void saveAutoReply(next, arMessage, arDelay)
                }}
              />
            </div>

            {/* Config — visível apenas quando habilitado */}
            <AnimatePresence>
              {arEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 pt-1">
                    {/* Mensagem */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                        Mensagem de boas-vindas
                      </label>
                      <textarea
                        value={arMessage}
                        onChange={e => setArMessage(e.target.value)}
                        rows={4}
                        placeholder="Olá {{nome}}! Obrigada por entrar em contato..."
                        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-200 resize-none"
                        style={{
                          background: 'var(--crm-surface-2)',
                          border: '1px solid var(--crm-border)',
                          color: 'var(--crm-text)',
                          borderRadius: '8px',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
                      />
                      <p className="text-[10px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                        Use <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--crm-surface-2)' }}>{'{{nome}}'}</code> para inserir o primeiro nome do lead
                      </p>
                    </div>

                    {/* Delay */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                        Tempo de espera antes de enviar
                      </label>
                      <div className="flex gap-2">
                        {[
                          { value: 3000, label: '3s' },
                          { value: 4000, label: '4s' },
                          { value: 5000, label: '5s' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setArDelay(opt.value)}
                            className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
                            style={{
                              background: arDelay === opt.value ? 'var(--crm-gold-subtle)' : 'var(--crm-surface-2)',
                              border: `1px solid ${arDelay === opt.value ? 'var(--crm-gold)' : 'var(--crm-border)'}`,
                              color: arDelay === opt.value ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                        Delay para parecer humano — recomendado 4-5 segundos
                      </p>
                    </div>

                    {/* Preview */}
                    <div
                      className="rounded-xl p-4"
                      style={{ background: 'rgba(37,211,102,0.04)', border: '1px solid rgba(37,211,102,0.12)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <svg width="12" height="12" fill="none" stroke="#25D366" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="text-[10px] font-semibold" style={{ color: '#25D366' }}>
                          Preview da mensagem
                        </span>
                      </div>
                      <div
                        className="rounded-lg px-3 py-2.5 text-xs leading-relaxed"
                        style={{
                          background: 'var(--crm-surface)',
                          border: '1px solid var(--crm-border)',
                          color: 'var(--crm-text)',
                        }}
                      >
                        {arMessage.replace(/\{\{nome\}\}/gi, 'Maria') || (
                          <span style={{ color: 'var(--crm-text-muted)', fontStyle: 'italic' }}>
                            Digite uma mensagem acima...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div
                      className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-[11px]"
                      style={{ background: 'rgba(74,123,255,0.06)', border: '1px solid rgba(74,123,255,0.12)' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="#4A7BFF" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span style={{ color: 'var(--crm-text-muted)' }}>
                        A mensagem e enviada <strong style={{ color: 'var(--crm-text)' }}>apenas uma vez</strong> por lead.
                        Se o lead ja recebeu auto-resposta antes, nao enviara novamente — mesmo em novas conversas.
                      </span>
                    </div>

                    {/* Saving indicator */}
                    {arSaving && (
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--crm-text-muted)' }}>
                        <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--crm-gold)', borderTopColor: 'transparent' }} />
                        Salvando...
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SectionCard>
      </motion.div>

      {/* Info cards */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
            title: 'Criptografia E2E',
            desc: 'Mensagens protegidas pela criptografia nativa do WhatsApp',
          },
          {
            icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
            title: 'Tempo Real',
            desc: 'Mensagens entregues instantaneamente via Evolution API',
          },
          {
            icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2',
            title: 'Sempre Ativo',
            desc: 'Conexão mantida 24h pelo servidor — não depende do celular ligado',
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-xl border p-4"
            style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.08)' }}
              >
                <svg width="13" height="13" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d={card.icon} />
                </svg>
              </div>
              <span className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>
                {card.title}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
              {card.desc}
            </p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ━━━ Tab: Notificações ━━━

function NotificationsTab() {
  const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
  const PROVIDER_KEY = 'notifications'

  const [masterEnabled, setMasterEnabled] = useState(true)
  const [events, setEvents] = useState<NotificationEvent[]>([
    { id: 'new_lead', label: 'Novo lead criado', email: true, whatsapp: false, browser: true, frequency: 'immediate' },
    { id: 'new_message', label: 'Mensagem recebida', email: false, whatsapp: true, browser: true, frequency: 'immediate' },
    { id: 'stage_change', label: 'Lead movido de estágio', email: true, whatsapp: false, browser: true, frequency: 'hourly' },
    { id: 'lead_won', label: 'Lead ganho', email: true, whatsapp: true, browser: true, frequency: 'immediate' },
    { id: 'lead_lost', label: 'Lead perdido', email: true, whatsapp: false, browser: false, frequency: 'daily' },
    { id: 'idle_contact', label: 'Contato inativo (7 dias)', email: true, whatsapp: false, browser: true, frequency: 'daily' },
    { id: 'system_error', label: 'Erro do sistema', email: true, whatsapp: false, browser: true, frequency: 'immediate' },
    { id: 'task_reminder', label: 'Lembrete de tarefa', email: false, whatsapp: true, browser: true, frequency: 'immediate' },
  ])
  const hasFetched = useRef(false)

  const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null

  // Carregar configurações de notificação do banco
  useEffect(() => {
    if (hasFetched.current || !token) return
    hasFetched.current = true

    fetch(`/api/admin/crm/settings?tenantId=${TENANT_ID}&provider=${PROVIDER_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          const s = data.settings
          if (s.masterEnabled !== undefined) setMasterEnabled(s.masterEnabled as boolean)
          if (s.events && Array.isArray(s.events)) {
            setEvents(prev => prev.map(defaultEvt => {
              const saved = (s.events as NotificationEvent[]).find(e => e.id === defaultEvt.id)
              return saved ? { ...defaultEvt, ...saved } : defaultEvt
            }))
          }
        }
      })
      .catch(() => { /* primeira vez sem settings */ })
  }, [TENANT_ID, token])

  // Salvar quando o botão global "Salvar" é clicado
  useEffect(() => {
    const handleSaveEvent = () => {
      if (!token) return
      fetch('/api/admin/crm/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          provider: PROVIDER_KEY,
          masterEnabled,
          events,
        }),
      }).catch(err => { console.error('[NotificationsTab] save error:', err) })
    }
    window.addEventListener('crm-settings-save', handleSaveEvent)
    return () => window.removeEventListener('crm-settings-save', handleSaveEvent)
  }, [token, TENANT_ID, masterEnabled, events])

  const toggleChannel = (eventId: string, channel: 'email' | 'whatsapp' | 'browser') => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, [channel]: !e[channel] } : e))
  }

  const changeFrequency = (eventId: string, frequency: 'immediate' | 'hourly' | 'daily') => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, frequency } : e))
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Receber notificações</span>
              <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                Ative para receber alertas de eventos do CRM
              </p>
            </div>
            <Toggle enabled={masterEnabled} onToggle={() => setMasterEnabled(!masterEnabled)} />
          </div>
        </SectionCard>
      </motion.div>

      <AnimatePresence>
        {masterEnabled && (
          <motion.div
            variants={staggerItem}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SectionTitle>Canais por Evento</SectionTitle>
            <SectionCard className="overflow-x-auto">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_70px_70px_70px_120px] gap-2 pb-3 mb-1 border-b min-w-[480px]" style={{ borderColor: 'var(--crm-border)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Evento</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: 'var(--crm-text-muted)' }}>Email</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: 'var(--crm-text-muted)' }}>WhatsApp</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: 'var(--crm-text-muted)' }}>Navegador</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: 'var(--crm-text-muted)' }}>Frequência</span>
              </div>

              {/* Table Rows */}
              <div className="space-y-0.5">
                {events.map(event => (
                  <div
                    key={event.id}
                    className="grid grid-cols-[1fr_70px_70px_70px_120px] gap-2 items-center py-2.5 px-1 min-w-[480px] rounded-lg transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="text-sm" style={{ color: 'var(--crm-text)' }}>{event.label}</span>
                    <div className="flex justify-center">
                      <Toggle enabled={event.email} onToggle={() => toggleChannel(event.id, 'email')} size="sm" />
                    </div>
                    <div className="flex justify-center">
                      <Toggle enabled={event.whatsapp} onToggle={() => toggleChannel(event.id, 'whatsapp')} size="sm" />
                    </div>
                    <div className="flex justify-center">
                      <Toggle enabled={event.browser} onToggle={() => toggleChannel(event.id, 'browser')} size="sm" />
                    </div>
                    <div className="flex justify-center">
                      <select
                        value={event.frequency}
                        onChange={e => changeFrequency(event.id, e.target.value as 'immediate' | 'hourly' | 'daily')}
                        className="text-[10px] px-2 py-1 rounded-md outline-none cursor-pointer appearance-none"
                        style={{
                          background: 'var(--crm-surface-2)',
                          border: '1px solid var(--crm-border)',
                          color: 'var(--crm-text-muted)',
                        }}
                      >
                        <option value="immediate">{FREQUENCY_LABELS.immediate}</option>
                        <option value="hourly">{FREQUENCY_LABELS.hourly}</option>
                        <option value="daily">{FREQUENCY_LABELS.daily}</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ━━━ Tab: Equipe ━━━

function TeamTab() {
  const [members] = useState<TeamMember[]>([
    { id: 'm1', name: 'Mykaele Procópio', email: 'mykaele@clinica.com', role: 'Admin', status: 'online', lastActive: 'Agora' },
    { id: 'm2', name: 'Recepção', email: 'recepcao@clinica.com', role: 'Vendedor', status: 'online', lastActive: 'Há 5min' },
    { id: 'm3', name: 'Dra. Fernanda', email: 'fernanda@clinica.com', role: 'Vendedor', status: 'offline', lastActive: 'Há 3h' },
  ])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Vendedor')
  const addToast = useToastStore(s => s.addToast)

  const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    Admin: { bg: 'rgba(212,175,55,0.12)', text: '#D4AF37' },
    Vendedor: { bg: 'rgba(74,123,255,0.12)', text: '#4A7BFF' },
    Suporte: { bg: 'rgba(46,204,138,0.12)', text: '#2ECC8A' },
  }

  const handleInvite = () => {
    if (!inviteEmail.trim()) return
    addToast(`Convite enviado para ${inviteEmail}`)
    setInviteEmail('')
    setShowInvite(false)
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem}>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Membros da Equipe</SectionTitle>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)', boxShadow: '0 4px 16px rgba(212,175,55,0.25)' }}
          >
            + Convidar Membro
          </button>
        </div>

        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-4"
            >
              <SectionCard>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <InputField label="E-mail do convidado" value={inviteEmail} onChange={setInviteEmail} placeholder="email@exemplo.com" type="email" />
                  </div>
                  <div className="w-40">
                    <SelectField
                      label="Função"
                      value={inviteRole}
                      onChange={setInviteRole}
                      options={[
                        { value: 'Admin', label: 'Admin' },
                        { value: 'Vendedor', label: 'Vendedor' },
                        { value: 'Suporte', label: 'Suporte' },
                      ]}
                    />
                  </div>
                  <button
                    onClick={handleInvite}
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98] flex-shrink-0"
                    style={{
                      background: 'rgba(212,175,55,0.1)',
                      color: 'var(--crm-gold)',
                      border: '1px solid rgba(212,175,55,0.2)',
                    }}
                  >
                    Enviar
                  </button>
                </div>
              </SectionCard>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map(member => (
            <motion.div key={member.id} variants={staggerItem}>
              <div
                className="rounded-xl border p-4 transition-all duration-200 hover:border-white/10"
                style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${ROLE_COLORS[member.role].text}30, ${ROLE_COLORS[member.role].text}10)`,
                        color: ROLE_COLORS[member.role].text,
                      }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                      style={{
                        background: member.status === 'online' ? '#2ECC8A' : 'var(--crm-text-muted)',
                        borderColor: 'var(--crm-surface)',
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--crm-text)' }}>
                        {member.name}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                        style={{
                          background: ROLE_COLORS[member.role].bg,
                          color: ROLE_COLORS[member.role].text,
                          borderRadius: '6px',
                        }}
                      >
                        {member.role}
                      </span>
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                      {member.email}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                      {member.status === 'online' ? (
                        <span style={{ color: '#2ECC8A' }}>Online</span>
                      ) : (
                        <span>Offline</span>
                      )}
                      {' '}&middot; {member.lastActive}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Roles explanation */}
      <motion.div variants={staggerItem}>
        <SectionTitle>Permissões por Função</SectionTitle>
        <SectionCard>
          <div className="space-y-3">
            {[
              { role: 'Admin', desc: 'Acesso total ao CRM, incluindo configurações, equipe, integrações e base de conhecimento. Pode excluir e anonimizar dados.' },
              { role: 'Vendedor', desc: 'Gerencia leads, envia mensagens, move estágios no pipeline e visualiza relatórios de inteligência. Sem acesso a configurações.' },
              { role: 'Suporte', desc: 'Visualiza e responde conversas na inbox. Pode atualizar informações de contato mas não pode mover leads ou alterar o pipeline.' },
            ].map(item => (
              <div key={item.role} className="flex items-start gap-3 py-2">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                  style={{
                    background: ROLE_COLORS[item.role].bg,
                    color: ROLE_COLORS[item.role].text,
                    borderRadius: '6px',
                  }}
                >
                  {item.role}
                </span>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </motion.div>
    </motion.div>
  )
}

// ━━━ Tab: IA ━━━

function AiTab() {
  const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
  const PROVIDER_KEY = 'ai-settings'
  const addToast = useToastStore(s => s.addToast)

  const [features, setFeatures] = useState<AiFeature[]>([
    {
      id: 'copilot',
      name: 'CRM Copilot',
      description: 'Assistente de IA integrado ao seu ambiente de trabalho. Responde perguntas, fornece visões gerais dos leads e reduz a entrada manual de dados.',
      enabled: true,
    },
    {
      id: 'suggested_reply',
      name: 'Resposta Sugerida por IA',
      description: 'Oferece opções de resposta inteligentes durante os chats. Analisa o contexto da conversa e sugere respostas personalizadas baseadas no histórico do lead.',
      enabled: false,
      isBeta: true,
    },
    {
      id: 'task_suggestions',
      name: 'Sugestões de Tarefas da IA',
      description: 'Identifica automaticamente tarefas em seus chats, verificando mensagens enviadas e recebidas. Cria lembretes e follow-ups automáticos.',
      enabled: true,
    },
  ])
  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('gemini-2.0-flash')
  const [apiKey, setApiKey] = useState('')
  const [apiKeySet, setApiKeySet] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [confidence, setConfidence] = useState(75)
  const [maxTokens, setMaxTokens] = useState('2048')
  const [temperature, setTemperature] = useState(0.7)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const hasFetched = useRef(false)

  const PROVIDERS = [
    { value: 'gemini', label: 'Google Gemini (Grátis)', hint: 'Gemini 2.0 Flash — 1500 req/dia grátis' },
    { value: 'groq', label: 'Groq (Grátis)', hint: 'Llama 3, Mixtral — rápido e grátis' },
    { value: 'openai', label: 'OpenAI', hint: 'GPT-4o, GPT-4o-mini' },
    { value: 'openrouter', label: 'OpenRouter', hint: 'Múltiplos modelos, free tier' },
    { value: 'together', label: 'Together AI', hint: 'Llama 3.1, Mixtral — free tier' },
    { value: 'custom', label: 'Custom (OpenAI-compatível)', hint: 'Qualquer API compatível' },
  ]

  const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
    gemini: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (grátis, recomendado)' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (grátis, mais rápido)' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (grátis)' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (grátis, mais inteligente)' },
    ],
    openai: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (barato)' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (mais barato)' },
    ],
    groq: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (grátis)' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (grátis)' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (grátis)' },
      { value: 'gemma2-9b-it', label: 'Gemma 2 9B (grátis)' },
    ],
    together: [
      { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B' },
      { value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B' },
      { value: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B' },
    ],
    openrouter: [
      { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (grátis)' },
      { value: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B (grátis)' },
      { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (grátis)' },
    ],
    custom: [
      { value: 'custom', label: 'Modelo customizado' },
    ],
  }

  const BASE_URLS: Record<string, string> = {
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    openai: 'https://api.openai.com/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    custom: '',
  }

  // Carregar settings do banco
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null
    if (!token) { setLoading(false); return }

    fetch(`/api/admin/crm/settings?tenantId=${TENANT_ID}&provider=${PROVIDER_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          const s = data.settings
          if (s.aiProvider) setProvider(s.aiProvider as string)
          if (s.model) setModel(s.model as string)
          if (s.apiKey_set) setApiKeySet(true)
          if (s.apiKey) setApiKey(s.apiKey as string)
          if (s.baseUrl) setBaseUrl(s.baseUrl as string)
          if (s.confidence) setConfidence(Number(s.confidence))
          if (s.maxTokens) setMaxTokens(String(s.maxTokens))
          if (s.temperature !== undefined) setTemperature(Number(s.temperature))
          if (s.features) {
            try {
              const savedFeatures = s.features as Record<string, boolean>
              setFeatures(prev => prev.map(f => ({
                ...f,
                enabled: savedFeatures[f.id] !== undefined ? savedFeatures[f.id] : f.enabled,
              })))
            } catch { /* ignore */ }
          }
        }
      })
      .catch(() => { /* first time, no settings */ })
      .finally(() => setLoading(false))
  }, [TENANT_ID])

  // Quando troca provider, atualizar model e baseUrl
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    const models = MODEL_OPTIONS[newProvider]
    if (models?.[0]) setModel(models[0].value)
    setBaseUrl(BASE_URLS[newProvider] || '')
  }

  const toggleFeature = (featureId: string) => {
    setFeatures(prev => prev.map(f => f.id === featureId ? { ...f, enabled: !f.enabled } : f))
  }

  // Salvar no banco
  const handleSave = async (silent = false) => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null
    if (!token) return

    if (!silent) setSaving(true)
    try {
      const res = await fetch('/api/admin/crm/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          provider: PROVIDER_KEY,
          aiProvider: provider,
          model,
          apiKey: apiKey,
          baseUrl: baseUrl || BASE_URLS[provider] || '',
          confidence,
          maxTokens: Number(maxTokens),
          temperature,
          features: Object.fromEntries(features.map(f => [f.id, f.enabled])),
        }),
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      setApiKeySet(apiKey.length > 0 && !apiKey.includes('*'))
      if (!silent) addToast('Configurações de IA salvas')
    } catch {
      addToast('Erro ao salvar configurações', 'error')
    } finally {
      if (!silent) setSaving(false)
    }
  }

  // Salvar quando o botão global "Salvar" é clicado
  useEffect(() => {
    const handleGlobalSave = () => {
      const tk = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null
      if (!tk) return
      fetch('/api/admin/crm/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          provider: PROVIDER_KEY,
          aiProvider: provider,
          model,
          apiKey,
          baseUrl: baseUrl || BASE_URLS[provider] || '',
          confidence,
          maxTokens: Number(maxTokens),
          temperature,
          features: Object.fromEntries(features.map(f => [f.id, f.enabled])),
        }),
      }).catch(err => { console.error('[AiTab] save error:', err) })
    }
    window.addEventListener('crm-settings-save', handleGlobalSave)
    return () => window.removeEventListener('crm-settings-save', handleGlobalSave)
  }, [TENANT_ID, PROVIDER_KEY, provider, model, apiKey, baseUrl, confidence, maxTokens, temperature, features])

  // Testar conexão — via server-side para evitar CORS/CSP
  const handleTestConnection = async () => {
    if (!apiKey || apiKey.includes('*')) {
      addToast('Insira a API key antes de testar', 'error')
      return
    }

    const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('token')) : null
    if (!token) return

    setTestStatus('testing')
    try {
      const res = await fetch('/api/crm/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider, apiKey, baseUrl: baseUrl || BASE_URLS[provider] || '' }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestStatus('success')
        addToast('Conexão OK — API key válida')
      } else {
        setTestStatus('error')
        addToast(data.error || 'Erro — verifique a API key', 'error')
      }
    } catch {
      setTestStatus('error')
      addToast('Falha na conexão — verifique URL e key', 'error')
    }

    setTimeout(() => setTestStatus('idle'), 4000)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
        ))}
      </div>
    )
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      {/* API Key + Provider */}
      <motion.div variants={staggerItem}>
        <SectionTitle>Provedor de IA</SectionTitle>
        <SectionCard>
          <div className="space-y-4">
            {/* Provider selector */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>
                Provedor
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => handleProviderChange(p.value)}
                    className="flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-xl text-left transition-all"
                    style={{
                      background: provider === p.value ? 'rgba(212,175,55,0.08)' : 'var(--crm-surface-2)',
                      border: `1px solid ${provider === p.value ? 'rgba(212,175,55,0.3)' : 'var(--crm-border)'}`,
                      color: provider === p.value ? 'var(--crm-gold)' : 'var(--crm-text)',
                    }}
                  >
                    <span className="text-sm font-semibold">{p.label}</span>
                    <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                API Key {apiKeySet && <span className="text-[10px] ml-1" style={{ color: 'var(--crm-won)' }}>Configurada</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={provider === 'gemini' ? 'AIzaSy...' : provider === 'groq' ? 'gsk_...' : provider === 'openai' ? 'sk-...' : 'Sua API key'}
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none transition-all font-mono"
                  style={{
                    background: 'var(--crm-surface-2)',
                    border: '1px solid var(--crm-border)',
                    color: 'var(--crm-text)',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
                />
                <button
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap disabled:opacity-50"
                  style={{
                    background: testStatus === 'success' ? 'rgba(46,204,138,0.1)' : testStatus === 'error' ? 'rgba(255,107,74,0.1)' : 'var(--crm-surface-2)',
                    color: testStatus === 'success' ? '#2ECC8A' : testStatus === 'error' ? '#FF6B4A' : 'var(--crm-text)',
                    border: `1px solid ${testStatus === 'success' ? 'rgba(46,204,138,0.3)' : testStatus === 'error' ? 'rgba(255,107,74,0.3)' : 'var(--crm-border)'}`,
                  }}
                >
                  {testStatus === 'testing' ? 'Testando...' : testStatus === 'success' ? 'OK' : testStatus === 'error' ? 'Falhou' : 'Testar'}
                </button>
              </div>
              {provider === 'gemini' && (
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  Crie sua key grátis em <span style={{ color: 'var(--crm-gold)' }}>aistudio.google.com/apikey</span> — 1500 req/dia sem cartão
                </p>
              )}
              {provider === 'groq' && (
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  Crie sua key grátis em <span style={{ color: 'var(--crm-gold)' }}>console.groq.com</span> — sem cartão de crédito
                </p>
              )}
              {provider === 'openrouter' && (
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  Crie sua key em <span style={{ color: 'var(--crm-gold)' }}>openrouter.ai</span> — modelos grátis disponíveis
                </p>
              )}
            </div>

            {/* Base URL (only for custom) */}
            {provider === 'custom' && (
              <InputField
                label="Base URL (compatível com OpenAI API)"
                value={baseUrl}
                onChange={setBaseUrl}
                placeholder="https://api.example.com/v1"
              />
            )}

            {/* Model selector */}
            <SelectField
              label="Modelo"
              value={model}
              onChange={setModel}
              options={MODEL_OPTIONS[provider] || [{ value: model, label: model }]}
            />

            {/* Save button inline */}
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)', boxShadow: '0 4px 16px rgba(212,175,55,0.2)' }}
            >
              {saving ? 'Salvando...' : 'Salvar Configuração de IA'}
            </button>
          </div>
        </SectionCard>
      </motion.div>

      {/* Features toggles */}
      <motion.div variants={staggerItem}>
        <SectionTitle>Funcionalidades de IA</SectionTitle>
        <div className="space-y-3">
          {features.map(feature => (
            <div
              key={feature.id}
              className="rounded-xl border p-5 transition-all duration-200"
              style={{
                background: feature.enabled ? 'rgba(212,175,55,0.03)' : 'var(--crm-surface)',
                borderColor: feature.enabled ? 'rgba(212,175,55,0.15)' : 'var(--crm-border)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                      {feature.name}
                    </span>
                    {feature.isBeta && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                        style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', borderRadius: '6px' }}
                      >
                        Beta
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
                    {feature.description}
                  </p>
                </div>
                <Toggle enabled={feature.enabled} onToggle={() => toggleFeature(feature.id)} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Advanced config */}
      <motion.div variants={staggerItem}>
        <SectionTitle>Configurações Avançadas</SectionTitle>
        <SectionCard>
          <div className="space-y-5">
            {/* Confidence Threshold */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>
                  Limite de Confiança
                </label>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--crm-gold)' }}>
                  {confidence}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={confidence}
                onChange={e => setConfidence(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #D4AF37 ${confidence}%, var(--crm-border) ${confidence}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>0%</span>
                <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>100%</span>
              </div>
            </div>

            <InputField
              label="Máximo de Tokens"
              value={maxTokens}
              onChange={setMaxTokens}
              type="number"
            />

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>
                  Temperatura
                </label>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--crm-gold)' }}>
                  {temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={temperature * 100}
                onChange={e => setTemperature(Number(e.target.value) / 100)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #D4AF37 ${(temperature / 2) * 100}%, var(--crm-border) ${(temperature / 2) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>0 (preciso)</span>
                <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>2 (criativo)</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </motion.div>
    </motion.div>
  )
}

// ━━━ Tab: Conhecimento ━━━

function KnowledgeTab() {
  const [sources, setSources] = useState<KnowledgeSource[]>([
    { id: 'k1', name: 'Fatos importantes', type: 'Texto', chunks: 1, usageCount: 0, language: 'Português', updatedBy: 'Robô', updatedAt: '09/03/2026' },
    { id: 'k2', name: 'Produtos e serviços', type: 'Texto', chunks: 1, usageCount: 0, language: 'Português', updatedBy: 'Robô', updatedAt: '09/03/2026' },
    { id: 'k3', name: 'Protocolos clínicos', type: 'Arquivo', chunks: 3, usageCount: 12, language: 'Português', updatedBy: 'Admin', updatedAt: '10/03/2026' },
    { id: 'k4', name: 'Perguntas frequentes', type: 'Texto', chunks: 5, usageCount: 28, language: 'Português', updatedBy: 'Admin', updatedAt: '11/03/2026' },
    { id: 'k5', name: 'Visão geral do negócio', type: 'Texto', chunks: 1, usageCount: 0, language: 'Português', updatedBy: 'Robô', updatedAt: '09/03/2026' },
  ])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceType, setNewSourceType] = useState<'Texto' | 'Arquivo'>('Texto')
  const [newSourceContent, setNewSourceContent] = useState('')
  const [newSourceLanguage, setNewSourceLanguage] = useState('Português')
  const addToast = useToastStore(s => s.addToast)

  const totalChunks = sources.reduce((acc, s) => acc + s.chunks, 0)
  const totalUsage = sources.reduce((acc, s) => acc + s.usageCount, 0)
  const avgUsage = sources.length > 0 ? Math.round(totalUsage / sources.length) : 0

  const handleAddSource = () => {
    if (!newSourceName.trim()) return
    const newSource: KnowledgeSource = {
      id: `k${Date.now()}`,
      name: newSourceName.trim(),
      type: newSourceType,
      chunks: 1,
      usageCount: 0,
      language: newSourceLanguage,
      updatedBy: 'Admin',
      updatedAt: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    }
    setSources(prev => [...prev, newSource])
    setNewSourceName('')
    setNewSourceContent('')
    setShowAddModal(false)
    addToast('Fonte adicionada com sucesso')
  }

  const removeSource = (sourceId: string) => {
    setSources(prev => prev.filter(s => s.id !== sourceId))
    addToast('Fonte removida')
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      {/* Stats */}
      <motion.div variants={staggerItem}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Fontes', value: sources.length.toString(), icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' },
            { label: 'Subseções', value: totalChunks.toString(), icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
            { label: 'Uso médio', value: `${avgUsage}x`, icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl border p-4 text-center relative overflow-hidden"
              style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
            >
              <div className="absolute inset-0 opacity-[0.02]" style={{ background: 'radial-gradient(circle at 50% 0%, var(--crm-gold), transparent 60%)' }} />
              <p className="text-lg font-bold relative z-10" style={{ color: 'var(--crm-text)' }}>{stat.value}</p>
              <p className="text-[10px] font-medium mt-0.5 relative z-10" style={{ color: 'var(--crm-text-muted)' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Fontes de Conhecimento</SectionTitle>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)', boxShadow: '0 4px 16px rgba(212,175,55,0.25)' }}
          >
            + Adicionar nova fonte
          </button>
        </div>

        <SectionCard className="overflow-x-auto">
          {sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.1)' }}
              >
                <svg width="28" height="28" fill="none" stroke="var(--crm-gold)" strokeWidth="1.2" viewBox="0 0 24 24">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Nenhuma fonte cadastrada</p>
              <p className="text-xs mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                Adicione textos ou arquivos para treinar a IA do seu CRM
              </p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_60px_70px_70px_70px_80px_90px_60px] gap-2 pb-2.5 mb-1 border-b min-w-[600px]" style={{ borderColor: 'var(--crm-border)' }}>
                {['Nome', 'Tipo', 'Subseções', 'Uso', 'Idioma', 'Atualizado', 'Data', ''].map(h => (
                  <span key={h} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Table Rows */}
              <div className="space-y-0.5">
                {sources.map(source => (
                  <div
                    key={source.id}
                    className="grid grid-cols-[1fr_60px_70px_70px_70px_80px_90px_60px] gap-2 items-center py-2.5 px-1 rounded-lg transition-colors hover:bg-white/[0.02] group min-w-[600px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg width="14" height="14" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24" className="flex-shrink-0">
                        {source.type === 'Arquivo' ? (
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
                        ) : (
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
                        )}
                      </svg>
                      <span className="text-sm truncate" style={{ color: 'var(--crm-text)' }}>{source.name}</span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-center"
                      style={{
                        background: source.type === 'Arquivo' ? 'rgba(74,123,255,0.1)' : 'rgba(212,175,55,0.1)',
                        color: source.type === 'Arquivo' ? '#4A7BFF' : '#D4AF37',
                        borderRadius: '6px',
                      }}
                    >
                      {source.type}
                    </span>
                    <span className="text-xs text-center tabular-nums" style={{ color: 'var(--crm-text-muted)' }}>{source.chunks}</span>
                    <span className="text-xs text-center tabular-nums" style={{ color: source.usageCount > 0 ? 'var(--crm-text)' : 'var(--crm-text-muted)' }}>
                      {source.usageCount}x
                    </span>
                    <span className="text-xs text-center" style={{ color: 'var(--crm-text-muted)' }}>{source.language}</span>
                    <span className="text-xs text-center" style={{ color: 'var(--crm-text-muted)' }}>{source.updatedBy}</span>
                    <span className="text-xs text-center tabular-nums" style={{ color: 'var(--crm-text-muted)' }}>{source.updatedAt}</span>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        className="p-1 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity hover:bg-white/5"
                        title="Editar"
                      >
                        <svg width="12" height="12" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeSource(source.id)}
                        className="p-1 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity hover:bg-red-500/10"
                        title="Excluir"
                      >
                        <svg width="12" height="12" fill="none" stroke="#FF6B4A" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </motion.div>

      {/* Add Source Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full max-w-lg rounded-2xl border p-6"
              style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
            >
              <h3 className="text-base font-bold mb-4" style={{ color: 'var(--crm-text)' }}>
                Adicionar nova fonte
              </h3>

              <div className="space-y-4">
                <InputField label="Nome da fonte" value={newSourceName} onChange={setNewSourceName} placeholder="Ex: Protocolos de atendimento" />

                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Tipo"
                    value={newSourceType}
                    onChange={v => setNewSourceType(v as 'Texto' | 'Arquivo')}
                    options={[
                      { value: 'Texto', label: 'Texto' },
                      { value: 'Arquivo', label: 'Arquivo' },
                    ]}
                  />
                  <SelectField
                    label="Idioma"
                    value={newSourceLanguage}
                    onChange={setNewSourceLanguage}
                    options={[
                      { value: 'Português', label: 'Português' },
                      { value: 'English', label: 'English' },
                      { value: 'Español', label: 'Español' },
                    ]}
                  />
                </div>

                {newSourceType === 'Texto' ? (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                      Conteúdo
                    </label>
                    <textarea
                      value={newSourceContent}
                      onChange={e => setNewSourceContent(e.target.value)}
                      rows={5}
                      placeholder="Cole o conteúdo de texto aqui..."
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
                      style={{
                        background: 'var(--crm-surface-2)',
                        border: '1px solid var(--crm-border)',
                        color: 'var(--crm-text)',
                        borderRadius: '8px',
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                      Arquivo
                    </label>
                    <div
                      className="rounded-lg border-2 border-dashed p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors duration-200 hover:border-[var(--crm-gold)]"
                      style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-surface-2)' }}
                    >
                      <svg width="24" height="24" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>
                        Arraste um arquivo ou clique para selecionar
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                        PDF, TXT, DOCX (máx. 10MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{ color: 'var(--crm-text-muted)', background: 'var(--crm-surface-2)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddSource}
                  className="px-5 py-2 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)' }}
                >
                  Adicionar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ━━━ Main Settings Page ━━━

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [saving, setSaving] = useState(false)
  const addToast = useToastStore(s => s.addToast)

  const handleSave = useCallback(async () => {
    setSaving(true)
    // Dispara evento customizado para que cada tab salve seus dados
    window.dispatchEvent(new CustomEvent('crm-settings-save'))
    // Aguarda os handlers de cada tab completarem as requisições
    await new Promise(r => setTimeout(r, 1200))
    setSaving(false)
    addToast('Configurações salvas')
  }, [addToast])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralTab />
      case 'pipeline': return <PipelineTab />
      case 'whatsapp': return <WhatsAppTab />
      case 'notifications': return <NotificationsTab />
      case 'team': return <TeamTab />
      case 'ai': return <AiTab />
      case 'knowledge': return <KnowledgeTab />
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--crm-text)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
            <svg width="16" height="16" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          Configurações
        </h1>
        <p className="text-xs mt-1 ml-[42px]" style={{ color: 'var(--crm-text-muted)' }}>
          Gerencie seu CRM e preferências
        </p>
      </div>

      {/* Content: Sidebar + Tab Panel */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
      >
        {/* Mobile: Horizontal scrollable tabs */}
        <nav
          className="flex md:hidden overflow-x-auto scrollbar-none border-b gap-0.5 px-2 py-2"
          style={{ borderColor: 'var(--crm-border)', background: 'rgba(17,17,20,0.5)' }}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={{
                  color: isActive ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                  background: isActive ? 'var(--crm-gold-subtle)' : 'transparent',
                }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ opacity: isActive ? 1 : 0.6 }}>
                  <path d={tab.iconPath} />
                </svg>
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="settings-tab-mobile"
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ background: 'var(--crm-gold)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex min-h-[400px] md:min-h-[560px]">
          {/* Desktop: Sidebar Navigation */}
          <nav
            className="hidden md:flex w-52 flex-shrink-0 border-r py-3 px-2 flex-col gap-0.5"
            style={{ borderColor: 'var(--crm-border)', background: 'rgba(17,17,20,0.5)' }}
          >
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-[13px] font-medium transition-all duration-200"
                  style={{
                    color: isActive ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                    background: isActive ? 'var(--crm-gold-subtle)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--crm-text)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--crm-text-muted)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId="settings-tab-indicator"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                      style={{ background: 'var(--crm-gold)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    />
                  )}
                  <svg
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                    className="flex-shrink-0"
                    style={{ opacity: isActive ? 1 : 0.6 }}
                  >
                    <path d={tab.iconPath} />
                  </svg>
                  {tab.label}
                </button>
              )
            })}
          </nav>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={tabContentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer: Save Button */}
        <div
          className="border-t px-6 py-4 flex items-center justify-end"
          style={{ borderColor: 'var(--crm-border)', background: 'rgba(17,17,20,0.5)' }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
              color: 'var(--crm-bg)',
              boxShadow: '0 4px 16px rgba(212,175,55,0.25)',
            }}
          >
            {saving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Salvando...
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
