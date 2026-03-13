'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// ━━━ Types ━━━

interface BotItem {
  id: string
  name: string
  description: string | null
  triggerType: string
  triggerConfig: Record<string, unknown> | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: { sessions: number }
}

interface BotDetail extends BotItem {
  nodes: Node[]
  edges: Edge[]
  sessions: { id: string; leadId: string; currentNodeId: string; startedAt: string }[]
}

// ━━━ Constants ━━━

const TRIGGER_LABELS: Record<string, string> = {
  any_new_conversation: 'Nova conversa',
  keyword: 'Palavra-chave',
  schedule: 'Horário agendado',
}

const NODE_COLORS: Record<string, string> = {
  trigger: '#D4AF37',
  message: '#4A7BFF',
  question: '#F0A500',
  condition: '#A855F7',
  action: '#2ECC8A',
  delay: '#8B8A94',
  end: '#FF6B4A',
}

const NODE_LABELS: Record<string, string> = {
  trigger: 'Gatilho',
  message: 'Mensagem',
  question: 'Pergunta',
  condition: 'Condição',
  action: 'Ação',
  delay: 'Atraso',
  end: 'Fim',
}

// ━━━ API helpers ━━━

function authHeaders(): HeadersInit {
  const token = document.cookie.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1]
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token ?? ''}`,
  }
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// ━━━ Custom Nodes ━━━

function TriggerNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[180px] shadow-lg" style={{
      background: 'var(--crm-surface)', border: `2px solid ${NODE_COLORS.trigger}`,
      boxShadow: `0 0 20px rgba(212,175,55,0.15)`,
    }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ background: NODE_COLORS.trigger }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NODE_COLORS.trigger }}>Gatilho</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--crm-text)' }}>{(data as Record<string, unknown>).label as string ?? 'Início do fluxo'}</p>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_COLORS.trigger, width: 10, height: 10 }} />
    </div>
  )
}

function MessageNode({ data, selected }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[200px] shadow-lg transition-all" style={{
      background: 'var(--crm-surface)',
      border: `2px solid ${selected ? NODE_COLORS.message : 'var(--crm-border)'}`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: NODE_COLORS.message, width: 8, height: 8 }} />
      <div className="flex items-center gap-2 mb-1.5">
        <svg width="14" height="14" fill="none" stroke={NODE_COLORS.message} strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NODE_COLORS.message }}>Mensagem</span>
      </div>
      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--crm-text)' }}>
        {(data as Record<string, unknown>).message as string || 'Clique para editar'}
      </p>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_COLORS.message, width: 8, height: 8 }} />
    </div>
  )
}

function QuestionNode({ data, selected }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[200px] shadow-lg transition-all" style={{
      background: 'var(--crm-surface)',
      border: `2px solid ${selected ? NODE_COLORS.question : 'var(--crm-border)'}`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: NODE_COLORS.question, width: 8, height: 8 }} />
      <div className="flex items-center gap-2 mb-1.5">
        <svg width="14" height="14" fill="none" stroke={NODE_COLORS.question} strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NODE_COLORS.question }}>Pergunta</span>
      </div>
      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--crm-text)' }}>
        {(data as Record<string, unknown>).question as string || 'Clique para editar'}
      </p>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_COLORS.question, width: 8, height: 8 }} />
    </div>
  )
}

function ConditionNode({ data, selected }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[180px] shadow-lg transition-all" style={{
      background: 'var(--crm-surface)',
      border: `2px solid ${selected ? NODE_COLORS.condition : 'var(--crm-border)'}`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: NODE_COLORS.condition, width: 8, height: 8 }} />
      <div className="flex items-center gap-2 mb-1.5">
        <svg width="14" height="14" fill="none" stroke={NODE_COLORS.condition} strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NODE_COLORS.condition }}>Condição</span>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--crm-text)' }}>
        {(data as Record<string, unknown>).field as string || 'answer'} {(data as Record<string, unknown>).operator as string || 'contains'} {(data as Record<string, unknown>).value as string || '...'}
      </p>
      <div className="flex justify-between mt-2">
        <Handle type="source" position={Position.Bottom} id="true" style={{ background: '#2ECC8A', width: 8, height: 8, left: '30%' }} />
        <Handle type="source" position={Position.Bottom} id="false" style={{ background: '#FF6B4A', width: 8, height: 8, left: '70%' }} />
      </div>
      <div className="flex justify-between mt-1 px-1">
        <span className="text-[9px]" style={{ color: '#2ECC8A' }}>Sim</span>
        <span className="text-[9px]" style={{ color: '#FF6B4A' }}>Não</span>
      </div>
    </div>
  )
}

function ActionNode({ data, selected }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[180px] shadow-lg transition-all" style={{
      background: 'var(--crm-surface)',
      border: `2px solid ${selected ? NODE_COLORS.action : 'var(--crm-border)'}`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: NODE_COLORS.action, width: 8, height: 8 }} />
      <div className="flex items-center gap-2 mb-1.5">
        <svg width="14" height="14" fill="none" stroke={NODE_COLORS.action} strokeWidth="2" viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NODE_COLORS.action }}>Ação</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--crm-text)' }}>
        {(data as Record<string, unknown>).actionType as string || 'Selecionar ação'}
      </p>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_COLORS.action, width: 8, height: 8 }} />
    </div>
  )
}

function DelayNode({ data, selected }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[160px] shadow-lg transition-all" style={{
      background: 'var(--crm-surface)',
      border: `2px solid ${selected ? NODE_COLORS.delay : 'var(--crm-border)'}`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: NODE_COLORS.delay, width: 8, height: 8 }} />
      <div className="flex items-center gap-2 mb-1.5">
        <svg width="14" height="14" fill="none" stroke={NODE_COLORS.delay} strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NODE_COLORS.delay }}>Atraso</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--crm-text)' }}>
        {(data as Record<string, unknown>).seconds as number || 5}s
      </p>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_COLORS.delay, width: 8, height: 8 }} />
    </div>
  )
}

function EndNode({ data, selected }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[160px] shadow-lg transition-all" style={{
      background: 'var(--crm-surface)',
      border: `2px solid ${selected ? NODE_COLORS.end : 'var(--crm-border)'}`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: NODE_COLORS.end, width: 8, height: 8 }} />
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.end }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NODE_COLORS.end }}>
          {(data as Record<string, unknown>).transfer ? 'Transferir' : 'Fim'}
        </span>
      </div>
      {(data as Record<string, unknown>).message && (
        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--crm-text)' }}>
          {(data as Record<string, unknown>).message as string}
        </p>
      )}
    </div>
  )
}

// ━━━ Node type map ━━━
const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  end: EndNode,
}

// ━━━ Node Properties Panel ━━━

function NodePropertiesPanel({ node, onUpdate, onClose }: {
  node: Node
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const d = node.data as Record<string, unknown>

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      className="absolute right-0 top-0 bottom-0 w-80 z-20 overflow-y-auto"
      style={{
        background: 'var(--crm-surface)',
        borderLeft: '1px solid var(--crm-border)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS[node.type ?? 'message'] ?? '#888' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
              {NODE_LABELS[node.type ?? ''] ?? 'Nó'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5">
            <svg width="16" height="16" fill="none" stroke="var(--crm-text-muted)" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* Message node */}
          {node.type === 'message' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                Texto da mensagem
              </label>
              <textarea
                value={d.message as string ?? ''}
                onChange={e => onUpdate(node.id, { ...d, message: e.target.value })}
                placeholder="Olá {{nome}}! Como posso ajudar?"
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
                style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
              />
              <p className="text-[9px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                Variáveis: {'{{nome}}'}, {'{{resposta_nodeId}}'}
              </p>
            </div>
          )}

          {/* Question node */}
          {node.type === 'question' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                Texto da pergunta
              </label>
              <textarea
                value={d.question as string ?? ''}
                onChange={e => onUpdate(node.id, { ...d, question: e.target.value })}
                placeholder="Qual procedimento te interessa?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
                style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
              />
              <p className="text-[9px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                O bot aguarda a resposta do lead antes de continuar
              </p>
            </div>
          )}

          {/* Condition node */}
          {node.type === 'condition' && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                  Campo
                </label>
                <select
                  value={d.field as string ?? 'answer'}
                  onChange={e => onUpdate(node.id, { ...d, field: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                >
                  <option value="answer">Resposta do lead</option>
                  <option value="lead.status">Status do lead</option>
                  <option value="lead.source">Fonte</option>
                  <option value="lead.tags">Tags</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                  Operador
                </label>
                <select
                  value={d.operator as string ?? 'contains'}
                  onChange={e => onUpdate(node.id, { ...d, operator: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                >
                  <option value="eq">Igual a</option>
                  <option value="contains">Contém</option>
                  <option value="any">Qualquer valor</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                  Valor
                </label>
                <input
                  value={d.value as string ?? ''}
                  onChange={e => onUpdate(node.id, { ...d, value: e.target.value })}
                  placeholder="botox, preenchimento..."
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
              </div>
              <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>
                Saídas: Sim (verde) / Não (vermelho)
              </p>
            </>
          )}

          {/* Action node */}
          {node.type === 'action' && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                  Tipo de ação
                </label>
                <select
                  value={d.actionType as string ?? ''}
                  onChange={e => onUpdate(node.id, { ...d, actionType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                >
                  <option value="">Selecionar...</option>
                  <option value="move_stage">Mover para estágio</option>
                  <option value="add_tag">Adicionar tag</option>
                  <option value="set_status">Definir status</option>
                  <option value="set_value">Definir valor</option>
                </select>
              </div>
              {d.actionType === 'move_stage' && (
                <input
                  value={d.stageId as string ?? ''}
                  onChange={e => onUpdate(node.id, { ...d, stageId: e.target.value })}
                  placeholder="ID do estágio"
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
              )}
              {d.actionType === 'add_tag' && (
                <input
                  value={d.tag as string ?? ''}
                  onChange={e => onUpdate(node.id, { ...d, tag: e.target.value })}
                  placeholder="Nome da tag"
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
              )}
              {d.actionType === 'set_status' && (
                <select
                  value={d.status as string ?? ''}
                  onChange={e => onUpdate(node.id, { ...d, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                >
                  <option value="HOT">Quente</option>
                  <option value="WARM">Morno</option>
                  <option value="COLD">Frio</option>
                </select>
              )}
              {d.actionType === 'set_value' && (
                <input
                  type="number"
                  value={d.value as number ?? ''}
                  onChange={e => onUpdate(node.id, { ...d, value: e.target.value })}
                  placeholder="Valor em R$"
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
              )}
            </>
          )}

          {/* Delay node */}
          {node.type === 'delay' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                Segundos de espera
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={d.seconds as number ?? 5}
                onChange={e => onUpdate(node.id, { ...d, seconds: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
              />
              <p className="text-[9px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>Máximo: 30 segundos</p>
            </div>
          )}

          {/* End node */}
          {node.type === 'end' && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                  Mensagem final (opcional)
                </label>
                <textarea
                  value={d.message as string ?? ''}
                  onChange={e => onUpdate(node.id, { ...d, message: e.target.value })}
                  placeholder="Obrigado! Entraremos em contato."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
                  style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={d.transfer as boolean ?? false}
                  onChange={e => onUpdate(node.id, { ...d, transfer: e.target.checked })}
                  className="rounded"
                />
                <span className="text-xs" style={{ color: 'var(--crm-text)' }}>Transferir para atendente humano</span>
              </label>
            </>
          )}

          {/* Trigger node */}
          {node.type === 'trigger' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                Nome do gatilho
              </label>
              <input
                value={d.label as string ?? ''}
                onChange={e => onUpdate(node.id, { ...d, label: e.target.value })}
                placeholder="Início do fluxo"
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ━━━ Create/Edit Modal ━━━

function BotModal({ onClose, onSave, existing }: {
  onClose: () => void
  onSave: (data: { name: string; description: string; triggerType: string; triggerConfig: Record<string, unknown> | null }) => void
  existing?: BotItem | null
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [triggerType, setTriggerType] = useState(existing?.triggerType ?? 'any_new_conversation')
  const [keywords, setKeywords] = useState(
    (existing?.triggerConfig as { keywords?: string[] } | null)?.keywords?.join(', ') ?? ''
  )
  const [schedule, setSchedule] = useState(
    (existing?.triggerConfig as { schedule?: string } | null)?.schedule ?? '08:00-18:00'
  )

  const handleSubmit = () => {
    if (!name.trim()) return
    let triggerConfig: Record<string, unknown> | null = null
    if (triggerType === 'keyword') {
      triggerConfig = { keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) }
    } else if (triggerType === 'schedule') {
      triggerConfig = { schedule }
    }
    onSave({ name: name.trim(), description: description.trim(), triggerType, triggerConfig })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--crm-text)' }}>
          {existing ? 'Editar Bot' : 'Novo Bot'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
              Nome
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Bot de boas-vindas"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
              Descrição
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Responde automaticamente novos leads"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
              Tipo de gatilho
            </label>
            <select
              value={triggerType}
              onChange={e => setTriggerType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {triggerType === 'keyword' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                Palavras-chave (separadas por vírgula)
              </label>
              <input
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="oi, olá, preço, agendar"
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
              />
            </div>
          )}

          {triggerType === 'schedule' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--crm-text-muted)' }}>
                Horário de funcionamento
              </label>
              <input
                value={schedule}
                onChange={e => setSchedule(e.target.value)}
                placeholder="08:00-18:00"
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)' }}
          >
            {existing ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ━━━ Flow Builder ━━━

function FlowBuilder({ bot, onBack, onSave }: {
  bot: BotDetail
  onBack: () => void
  onSave: (nodes: Node[], edges: Edge[]) => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(bot.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(bot.edges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection,
      animated: true,
      style: { stroke: 'var(--crm-gold)', strokeWidth: 2 },
    }, eds))
    setHasChanges(true)
  }, [setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const updateNodeData = useCallback((id: string, data: Record<string, unknown>) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data } : n))
    setSelectedNode(prev => prev?.id === id ? { ...prev, data } : prev)
    setHasChanges(true)
  }, [setNodes])

  const addNode = useCallback((type: string) => {
    const id = `${type}-${Date.now()}`
    const centerX = 250
    const lastY = nodes.reduce((max, n) => Math.max(max, n.position.y), 0)
    const newNode: Node = {
      id,
      type,
      position: { x: centerX, y: lastY + 120 },
      data: type === 'delay' ? { seconds: 5 } : type === 'condition' ? { field: 'answer', operator: 'contains', value: '' } : {},
    }
    setNodes(nds => [...nds, newNode])
    setSelectedNode(newNode)
    setHasChanges(true)
  }, [nodes, setNodes])

  const deleteSelected = useCallback(() => {
    if (!selectedNode || selectedNode.type === 'trigger') return
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id))
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
    setHasChanges(true)
  }, [selectedNode, setNodes, setEdges])

  const handleSave = () => {
    onSave(nodes, edges)
    setHasChanges(false)
  }

  // Update nodes/edges when they change via drag
  useEffect(() => {
    const handler = () => setHasChanges(true)
    // Track changes through state updates
    return handler
  }, [nodes, edges])

  const nodeTypeButtons = useMemo(() => [
    { type: 'message', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { type: 'question', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 14v-2m0-8a3 3 0 0 1 2.83 2' },
    { type: 'condition', icon: 'M22 12l-4-4v3H6V8l-4 4 4 4v-3h12v3l4-4z' },
    { type: 'action', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
    { type: 'delay', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4v6l4 2' },
    { type: 'end', icon: 'M18 6L6 18M6 6l12 12' },
  ], [])

  return (
    <div className="relative" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--crm-text-muted)' }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>{bot.name}</h2>
            <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
              {TRIGGER_LABELS[bot.triggerType] ?? bot.triggerType}
              {bot.isActive && <span className="ml-2 text-emerald-400">Ativo</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add node buttons */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
            {nodeTypeButtons.map(btn => (
              <button
                key={btn.type}
                onClick={() => addNode(btn.type)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors group relative"
                title={NODE_LABELS[btn.type]}
              >
                <svg width="14" height="14" fill="none" stroke={NODE_COLORS[btn.type]} strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d={btn.icon} />
                </svg>
              </button>
            ))}
          </div>

          {selectedNode && selectedNode.type !== 'trigger' && (
            <button
              onClick={deleteSelected}
              className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
              style={{ color: '#FF6B4A' }}
              title="Excluir nó selecionado"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            style={{ background: hasChanges ? 'linear-gradient(135deg, #D4AF37, #B8962E)' : 'var(--crm-surface-2)', color: hasChanges ? 'var(--crm-bg)' : 'var(--crm-text-muted)' }}
          >
            Salvar Fluxo
          </button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="rounded-2xl overflow-hidden" style={{
        height: 'calc(100% - 3rem)',
        border: '1px solid var(--crm-border)',
        background: 'var(--crm-bg)',
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={e => { onNodesChange(e); setHasChanges(true) }}
          onEdgesChange={e => { onEdgesChange(e); setHasChanges(true) }}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: 'var(--crm-border)', strokeWidth: 2 },
          }}
          style={{ background: 'var(--crm-bg)' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--crm-border)" />
          <Controls
            showInteractive={false}
            style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 12 }}
          />
          <MiniMap
            nodeColor={n => NODE_COLORS[n.type ?? ''] ?? '#888'}
            maskColor="rgba(0,0,0,0.7)"
            style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 12 }}
          />
        </ReactFlow>

        {/* Node properties panel */}
        <AnimatePresence>
          {selectedNode && (
            <NodePropertiesPanel
              node={selectedNode}
              onUpdate={updateNodeData}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ━━━ Main Page ━━━

export default function BotsPage() {
  const [bots, setBots] = useState<BotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBot, setEditingBot] = useState<BotItem | null>(null)
  const [builderBot, setBuilderBot] = useState<BotDetail | null>(null)
  const addToast = useToastStore(s => s.addToast)

  const fetchBots = useCallback(async () => {
    try {
      const data = await apiFetch<{ bots: BotItem[] }>(`/api/admin/crm/bots?tenantId=${TENANT_ID}`)
      setBots(data.bots)
    } catch {
      addToast('Erro ao carregar bots', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { fetchBots() }, [fetchBots])

  const openBuilder = useCallback(async (botId: string) => {
    try {
      const data = await apiFetch<BotDetail>(`/api/admin/crm/bots/${botId}`)
      setBuilderBot(data)
    } catch {
      addToast('Erro ao abrir builder', 'error')
    }
  }, [addToast])

  const handleCreate = useCallback(async (data: { name: string; description: string; triggerType: string; triggerConfig: Record<string, unknown> | null }) => {
    try {
      const bot = await apiFetch<BotItem>('/api/admin/crm/bots', {
        method: 'POST',
        body: JSON.stringify({ tenantId: TENANT_ID, ...data }),
      })
      setBots(prev => [bot, ...prev])
      setShowModal(false)
      addToast('Bot criado', 'success')
      // Open builder right away
      openBuilder(bot.id)
    } catch {
      addToast('Erro ao criar bot', 'error')
    }
  }, [addToast, openBuilder])

  const handleUpdate = useCallback(async (data: { name: string; description: string; triggerType: string; triggerConfig: Record<string, unknown> | null }) => {
    if (!editingBot) return
    try {
      const updated = await apiFetch<BotItem>(`/api/admin/crm/bots/${editingBot.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      setBots(prev => prev.map(b => b.id === editingBot.id ? { ...b, ...updated } : b))
      setEditingBot(null)
      addToast('Bot atualizado', 'success')
    } catch {
      addToast('Erro ao atualizar bot', 'error')
    }
  }, [editingBot, addToast])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Excluir este bot? Sessões ativas serão encerradas.')) return
    try {
      await apiFetch(`/api/admin/crm/bots/${id}`, { method: 'DELETE' })
      setBots(prev => prev.filter(b => b.id !== id))
      addToast('Bot excluído', 'success')
    } catch {
      addToast('Erro ao excluir bot', 'error')
    }
  }, [addToast])

  const toggleActive = useCallback(async (bot: BotItem) => {
    try {
      await apiFetch(`/api/admin/crm/bots/${bot.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !bot.isActive }),
      })
      setBots(prev => prev.map(b => b.id === bot.id ? { ...b, isActive: !b.isActive } : b))
      addToast(bot.isActive ? 'Bot desativado' : 'Bot ativado', 'success')
    } catch {
      addToast('Erro ao alterar status', 'error')
    }
  }, [addToast])

  const handleSaveFlow = useCallback(async (nodes: Node[], edges: Edge[]) => {
    if (!builderBot) return
    try {
      await apiFetch(`/api/admin/crm/bots/${builderBot.id}`, {
        method: 'PUT',
        body: JSON.stringify({ nodes, edges }),
      })
      addToast('Fluxo salvo', 'success')
    } catch {
      addToast('Erro ao salvar fluxo', 'error')
    }
  }, [builderBot, addToast])

  // ━━━ Builder view ━━━

  if (builderBot) {
    return (
      <FlowBuilder
        bot={builderBot}
        onBack={() => { setBuilderBot(null); fetchBots() }}
        onSave={handleSaveFlow}
      />
    )
  }

  // ━━━ List view ━━━

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--crm-text)', fontFamily: 'var(--font-display, inherit)' }}>
            Bot Builder
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Crie fluxos visuais de conversação para WhatsApp
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)', boxShadow: '0 4px 16px rgba(212,175,55,0.25)' }}
        >
          + Novo Bot
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && bots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.1)' }}
          >
            <svg width="36" height="36" fill="none" stroke="var(--crm-gold)" strokeWidth="1.2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4m-7.07-2.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-2.93 7.07l-2.83-2.83M6.76 6.76L3.93 3.93" />
            </svg>
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>Crie seu primeiro bot</p>
          <p className="text-xs mt-1.5 max-w-xs text-center" style={{ color: 'var(--crm-text-muted)' }}>
            Bots automatizam conversas no WhatsApp com fluxos visuais de perguntas, respostas e ações.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)', boxShadow: '0 4px 16px rgba(212,175,55,0.25)' }}
          >
            + Criar Bot
          </button>
        </div>
      )}

      {/* Bot list */}
      {!loading && bots.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence>
            {bots.map((bot, i) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl p-4 group cursor-pointer transition-all hover:brightness-105"
                style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
                onClick={() => openBuilder(bot.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--crm-text)' }}>
                        {bot.name}
                      </span>
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase"
                        style={{
                          background: bot.isActive ? 'rgba(46,204,138,0.12)' : 'rgba(139,138,148,0.12)',
                          color: bot.isActive ? '#2ECC8A' : '#8B8A94',
                        }}
                      >
                        {bot.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {bot.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--crm-text-muted)' }}>
                        {bot.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-md" style={{
                        background: 'rgba(212,175,55,0.08)', color: 'var(--crm-gold)',
                      }}>
                        {TRIGGER_LABELS[bot.triggerType] ?? bot.triggerType}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                        {bot._count.sessions} sessões
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                        {new Date(bot.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleActive(bot)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      title={bot.isActive ? 'Desativar' : 'Ativar'}
                      style={{ color: bot.isActive ? '#2ECC8A' : 'var(--crm-text-muted)' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        {bot.isActive
                          ? <><circle cx="12" cy="12" r="10" /><path d="M10 15l5-3-5-3z" /></>
                          : <><circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" /></>
                        }
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditingBot(bot)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      title="Editar"
                      style={{ color: 'var(--crm-text-muted)' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(bot.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Excluir"
                      style={{ color: '#FF6B4A' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showModal && (
          <BotModal
            onClose={() => setShowModal(false)}
            onSave={handleCreate}
          />
        )}
        {editingBot && (
          <BotModal
            existing={editingBot}
            onClose={() => setEditingBot(null)}
            onSave={handleUpdate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
