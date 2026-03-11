'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'

// ━━━ Types ━━━

type TabId = 'general' | 'pipeline' | 'notifications' | 'team' | 'ai' | 'knowledge'

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

const STAGE_COLORS = ['#4A7BFF', '#F0A500', '#FF6B4A', '#D4AF37', '#2ECC8A', '#8B8A94']

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
    return localStorage.getItem('token') || document.cookie.match(/token=([^;]+)/)?.[1] || null
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
    LOST: { label: 'Perdido', color: '#8B8A94' },
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

// ━━━ Tab: Notificações ━━━

function NotificationsTab() {
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
            <SectionCard className="overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_70px_70px_70px_120px] gap-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--crm-border)' }}>
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
                    className="grid grid-cols-[1fr_70px_70px_70px_120px] gap-2 items-center py-2.5 px-1 rounded-lg transition-colors hover:bg-white/[0.02]"
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
  const [model, setModel] = useState('GPT-4o')
  const [confidence, setConfidence] = useState(75)
  const [maxTokens, setMaxTokens] = useState('2048')
  const [temperature, setTemperature] = useState(0.7)

  const toggleFeature = (featureId: string) => {
    setFeatures(prev => prev.map(f => f.id === featureId ? { ...f, enabled: !f.enabled } : f))
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
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

      <motion.div variants={staggerItem}>
        <SectionTitle>Configurações Avançadas</SectionTitle>
        <SectionCard>
          <div className="space-y-5">
            <SelectField
              label="Modelo de IA"
              value={model}
              onChange={setModel}
              options={AI_MODELS.map(m => ({ value: m, label: m }))}
            />

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
              <div className="grid grid-cols-[1fr_60px_70px_70px_70px_80px_90px_60px] gap-2 pb-2.5 mb-1 border-b" style={{ borderColor: 'var(--crm-border)' }}>
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
                    className="grid grid-cols-[1fr_60px_70px_70px_70px_80px_90px_60px] gap-2 items-center py-2.5 px-1 rounded-lg transition-colors hover:bg-white/[0.02] group"
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

  const handleSave = useCallback(() => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      addToast('Salvo com sucesso')
    }, 800)
  }, [addToast])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralTab />
      case 'pipeline': return <PipelineTab />
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
        <div className="flex min-h-[560px]">
          {/* Sidebar Navigation */}
          <nav
            className="w-52 flex-shrink-0 border-r py-3 px-2 flex flex-col gap-0.5"
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
          <div className="flex-1 p-6 overflow-y-auto" style={{ maxHeight: '680px' }}>
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
