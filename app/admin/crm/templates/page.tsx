'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playFeedback } from '@/lib/crm-feedback'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// ━━━ Types ━━━

interface Template {
  id: string
  type: 'whatsapp' | 'email'
  name: string
  category: string
  subject: string | null
  content: string
  variables: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ━━━ Constants ━━━

const CATEGORIES = [
  { value: 'boas-vindas', label: 'Boas-vindas' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'cobranca', label: 'Cobrança' },
  { value: 'confirmacao', label: 'Confirmação' },
  { value: 'pos-atendimento', label: 'Pós-atendimento' },
  { value: 'lembrete', label: 'Lembrete' },
  { value: 'geral', label: 'Geral' },
]

const AVAILABLE_VARIABLES = [
  { key: '{{nome}}', label: 'Nome do lead' },
  { key: '{{telefone}}', label: 'Telefone' },
  { key: '{{email}}', label: 'E-mail' },
  { key: '{{pipeline}}', label: 'Pipeline' },
  { key: '{{estagio}}', label: 'Estágio' },
  { key: '{{valor}}', label: 'Valor esperado' },
]

const SAMPLE_DATA: Record<string, string> = {
  '{{nome}}': 'Maria Silva',
  '{{telefone}}': '(11) 98765-4321',
  '{{email}}': 'maria@email.com',
  '{{pipeline}}': 'Vendas',
  '{{estagio}}': 'Proposta',
  '{{valor}}': 'R$ 2.500',
}

function getCategoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label ?? value
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'boas-vindas': '#2ECC8A',
    'follow-up': '#F0A500',
    'cobranca': '#FF6B4A',
    'confirmacao': '#4A7BFF',
    'pos-atendimento': '#7B68EE',
    'lembrete': '#D4AF37',
    'geral': 'var(--crm-text-muted)',
  }
  return colors[category] ?? 'var(--crm-text-muted)'
}

function replaceVariables(content: string, data: Record<string, string>): string {
  let result = content
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(key, value)
  }
  return result
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ━━━ Skeleton ━━━

function TemplatesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg" style={{ background: 'var(--crm-surface-2)' }} />
            <div className="flex-1">
              <div className="h-4 w-32 rounded mb-1.5" style={{ background: 'var(--crm-surface-2)' }} />
              <div className="h-3 w-20 rounded" style={{ background: 'var(--crm-surface-2)' }} />
            </div>
          </div>
          <div className="h-16 rounded-lg" style={{ background: 'var(--crm-surface-2)' }} />
        </div>
      ))}
    </div>
  )
}

// ━━━ Empty State ━━━

function EmptyState({ onCreateFirst }: { onCreateFirst: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(212,175,55,0.06)' }}>
        <svg width="36" height="36" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--crm-text)' }}>Nenhum modelo criado</p>
      <p className="text-xs mb-5 text-center max-w-[280px]" style={{ color: 'var(--crm-text-muted)' }}>
        Crie modelos de mensagem para WhatsApp e e-mail com variáveis dinâmicas
      </p>
      <button
        onClick={onCreateFirst}
        className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
        style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: 'var(--crm-bg)' }}
      >
        Criar primeiro modelo
      </button>
    </div>
  )
}

// ━━━ Template Card ━━━

function TemplateCard({ template, onEdit, onDuplicate, onDelete, onToggle }: {
  template: Template
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-xl overflow-hidden transition-shadow group"
      style={{
        background: 'var(--crm-surface)',
        border: '1px solid var(--crm-border)',
        opacity: template.isActive ? 1 : 0.5,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: template.type === 'whatsapp' ? 'rgba(37,211,102,0.12)' : 'rgba(74,123,255,0.12)',
              }}
            >
              {template.type === 'whatsapp' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" stroke="#4A7BFF" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--crm-text)' }}>
                {template.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    color: getCategoryColor(template.category),
                    background: `${getCategoryColor(template.category)}15`,
                  }}
                >
                  {getCategoryLabel(template.category)}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                  {template.type === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                </span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(p => !p)}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--crm-text-muted)' }}
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>

            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute right-0 top-full mt-1 w-40 rounded-xl overflow-hidden shadow-xl z-40"
                    style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)' }}
                  >
                    <button onClick={() => { onEdit(); setShowMenu(false) }} className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5" style={{ color: 'var(--crm-text)' }}>
                      Editar
                    </button>
                    <button onClick={() => { onDuplicate(); setShowMenu(false) }} className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5" style={{ color: 'var(--crm-text)' }}>
                      Duplicar
                    </button>
                    <button onClick={() => { onToggle(); setShowMenu(false) }} className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5" style={{ color: 'var(--crm-text)' }}>
                      {template.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => { onDelete(); setShowMenu(false) }} className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5" style={{ color: '#FF6B4A' }}>
                      Excluir
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Subject (email only) */}
        {template.type === 'email' && template.subject && (
          <p className="text-[11px] font-medium mb-2 truncate" style={{ color: 'var(--crm-text-muted)' }}>
            Assunto: {template.subject}
          </p>
        )}

        {/* Content preview */}
        <div
          className="rounded-lg p-3 text-xs leading-relaxed"
          style={{
            background: 'var(--crm-surface-2)',
            color: 'var(--crm-text)',
            maxHeight: '80px',
            overflow: 'hidden',
            maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          }}
        >
          {template.content}
        </div>

        {/* Variables + date */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex flex-wrap gap-1">
            {template.variables.slice(0, 3).map(v => (
              <span key={v} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(212,175,55,0.08)', color: 'var(--crm-gold)' }}>
                {v}
              </span>
            ))}
            {template.variables.length > 3 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: 'var(--crm-text-muted)' }}>
                +{template.variables.length - 3}
              </span>
            )}
          </div>
          <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
            {formatDate(template.updatedAt)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ━━━ Template Modal ━━━

function TemplateModal({ template, onClose, onSave }: {
  template: Template | null
  onClose: () => void
  onSave: (data: Partial<Template>) => Promise<void>
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [type, setType] = useState<'whatsapp' | 'email'>(template?.type ?? 'whatsapp')
  const [category, setCategory] = useState(template?.category ?? 'geral')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [content, setContent] = useState(template?.content ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return
    setIsSaving(true)
    try {
      await onSave({ name, type, category, subject: type === 'email' ? subject : null, content })
    } finally {
      setIsSaving(false)
    }
  }

  const insertVariable = (varKey: string) => {
    setContent(prev => prev + varKey)
  }

  const previewContent = replaceVariables(content, SAMPLE_DATA)

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 sm:w-[640px] sm:max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--crm-surface)',
          border: '1px solid var(--crm-border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--crm-text)' }}>
            {template ? 'Editar modelo' : 'Novo modelo'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--crm-text-muted)' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
              Nome do modelo
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Boas-vindas WhatsApp"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1"
              style={{
                background: 'var(--crm-surface-2)',
                color: 'var(--crm-text)',
                border: '1px solid var(--crm-border)',
              }}
            />
          </div>

          {/* Type + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                Tipo
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'whatsapp' | 'email')}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 appearance-none"
                style={{
                  background: 'var(--crm-surface-2)',
                  color: 'var(--crm-text)',
                  border: '1px solid var(--crm-border)',
                }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                Categoria
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 appearance-none"
                style={{
                  background: 'var(--crm-surface-2)',
                  color: 'var(--crm-text)',
                  border: '1px solid var(--crm-border)',
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject (email only) */}
          <AnimatePresence>
            {type === 'email' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  Assunto do e-mail
                </label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Ex: Confirmação de agendamento — {{nome}}"
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1"
                  style={{
                    background: 'var(--crm-surface-2)',
                    color: 'var(--crm-text)',
                    border: '1px solid var(--crm-border)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Variables */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
              Variáveis disponíveis
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARIABLES.map(v => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  className="px-2 py-1 rounded-md text-[11px] font-mono transition-all hover:scale-105"
                  style={{ background: 'rgba(212,175,55,0.08)', color: 'var(--crm-gold)', border: '1px solid rgba(212,175,55,0.15)' }}
                  title={v.label}
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>
                Conteúdo
              </label>
              <button
                onClick={() => setShowPreview(p => !p)}
                className="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
                style={{
                  color: showPreview ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                  background: showPreview ? 'rgba(212,175,55,0.08)' : 'transparent',
                }}
              >
                {showPreview ? 'Editar' : 'Preview'}
              </button>
            </div>

            {showPreview ? (
              <div
                className="w-full px-3 py-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap min-h-[160px]"
                style={{
                  background: 'var(--crm-surface-2)',
                  color: 'var(--crm-text)',
                  border: '1px solid var(--crm-border)',
                }}
              >
                {previewContent || <span style={{ color: 'var(--crm-text-muted)' }}>Nenhum conteúdo para visualizar</span>}
              </div>
            ) : (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Olá {{nome}}, tudo bem? Gostaríamos de confirmar seu agendamento..."
                rows={6}
                className="w-full px-3 py-2.5 rounded-lg text-sm resize-none focus:outline-none focus:ring-1"
                style={{
                  background: 'var(--crm-surface-2)',
                  color: 'var(--crm-text)',
                  border: '1px solid var(--crm-border)',
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--crm-border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
            style={{ color: 'var(--crm-text-muted)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !content.trim() || isSaving}
            className="px-5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
              color: 'var(--crm-bg)',
              boxShadow: '0 2px 12px rgba(212,175,55,0.25)',
            }}
          >
            {isSaving ? 'Salvando...' : template ? 'Salvar' : 'Criar modelo'}
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ━━━ Delete Confirmation ━━━

function DeleteConfirm({ name, onConfirm, onCancel }: {
  name: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      />
      <motion.div
        className="fixed top-1/2 left-1/2 z-50 w-[360px] rounded-2xl p-6"
        style={{
          background: 'var(--crm-surface)',
          border: '1px solid var(--crm-border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--crm-text)' }}>Excluir modelo?</p>
        <p className="text-xs mb-5" style={{ color: 'var(--crm-text-muted)' }}>
          O modelo &ldquo;{name}&rdquo; será excluído permanentemente. Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-medium hover:bg-white/5" style={{ color: 'var(--crm-text-muted)' }}>
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255,107,74,0.15)', color: '#FF6B4A' }}>
            Excluir
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ━━━ Main Page ━━━

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null)
  const addToast = useToastStore(s => s.addToast)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  const fetchTemplates = useCallback(async () => {
    if (!token) return
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID })
      if (filterType !== 'all') params.set('type', filterType)
      if (filterCategory !== 'all') params.set('category', filterCategory)

      const res = await fetch(`/api/admin/crm/templates?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setTemplates(data.templates)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [token, filterType, filterCategory])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const filteredTemplates = templates.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)
  })

  const handleSave = async (data: Partial<Template>) => {
    if (!token) return
    try {
      const isEditing = !!editingTemplate
      const url = isEditing
        ? `/api/admin/crm/templates/${editingTemplate.id}`
        : '/api/admin/crm/templates'

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, tenantId: TENANT_ID }),
      })

      if (!res.ok) throw new Error()
      playFeedback('click')
      addToast(isEditing ? 'Modelo atualizado' : 'Modelo criado', 'success')
      setShowModal(false)
      setEditingTemplate(null)
      fetchTemplates()
    } catch {
      addToast('Falha ao salvar modelo', 'error')
    }
  }

  const handleDuplicate = async (template: Template) => {
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/templates/${template.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      playFeedback('click')
      addToast('Modelo duplicado', 'success')
      fetchTemplates()
    } catch {
      addToast('Falha ao duplicar modelo', 'error')
    }
  }

  const handleDelete = async () => {
    if (!token || !deletingTemplate) return
    try {
      const res = await fetch(`/api/admin/crm/templates/${deletingTemplate.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      playFeedback('click')
      addToast('Modelo excluído', 'success')
      setDeletingTemplate(null)
      fetchTemplates()
    } catch {
      addToast('Falha ao excluir modelo', 'error')
    }
  }

  const handleToggle = async (template: Template) => {
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !template.isActive }),
      })
      if (!res.ok) throw new Error()
      addToast(template.isActive ? 'Modelo desativado' : 'Modelo ativado', 'info')
      fetchTemplates()
    } catch {
      addToast('Falha ao atualizar modelo', 'error')
    }
  }

  const openCreate = () => {
    setEditingTemplate(null)
    setShowModal(true)
  }

  const openEdit = (template: Template) => {
    setEditingTemplate(template)
    setShowModal(true)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--crm-text)' }}>Modelos</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Templates de mensagem e e-mail com variáveis dinâmicas
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0"
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
            color: 'var(--crm-bg)',
            boxShadow: '0 2px 12px rgba(212,175,55,0.25)',
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo modelo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar modelo..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs focus:outline-none focus:ring-1"
            style={{
              background: 'var(--crm-surface)',
              color: 'var(--crm-text)',
              border: '1px solid var(--crm-border)',
            }}
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs appearance-none focus:outline-none"
          style={{
            background: 'var(--crm-surface)',
            color: 'var(--crm-text)',
            border: '1px solid var(--crm-border)',
          }}
        >
          <option value="all">Todos os tipos</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">E-mail</option>
        </select>

        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs appearance-none focus:outline-none"
          style={{
            background: 'var(--crm-surface)',
            color: 'var(--crm-text)',
            border: '1px solid var(--crm-border)',
          }}
        >
          <option value="all">Todas as categorias</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* Stats */}
        <div className="ml-auto text-[11px] font-medium" style={{ color: 'var(--crm-text-muted)' }}>
          {filteredTemplates.length} modelo{filteredTemplates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <TemplatesSkeleton />
      ) : filteredTemplates.length === 0 && !search && filterType === 'all' && filterCategory === 'all' ? (
        <EmptyState onCreateFirst={openCreate} />
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>Nenhum modelo encontrado com esses filtros</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => openEdit(template)}
                onDuplicate={() => handleDuplicate(template)}
                onDelete={() => setDeletingTemplate(template)}
                onToggle={() => handleToggle(template)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showModal && (
          <TemplateModal
            template={editingTemplate}
            onClose={() => { setShowModal(false); setEditingTemplate(null) }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingTemplate && (
          <DeleteConfirm
            name={deletingTemplate.name}
            onConfirm={handleDelete}
            onCancel={() => setDeletingTemplate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
