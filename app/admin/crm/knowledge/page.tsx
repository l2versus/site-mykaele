'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useToastStore } from '@/stores/toast-store'
import { motion, AnimatePresence } from 'framer-motion'

// ━━━ Types ━━━

type SourceType = 'TEXT' | 'FILE' | 'URL'
type SourceLang = 'pt-BR' | 'en'
type SortField = 'name' | 'date' | 'usage'

interface KnowledgeSource {
  id: string
  name: string
  type: SourceType
  content: string
  chunks: ChunkInfo[]
  timesUsed: number
  language: SourceLang
  updatedBy: { name: string; avatar: string | null }
  updatedAt: string
  createdAt: string
  isActive: boolean
  tags: string[]
  sourceFile: string | null
  sourceUrl: string | null
  embeddingStatus: 'pending' | 'processing' | 'ready' | 'failed'
}

interface ChunkInfo {
  index: number
  preview: string
  tokenCount: number
}

interface UsageEntry {
  query: string
  similarity: number
  timestamp: string
}

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// Mapeia resposta da API para o formato da interface da página
function mapApiSource(src: Record<string, unknown>): KnowledgeSource {
  return {
    id: src.id as string,
    name: src.name as string,
    type: (src.type as SourceType) ?? 'TEXT',
    content: src.content as string,
    chunks: (src.chunks as ChunkInfo[]) ?? [],
    timesUsed: 0,
    language: 'pt-BR',
    updatedBy: { name: 'Admin', avatar: null },
    updatedAt: src.updatedAt as string,
    createdAt: src.createdAt as string,
    isActive: src.isActive as boolean,
    tags: [],
    sourceFile: (src.sourceFile as string) ?? null,
    sourceUrl: null,
    embeddingStatus: (src.embeddingStatus as KnowledgeSource['embeddingStatus']) ?? 'ready',
  }
}

// ━━━ Helpers ━━━

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ontem'
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}m`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TYPE_LABELS: Record<SourceType, string> = {
  TEXT: 'Texto',
  FILE: 'Arquivo',
  URL: 'URL',
}

const LANG_LABELS: Record<SourceLang, string> = {
  'pt-BR': 'Portugues',
  en: 'English',
}

const EMBEDDING_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: '#F0A500' },
  processing: { label: 'Processando', color: '#4A7BFF' },
  ready: { label: 'Pronto', color: '#2ECC8A' },
  failed: { label: 'Falhou', color: '#FF6B4A' },
}

// ━━━ SVG Icons (inline) ━━━

function BookIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  )
}

function DocumentIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function FileIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  )
}

function GlobeIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function SearchIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function PlusIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function EditIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function CloseIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function UploadIcon({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function ChevronDownIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function RefreshIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function ChunksIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function BrainIcon({ size = 64, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
      <path d="M9 21h6" />
      <path d="M12 2v5" />
      <path d="M8 6l2.5 2.5" />
      <path d="M16 6l-2.5 2.5" />
      <path d="M7.5 11h2" />
      <path d="M14.5 11h2" />
    </svg>
  )
}

// ━━━ Type Icon Helper ━━━

function TypeIcon({ type, size = 16 }: { type: SourceType; size?: number }) {
  switch (type) {
    case 'TEXT':
      return <DocumentIcon size={size} color="var(--crm-gold)" />
    case 'FILE':
      return <FileIcon size={size} color="#4A7BFF" />
    case 'URL':
      return <GlobeIcon size={size} color="#2ECC8A" />
  }
}

// ━━━ Animations ━━━

const listStagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const listItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
}

const modalOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

const modalContent = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 25, mass: 1.2 } },
  exit: { opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.15 } },
}

const drawerVariants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 400, damping: 30, mass: 1 } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
}

const bulkBarVariants = {
  hidden: { y: 80, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 400, damping: 25 } },
  exit: { y: 80, opacity: 0, transition: { duration: 0.2 } },
}

// ━━━ Skeleton ━━━

function KnowledgeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
      <div className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
    </div>
  )
}

// ━━━ Empty State ━━━

function EmptyState({ onAddFirst }: { onAddFirst: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div
        className="w-28 h-28 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.1)' }}
      >
        <BrainIcon size={56} color="var(--crm-gold)" />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--crm-text)' }}>
        Nenhuma fonte de conhecimento
      </h3>
      <p
        className="text-sm max-w-md text-center mb-6 leading-relaxed"
        style={{ color: 'var(--crm-text-muted)' }}
      >
        Adicione documentos, textos ou URLs para que a IA responda com base nos seus dados reais.
      </p>
      <button
        onClick={onAddFirst}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
          color: 'var(--crm-bg)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        <PlusIcon size={15} color="var(--crm-bg)" />
        Adicionar primeira fonte
      </button>
    </div>
  )
}

// ━━━ Stat Card ━━━

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <motion.div
      className="rounded-xl p-4 border"
      style={{
        background: 'var(--crm-surface)',
        borderColor: 'var(--crm-border)',
      }}
      whileHover={{ y: -1, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--crm-gold-subtle)' }}
        >
          {icon}
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold" style={{ color: 'var(--crm-text)' }}>
        {value}
      </p>
    </motion.div>
  )
}

// ━━━ Add/Edit Modal ━━━

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  editingSource: KnowledgeSource | null
  onSave: (source: Partial<KnowledgeSource>) => void
}

function AddEditModal({ isOpen, onClose, editingSource, onSave }: ModalProps) {
  const [name, setName] = useState(editingSource?.name ?? '')
  const [type, setType] = useState<SourceType>(editingSource?.type ?? 'TEXT')
  const [content, setContent] = useState(editingSource?.content ?? '')
  const [url, setUrl] = useState(editingSource?.sourceUrl ?? '')
  const [language, setLanguage] = useState<SourceLang>(editingSource?.language ?? 'pt-BR')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(editingSource?.tags ?? [])
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState(editingSource?.sourceFile ?? '')

  const isEditing = editingSource !== null

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return
    onSave({
      id: editingSource?.id,
      name: name.trim(),
      type,
      content: type === 'URL' ? '' : content,
      sourceUrl: type === 'URL' ? url : null,
      sourceFile: type === 'FILE' ? fileName : null,
      language,
      tags,
    })
    onClose()
  }, [name, type, content, url, fileName, language, tags, editingSource, onSave, onClose])

  const handleTagAdd = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed])
    }
    setTagInput('')
  }, [tagInput, tags])

  const handleTagRemove = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      setFileName(files[0].name)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setFileName(files[0].name)
    }
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border"
            style={{
              background: 'rgba(17,17,20,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderColor: 'var(--crm-border)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>
                {isEditing ? 'Editar Fonte' : 'Adicionar Fonte'}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--crm-text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--crm-surface-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  Nome da fonte
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Protocolos clinicos"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors"
                  style={{
                    background: 'var(--crm-surface-2)',
                    borderColor: 'var(--crm-border)',
                    color: 'var(--crm-text)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
                />
              </div>

              {/* Type Selector */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  Tipo de fonte
                </label>
                <div className="flex gap-2">
                  {(['TEXT', 'FILE', 'URL'] as SourceType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200"
                      style={{
                        background: type === t ? 'var(--crm-gold-subtle)' : 'var(--crm-surface-2)',
                        borderColor: type === t ? 'var(--crm-gold)' : 'var(--crm-border)',
                        color: type === t ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                      }}
                    >
                      <TypeIcon type={t} size={14} />
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content based on type */}
              {type === 'TEXT' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                    Conteudo
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Cole aqui o conteudo que a IA deve aprender..."
                    rows={8}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors resize-none"
                    style={{
                      background: 'var(--crm-surface-2)',
                      borderColor: 'var(--crm-border)',
                      color: 'var(--crm-text)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
                  />
                  <p className="text-[11px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                    O texto sera dividido em chunks e indexado para busca semantica.
                  </p>
                </div>
              )}

              {type === 'FILE' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                    Arquivo (PDF, TXT, DOCX)
                  </label>
                  <div
                    className="relative rounded-lg border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer"
                    style={{
                      borderColor: isDragging ? 'var(--crm-gold)' : 'var(--crm-border)',
                      background: isDragging ? 'var(--crm-gold-subtle)' : 'var(--crm-surface-2)',
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    <input
                      id="file-input"
                      type="file"
                      accept=".pdf,.txt,.docx"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <div className="flex flex-col items-center gap-2">
                      <UploadIcon size={28} color={isDragging ? 'var(--crm-gold)' : 'var(--crm-text-muted)'} />
                      {fileName ? (
                        <p className="text-sm font-medium" style={{ color: 'var(--crm-text)' }}>
                          {fileName}
                        </p>
                      ) : (
                        <>
                          <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>
                            Arraste um arquivo ou clique para selecionar
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>
                            PDF, TXT ou DOCX ate 10MB
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {type === 'URL' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                    URL da pagina
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://exemplo.com.br/pagina"
                    className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors"
                    style={{
                      background: 'var(--crm-surface-2)',
                      borderColor: 'var(--crm-border)',
                      color: 'var(--crm-text)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
                  />
                  <p className="text-[11px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                    A IA ira extrair e indexar o conteudo da pagina.
                  </p>
                </div>
              )}

              {/* Language */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  Idioma
                </label>
                <div className="relative">
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as SourceLang)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none appearance-none transition-colors"
                    style={{
                      background: 'var(--crm-surface-2)',
                      borderColor: 'var(--crm-border)',
                      color: 'var(--crm-text)',
                    }}
                  >
                    <option value="pt-BR">Portugues</option>
                    <option value="en">English</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDownIcon size={12} color="var(--crm-text-muted)" />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  Tags
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTagAdd() } }}
                    placeholder="Adicionar tag..."
                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none transition-colors"
                    style={{
                      background: 'var(--crm-surface-2)',
                      borderColor: 'var(--crm-border)',
                      color: 'var(--crm-text)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
                  />
                  <button
                    onClick={handleTagAdd}
                    className="px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
                    style={{
                      background: 'var(--crm-surface-2)',
                      borderColor: 'var(--crm-border)',
                      color: 'var(--crm-text-muted)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
                  >
                    <PlusIcon size={12} />
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors"
                        style={{
                          background: 'var(--crm-gold-subtle)',
                          color: 'var(--crm-gold)',
                        }}
                        onClick={() => handleTagRemove(tag)}
                      >
                        {tag}
                        <CloseIcon size={10} color="var(--crm-gold)" />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--crm-border)' }}>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: 'var(--crm-text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--crm-text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--crm-text-muted)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
                  color: 'var(--crm-bg)',
                }}
                onMouseEnter={(e) => { if (name.trim()) e.currentTarget.style.opacity = '0.9' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              >
                Processar e Salvar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ━━━ Source Detail Drawer ━━━

interface DrawerProps {
  source: KnowledgeSource | null
  onClose: () => void
  usageHistory: UsageEntry[]
}

function SourceDetailDrawer({ source, onClose, usageHistory }: DrawerProps) {
  const [editedName, setEditedName] = useState(source?.name ?? '')

  return (
    <AnimatePresence>
      {source && (
        <motion.div className="fixed inset-0 z-50 flex justify-end" variants={modalOverlay} initial="hidden" animate="visible" exit="exit">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-xl h-full overflow-y-auto border-l"
            style={{
              background: 'var(--crm-bg)',
              borderColor: 'var(--crm-border)',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
            }}
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--crm-border)', background: 'var(--crm-bg)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--crm-gold-subtle)' }}>
                  <TypeIcon type={source.type} size={18} />
                </div>
                <div>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="bg-transparent text-base font-semibold outline-none border-b border-transparent transition-colors"
                    style={{ color: 'var(--crm-text)' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
                  />
                  <p className="text-[11px]" style={{ color: 'var(--crm-text-muted)' }}>
                    {TYPE_LABELS[source.type]} · {LANG_LABELS[source.language]}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--crm-text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--crm-surface-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Criado em', value: formatDateTime(source.createdAt) },
                  { label: 'Atualizado em', value: formatDateTime(source.updatedAt) },
                  { label: 'Chunks', value: String(source.chunks.length) },
                  { label: 'Embedding', value: EMBEDDING_LABELS[source.embeddingStatus].label },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg p-3 border"
                    style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
                  >
                    <p className="text-[11px] mb-0.5" style={{ color: 'var(--crm-text-muted)' }}>{item.label}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--crm-text)' }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Tags */}
              {source.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {source.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium"
                        style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Preview */}
              <div>
                <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>Conteudo</h4>
                <div
                  className="rounded-lg p-4 text-sm leading-relaxed max-h-48 overflow-y-auto border"
                  style={{
                    background: 'var(--crm-surface)',
                    borderColor: 'var(--crm-border)',
                    color: 'var(--crm-text)',
                  }}
                >
                  {source.content}
                </div>
              </div>

              {/* Chunks List */}
              <div>
                <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                  <ChunksIcon size={12} color="var(--crm-text-muted)" />
                  Chunks ({source.chunks.length})
                </h4>
                <div className="space-y-2">
                  {source.chunks.map((chunk) => (
                    <div
                      key={chunk.index}
                      className="rounded-lg p-3 border"
                      style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}>
                          #{chunk.index}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                          {chunk.tokenCount} tokens
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
                        {chunk.preview}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Usage History */}
              <div>
                <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>
                  Historico de uso (ultimas 5 consultas)
                </h4>
                {usageHistory.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>
                    Nenhuma consulta utilizou esta fonte ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {usageHistory.map((entry, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg p-3 border"
                        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
                      >
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--crm-text)' }}>
                          &ldquo;{entry.query}&rdquo;
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                            Similaridade: {(entry.similarity * 100).toFixed(0)}%
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                            {timeAgo(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Source File */}
              {source.sourceFile && (
                <div>
                  <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>Arquivo de origem</h4>
                  <div
                    className="flex items-center gap-2 rounded-lg p-3 border"
                    style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
                  >
                    <FileIcon size={14} color="#4A7BFF" />
                    <span className="text-sm" style={{ color: 'var(--crm-text)' }}>{source.sourceFile}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ━━━ Main Page Component ━━━

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | SourceType>('ALL')
  const [langFilter, setLangFilter] = useState<'ALL' | SourceLang>('ALL')
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null)
  const [drawerSource, setDrawerSource] = useState<KnowledgeSource | null>(null)
  const addToast = useToastStore(s => s.addToast)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  const fetchSources = useCallback(async () => {
    if (!token) return
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/crm/knowledge?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Falha ao carregar fontes')
      const data = await res.json()
      setSources((data.sources ?? []).map(mapApiSource))
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao carregar', 'error')
    } finally {
      setLoading(false)
    }
  }, [token, addToast])

  useEffect(() => { fetchSources() }, [fetchSources])

  // ━━━ Filtered & Sorted ━━━

  const filteredSources = useMemo(() => {
    let result = sources.filter((s) => s.isActive || selectedIds.has(s.id))

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q))
      )
    }

    if (typeFilter !== 'ALL') {
      result = result.filter((s) => s.type === typeFilter)
    }

    if (langFilter !== 'ALL') {
      result = result.filter((s) => s.language === langFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'pt-BR')
        case 'date':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'usage':
          return b.timesUsed - a.timesUsed
        default:
          return 0
      }
    })

    return result
  }, [sources, search, typeFilter, langFilter, sortBy, selectedIds])

  // ━━━ Stats ━━━

  const stats = useMemo(() => {
    const activeSources = sources.filter((s) => s.isActive)
    const totalChunks = activeSources.reduce((acc, s) => acc + s.chunks.length, 0)
    const totalUsed = activeSources.reduce((acc, s) => acc + s.timesUsed, 0)
    const avgRelevance = totalUsed > 0 ? 87 : 0
    return {
      totalSources: activeSources.length,
      totalChunks,
      totalUsed,
      avgRelevance,
    }
  }, [sources])

  // ━━━ Handlers ━━━

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredSources.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSources.map((s) => s.id)))
    }
  }, [filteredSources, selectedIds])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleOpenAdd = useCallback(() => {
    setEditingSource(null)
    setModalOpen(true)
  }, [])

  const handleOpenEdit = useCallback((source: KnowledgeSource) => {
    setEditingSource(source)
    setModalOpen(true)
  }, [])

  const handleSave = useCallback(async (partial: Partial<KnowledgeSource>) => {
    if (!token) return
    try {
      if (partial.id) {
        const res = await fetch(`/api/admin/crm/knowledge`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            id: partial.id,
            name: partial.name,
            content: partial.content,
            isActive: partial.isActive,
          }),
        })
        if (!res.ok) throw new Error('Falha ao atualizar')
        addToast('Fonte atualizada')
      } else {
        const res = await fetch(`/api/admin/crm/knowledge?tenantId=${TENANT_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: partial.name,
            content: partial.content,
            sourceFile: partial.sourceFile,
            tenantId: TENANT_ID,
          }),
        })
        if (!res.ok) throw new Error('Falha ao criar')
        addToast('Fonte criada')
      }
      fetchSources()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
    }
  }, [token, addToast, fetchSources])

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/knowledge?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Falha ao excluir')
      setSources((prev) => prev.filter((s) => s.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      addToast('Fonte excluída')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao excluir', 'error')
    }
  }, [token, addToast])

  const handleBulkDelete = useCallback(async () => {
    if (!token) return
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/admin/crm/knowledge?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      )
      setSources((prev) => prev.filter((s) => !selectedIds.has(s.id)))
      setSelectedIds(new Set())
      addToast(`${selectedIds.size} fonte(s) excluída(s)`)
    } catch {
      addToast('Erro ao excluir fontes', 'error')
    }
  }, [selectedIds, token, addToast])

  const handleBulkDeactivate = useCallback(() => {
    setSources((prev) =>
      prev.map((s) => (selectedIds.has(s.id) ? { ...s, isActive: false } : s))
    )
    setSelectedIds(new Set())
  }, [selectedIds])

  const handleBulkReprocess = useCallback(() => {
    setSources((prev) =>
      prev.map((s) =>
        selectedIds.has(s.id) ? { ...s, embeddingStatus: 'processing' as const } : s
      )
    )
    setSelectedIds(new Set())
  }, [selectedIds])

  const handleOpenDrawer = useCallback((source: KnowledgeSource) => {
    setDrawerSource(source)
  }, [])

  // ━━━ Usage bar max ━━━

  const maxUsage = useMemo(() => Math.max(...sources.map((s) => s.timesUsed), 1), [sources])

  // ━━━ Render ━━━

  if (loading) {
    return <KnowledgeSkeleton />
  }

  return (
    <div className="space-y-5">
      {/* ━━━ Header ━━━ */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="w-[42px] h-[42px] rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--crm-gold-subtle)' }}
          >
            <BookIcon size={24} color="var(--crm-gold)" />
          </div>
          <div>
            <h1
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--crm-text)', fontFamily: 'var(--font-display, inherit)' }}
            >
              Base de Conhecimento
            </h1>
            <p className="text-sm mt-0.5 ml-0" style={{ color: 'var(--crm-text-muted)' }}>
              Gerencie as fontes de conhecimento da IA do seu CRM
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
            color: 'var(--crm-bg)',
            boxShadow: '0 2px 12px rgba(212,175,55,0.3)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,175,55,0.4)' }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(212,175,55,0.3)' }}
        >
          <PlusIcon size={15} color="var(--crm-bg)" />
          Adicionar Fonte
        </button>
      </div>

      {/* ━━━ Stats Bar ━━━ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total de Fontes"
          value={String(stats.totalSources)}
          icon={<BookIcon size={16} color="var(--crm-gold)" />}
        />
        <StatCard
          label="Chunks Processados"
          value={String(stats.totalChunks)}
          icon={<ChunksIcon size={14} color="var(--crm-gold)" />}
        />
        <StatCard
          label="Consultas IA"
          value={String(stats.totalUsed)}
          icon={
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Taxa de Relevancia"
          value={stats.avgRelevance > 0 ? `${stats.avgRelevance}%` : '--'}
          icon={
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
      </div>

      {sources.length === 0 ? (
        <EmptyState onAddFirst={handleOpenAdd} />
      ) : (
        <>
          {/* ━━━ Filter/Search Bar ━━━ */}
          <div
            className="flex flex-wrap items-center gap-3 p-3 rounded-xl border"
            style={{
              background: 'var(--crm-surface)',
              borderColor: 'var(--crm-border)',
            }}
          >
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <SearchIcon size={14} color="var(--crm-text-muted)" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou tag..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none transition-colors"
                style={{
                  background: 'var(--crm-surface-2)',
                  borderColor: 'var(--crm-border)',
                  color: 'var(--crm-text)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--crm-gold)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--crm-border)' }}
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'ALL' | SourceType)}
                className="px-3 py-2 pr-8 rounded-lg text-sm border outline-none appearance-none transition-colors"
                style={{
                  background: 'var(--crm-surface-2)',
                  borderColor: 'var(--crm-border)',
                  color: 'var(--crm-text)',
                }}
              >
                <option value="ALL">Todos os tipos</option>
                <option value="TEXT">Texto</option>
                <option value="FILE">Arquivo</option>
                <option value="URL">URL</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDownIcon size={12} color="var(--crm-text-muted)" />
              </div>
            </div>

            {/* Language Filter */}
            <div className="relative">
              <select
                value={langFilter}
                onChange={(e) => setLangFilter(e.target.value as 'ALL' | SourceLang)}
                className="px-3 py-2 pr-8 rounded-lg text-sm border outline-none appearance-none transition-colors"
                style={{
                  background: 'var(--crm-surface-2)',
                  borderColor: 'var(--crm-border)',
                  color: 'var(--crm-text)',
                }}
              >
                <option value="ALL">Todos os idiomas</option>
                <option value="pt-BR">Portugues</option>
                <option value="en">English</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDownIcon size={12} color="var(--crm-text-muted)" />
              </div>
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="px-3 py-2 pr-8 rounded-lg text-sm border outline-none appearance-none transition-colors"
                style={{
                  background: 'var(--crm-surface-2)',
                  borderColor: 'var(--crm-border)',
                  color: 'var(--crm-text)',
                }}
              >
                <option value="name">Ordenar: Nome</option>
                <option value="date">Ordenar: Data</option>
                <option value="usage">Ordenar: Uso</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDownIcon size={12} color="var(--crm-text-muted)" />
              </div>
            </div>
          </div>

          {/* ━━━ Sources Table ━━━ */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: 'var(--crm-surface)',
              borderColor: 'var(--crm-border)',
            }}
          >
            {/* Table Header */}
            <div
              className="grid items-center px-4 py-3 border-b text-[11px] font-semibold uppercase tracking-wider"
              style={{
                gridTemplateColumns: '40px 1fr 72px 80px 120px 80px 120px 100px 80px 72px',
                borderColor: 'var(--crm-border)',
                color: 'var(--crm-text-muted)',
                background: 'var(--crm-surface-2)',
              }}
            >
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredSources.length && filteredSources.length > 0}
                  onChange={handleSelectAll}
                  className="w-3.5 h-3.5 rounded accent-amber-600 cursor-pointer"
                  style={{ accentColor: '#D4AF37' }}
                />
              </div>
              <div>Nome da Fonte</div>
              <div>Tipo</div>
              <div className="text-center">Subsecoes</div>
              <div>Vezes Usado</div>
              <div>Idioma</div>
              <div>Atualizado por</div>
              <div>Ultima Atualizacao</div>
              <div className="text-center">Status</div>
              <div className="text-center">Acoes</div>
            </div>

            {/* Table Body */}
            <motion.div variants={listStagger} initial="hidden" animate="visible">
              {filteredSources.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>
                    Nenhuma fonte encontrada com os filtros atuais.
                  </p>
                </div>
              ) : (
                filteredSources.map((source) => {
                  const isSelected = selectedIds.has(source.id)
                  const typeBadgeColors: Record<SourceType, { bg: string; text: string }> = {
                    TEXT: { bg: 'rgba(212,175,55,0.1)', text: '#D4AF37' },
                    FILE: { bg: 'rgba(74,123,255,0.1)', text: '#4A7BFF' },
                    URL: { bg: 'rgba(46,204,138,0.1)', text: '#2ECC8A' },
                  }
                  const badge = typeBadgeColors[source.type]
                  const usagePercent = maxUsage > 0 ? (source.timesUsed / maxUsage) * 100 : 0

                  return (
                    <motion.div
                      key={source.id}
                      variants={listItem}
                      className="grid items-center px-4 py-3 border-b transition-colors duration-150"
                      style={{
                        gridTemplateColumns: '40px 1fr 72px 80px 120px 80px 120px 100px 80px 72px',
                        borderColor: 'var(--crm-border)',
                        background: isSelected ? 'rgba(212,175,55,0.04)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--crm-surface-2)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(source.id)}
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                          style={{ accentColor: '#D4AF37' }}
                        />
                      </div>

                      {/* Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: badge.bg }}
                        >
                          <TypeIcon type={source.type} size={14} />
                        </div>
                        <button
                          onClick={() => handleOpenDrawer(source)}
                          className="text-sm font-medium truncate text-left transition-colors duration-150"
                          style={{ color: 'var(--crm-text)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--crm-gold)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--crm-text)' }}
                        >
                          {source.name}
                        </button>
                      </div>

                      {/* Type Badge */}
                      <div>
                        <span
                          className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {TYPE_LABELS[source.type]}
                        </span>
                      </div>

                      {/* Chunks count */}
                      <div className="text-center text-sm" style={{ color: 'var(--crm-text)' }}>
                        {source.chunks.length}
                      </div>

                      {/* Times Used with bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-6 text-right" style={{ color: 'var(--crm-text)' }}>
                          {source.timesUsed}
                        </span>
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--crm-surface-2)' }}
                        >
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: source.timesUsed > 0
                                ? 'linear-gradient(90deg, var(--crm-gold), #E8C547)'
                                : 'transparent',
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${usagePercent}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' as const }}
                          />
                        </div>
                      </div>

                      {/* Language */}
                      <div className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>
                        {LANG_LABELS[source.language]}
                      </div>

                      {/* Updated by */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                          style={{
                            background: source.updatedBy.name === 'Robo'
                              ? 'rgba(74,123,255,0.15)'
                              : 'var(--crm-gold-subtle)',
                            color: source.updatedBy.name === 'Robo'
                              ? '#4A7BFF'
                              : 'var(--crm-gold)',
                          }}
                        >
                          {source.updatedBy.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs truncate" style={{ color: 'var(--crm-text-muted)' }}>
                          {source.updatedBy.name}
                        </span>
                      </div>

                      {/* Last Updated */}
                      <div className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>
                        {formatDate(source.updatedAt)}
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-center">
                        <span className="flex items-center gap-1.5 text-[10px] font-medium">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: source.isActive ? '#2ECC8A' : 'var(--crm-text-muted)' }}
                          />
                          <span style={{ color: source.isActive ? '#2ECC8A' : 'var(--crm-text-muted)' }}>
                            {source.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(source) }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                          style={{ color: 'var(--crm-text-muted)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--crm-surface-2)'
                            e.currentTarget.style.color = 'var(--crm-text)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--crm-text-muted)'
                          }}
                          title="Editar"
                        >
                          <EditIcon size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(source.id) }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                          style={{ color: 'var(--crm-text-muted)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,107,74,0.1)'
                            e.currentTarget.style.color = '#FF6B4A'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--crm-text-muted)'
                          }}
                          title="Excluir"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </motion.div>
          </div>
        </>
      )}

      {/* ━━━ Bulk Actions Bar ━━━ */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-xl border"
            style={{
              background: 'rgba(17,17,20,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderColor: 'var(--crm-border)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
            variants={bulkBarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <span className="text-sm font-medium" style={{ color: 'var(--crm-text)' }}>
              {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
            </span>

            <div className="w-px h-5" style={{ background: 'var(--crm-border)' }} />

            <button
              onClick={handleBulkReprocess}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: 'var(--crm-gold)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--crm-gold-subtle)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <RefreshIcon size={12} color="var(--crm-gold)" />
              Reprocessar
            </button>

            <button
              onClick={handleBulkDeactivate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: 'var(--crm-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--crm-surface-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Desativar
            </button>

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: '#FF6B4A' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,107,74,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <TrashIcon size={12} color="#FF6B4A" />
              Excluir
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ Add/Edit Modal ━━━ */}
      <AddEditModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingSource(null) }}
        editingSource={editingSource}
        onSave={handleSave}
      />

      {/* ━━━ Source Detail Drawer ━━━ */}
      <SourceDetailDrawer
        source={drawerSource}
        onClose={() => setDrawerSource(null)}
        usageHistory={[]}
      />
    </div>
  )
}
