'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

// ━━━ Types ━━━

interface NpsConfig {
  id: string
  isActive: boolean
  triggerType: string
  triggerStageId: string | null
  templateMessage: string
  thankYouPromoter: string
  thankYouNeutral: string
  thankYouDetractor: string
  cooldownDays: number
}

interface NpsResponse {
  id: string
  leadId: string
  leadName: string
  score: number
  category: string
  feedback: string | null
  triggeredBy: string | null
  sentAt: string
  respondedAt: string | null
  createdAt: string
}

interface NpsMetrics {
  npsScore: number | null
  total: number
  promoter: number
  neutral: number
  detractor: number
}

interface MonthlyTrend {
  month: string
  nps: number
  total: number
}

// ━━━ Helpers ━━━

const CATEGORY_LABELS: Record<string, string> = {
  promoter: 'Promotor',
  neutral: 'Neutro',
  detractor: 'Detrator',
  pending: 'Pendente',
}

const CATEGORY_COLORS: Record<string, string> = {
  promoter: '#2ECC8A',
  neutral: '#F0A500',
  detractor: '#FF6B4A',
  pending: '#8B8A94',
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Envio manual',
  conversation_closed: 'Conversa fechada',
  stage_changed: 'Mudança de estágio',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem('admin_token')
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Erro ${res.status}` }))
    throw new Error(body.error || `Erro ${res.status}`)
  }
  return res.json()
}

// ━━━ Main Component ━━━

export default function NpsPage() {
  const [config, setConfig] = useState<NpsConfig | null>(null)
  const [responses, setResponses] = useState<NpsResponse[]>([])
  const [metrics, setMetrics] = useState<NpsMetrics | null>(null)
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'dashboard' | 'config' | 'responses'>('dashboard')
  const [showSendModal, setShowSendModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch(`/api/admin/crm/nps?tenantId=${TENANT_ID}&page=${page}`)
      setConfig(data.config)
      setResponses(data.responses || [])
      setMetrics(data.metrics)
      setMonthlyTrend(data.monthlyTrend || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  const updateConfig = async (updates: Partial<NpsConfig>) => {
    try {
      const data = await apiFetch('/api/admin/crm/nps', {
        method: 'POST',
        body: JSON.stringify({ tenantId: TENANT_ID, action: 'updateConfig', ...updates }),
      })
      setConfig(data.config)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar config')
    }
  }

  const deleteResponse = async (id: string) => {
    if (!confirm('Excluir esta resposta NPS?')) return
    try {
      await apiFetch(`/api/admin/crm/nps?id=${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  if (loading && !config) return <NpsSkeleton />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2.5" style={{ color: 'var(--crm-text)' }}>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--crm-gold-subtle)' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-gold)' }}>
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </span>
            NPS — Satisfação
          </h1>
          <p className="text-xs mt-0.5 ml-[42px]" style={{ color: 'var(--crm-text-muted)' }}>
            Net Promoter Score — Pesquisa de satisfação via WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Registrar Resposta
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
            style={{ background: 'var(--crm-gold)', color: '#0A0A0B' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            Enviar NPS
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--crm-surface)' }}>
        {(['dashboard', 'responses', 'config'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              background: tab === t ? 'var(--crm-surface-2)' : 'transparent',
              color: tab === t ? 'var(--crm-text)' : 'var(--crm-text-muted)',
            }}
          >
            {t === 'dashboard' ? 'Dashboard' : t === 'responses' ? 'Respostas' : 'Configuração'}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <NpsDashboard metrics={metrics} monthlyTrend={monthlyTrend} />}
      {tab === 'responses' && (
        <NpsResponses
          responses={responses}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onDelete={deleteResponse}
        />
      )}
      {tab === 'config' && config && <NpsConfigPanel config={config} onSave={updateConfig} />}

      {/* Send Modal */}
      <AnimatePresence>
        {showSendModal && (
          <SendNpsModal onClose={() => setShowSendModal(false)} onSent={fetchData} />
        )}
        {showManualModal && (
          <ManualNpsModal onClose={() => setShowManualModal(false)} onAdded={fetchData} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ━━━ Dashboard ━━━

function NpsDashboard({ metrics, monthlyTrend }: { metrics: NpsMetrics | null; monthlyTrend: MonthlyTrend[] }) {
  if (!metrics || metrics.total === 0) {
    return (
      <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--crm-gold-subtle)' }}>
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-gold)' }}>
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        </div>
        <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--crm-text)' }}>Nenhuma pesquisa ainda</h3>
        <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Envie sua primeira pesquisa NPS via WhatsApp para começar a medir satisfação</p>
      </div>
    )
  }

  const npsColor = (metrics.npsScore ?? 0) >= 50 ? '#2ECC8A' : (metrics.npsScore ?? 0) >= 0 ? '#F0A500' : '#FF6B4A'

  return (
    <div className="space-y-4">
      {/* Main NPS Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="md:col-span-1 rounded-xl border p-5 text-center"
          style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>NPS Score</p>
          <p className="text-4xl font-bold" style={{ color: npsColor }}>
            {metrics.npsScore ?? '—'}
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
            {(metrics.npsScore ?? 0) >= 70 ? 'Excelente' : (metrics.npsScore ?? 0) >= 50 ? 'Ótimo' : (metrics.npsScore ?? 0) >= 0 ? 'Bom' : 'Precisa melhorar'}
          </p>
        </motion.div>

        {/* Distribution */}
        {[
          { label: 'Promotores (9-10)', count: metrics.promoter, color: '#2ECC8A', pct: metrics.total > 0 ? Math.round(metrics.promoter / metrics.total * 100) : 0 },
          { label: 'Neutros (7-8)', count: metrics.neutral, color: '#F0A500', pct: metrics.total > 0 ? Math.round(metrics.neutral / metrics.total * 100) : 0 },
          { label: 'Detratores (0-6)', count: metrics.detractor, color: '#FF6B4A', pct: metrics.total > 0 ? Math.round(metrics.detractor / metrics.total * 100) : 0 },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl border p-4"
            style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>{item.label}</p>
              <span className="text-xs font-bold" style={{ color: item.color }}>{item.pct}%</span>
            </div>
            <p className="text-2xl font-bold mb-2" style={{ color: item.color }}>{item.count}</p>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--crm-surface-2)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.pct}%`, background: item.color }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Monthly Trend */}
      {monthlyTrend.length > 1 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--crm-text-muted)' }}>
            Evolução do NPS
          </p>
          <div className="flex items-end gap-2 h-24">
            {monthlyTrend.map((m, i) => {
              const barHeight = Math.max(10, Math.abs(m.nps) + 10)
              const barColor = m.nps >= 50 ? '#2ECC8A' : m.nps >= 0 ? '#F0A500' : '#FF6B4A'
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono" style={{ color: barColor }}>{m.nps}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: barHeight }}
                    transition={{ delay: i * 0.1 }}
                    className="w-full rounded-t-md"
                    style={{ background: barColor, maxHeight: '80px' }}
                  />
                  <span className="text-[8px]" style={{ color: 'var(--crm-text-muted)' }}>
                    {m.month.split('-')[1]}/{m.month.split('-')[0].slice(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Total */}
      <div className="text-center">
        <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
          Total de respostas: {metrics.total}
        </p>
      </div>
    </div>
  )
}

// ━━━ Responses List ━━━

function NpsResponses({
  responses, page, totalPages, onPageChange, onDelete,
}: {
  responses: NpsResponse[]
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  onDelete: (id: string) => void
}) {
  if (responses.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Nenhuma resposta ainda</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {responses.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="rounded-xl border p-4"
          style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                style={{
                  background: `${CATEGORY_COLORS[r.category] || '#8B8A94'}15`,
                  color: CATEGORY_COLORS[r.category] || '#8B8A94',
                }}
              >
                {r.score >= 0 ? r.score : '?'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--crm-text)' }}>{r.leadName}</p>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0"
                    style={{
                      background: `${CATEGORY_COLORS[r.category] || '#8B8A94'}15`,
                      color: CATEGORY_COLORS[r.category] || '#8B8A94',
                    }}
                  >
                    {CATEGORY_LABELS[r.category] || r.category}
                  </span>
                </div>
                {r.feedback && (
                  <p className="text-[11px] mb-1" style={{ color: 'var(--crm-text-muted)' }}>"{r.feedback}"</p>
                )}
                <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                  <span>{formatDate(r.createdAt)}</span>
                  {r.triggeredBy && <span>{r.triggeredBy === 'manual' ? 'Manual' : r.triggeredBy}</span>}
                  {r.respondedAt && <span>Respondeu: {formatDate(r.respondedAt)}</span>}
                </div>
              </div>
            </div>
            <button
              onClick={() => onDelete(r.id)}
              className="p-1.5 rounded-lg transition-all hover:scale-105 shrink-0"
              style={{ background: '#FF6B4A10', color: '#FF6B4A' }}
              title="Excluir"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          </div>
        </motion.div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-30 transition-all"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
          >
            Anterior
          </button>
          <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>{page} / {totalPages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-30 transition-all"
            style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  )
}

// ━━━ Config Panel ━━━

function NpsConfigPanel({ config, onSave }: { config: NpsConfig; onSave: (u: Partial<NpsConfig>) => void }) {
  const [isActive, setIsActive] = useState(config.isActive)
  const [triggerType, setTriggerType] = useState(config.triggerType)
  const [templateMessage, setTemplateMessage] = useState(config.templateMessage)
  const [thankYouPromoter, setThankYouPromoter] = useState(config.thankYouPromoter)
  const [thankYouNeutral, setThankYouNeutral] = useState(config.thankYouNeutral)
  const [thankYouDetractor, setThankYouDetractor] = useState(config.thankYouDetractor)
  const [cooldownDays, setCooldownDays] = useState(config.cooldownDays)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      isActive, triggerType, templateMessage,
      thankYouPromoter, thankYouNeutral, thankYouDetractor,
      cooldownDays,
    })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="rounded-xl border p-4 flex items-center justify-between" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--crm-text)' }}>NPS Ativo</p>
          <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Ativar envio automático de pesquisas</p>
        </div>
        <button
          onClick={() => setIsActive(!isActive)}
          className="w-11 h-6 rounded-full transition-all relative"
          style={{ background: isActive ? 'var(--crm-gold)' : 'var(--crm-surface-2)' }}
        >
          <div
            className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
            style={{ left: isActive ? '24px' : '4px' }}
          />
        </button>
      </div>

      {/* Trigger */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>
          Gatilho automático
        </label>
        <select
          value={triggerType}
          onChange={e => setTriggerType(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
          style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
        >
          {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Cooldown */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>
          Cooldown (dias entre pesquisas)
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={cooldownDays}
          onChange={e => setCooldownDays(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
          style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
        />
        <p className="text-[9px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
          Não envia NPS para o mesmo lead dentro deste período
        </p>
      </div>

      {/* Template Message */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
        <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>
          Mensagem de pesquisa
        </label>
        <textarea
          value={templateMessage}
          onChange={e => setTemplateMessage(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-xs resize-none focus:outline-none leading-relaxed"
          style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
        />
        <p className="text-[9px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>Use {'{{nome}}'} e {'{{primeiro_nome}}'} como variáveis</p>
      </div>

      {/* Thank you messages */}
      {[
        { label: 'Resposta para Promotores (9-10)', value: thankYouPromoter, onChange: setThankYouPromoter, color: '#2ECC8A' },
        { label: 'Resposta para Neutros (7-8)', value: thankYouNeutral, onChange: setThankYouNeutral, color: '#F0A500' },
        { label: 'Resposta para Detratores (0-6)', value: thankYouDetractor, onChange: setThankYouDetractor, color: '#FF6B4A' },
      ].map(item => (
        <div key={item.label} className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: item.color }}>
            {item.label}
          </label>
          <textarea
            value={item.value}
            onChange={e => item.onChange(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-xs resize-none focus:outline-none leading-relaxed"
            style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
          />
        </div>
      ))}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, var(--crm-gold), #C4A030)', color: '#0A0A0B' }}
      >
        {saving ? 'Salvando...' : 'Salvar Configuração'}
      </button>
    </div>
  )
}

// ━━━ Send NPS Modal ━━━

function SendNpsModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [leadSearch, setLeadSearch] = useState('')
  const [leads, setLeads] = useState<Array<{ id: string; name: string; phone: string }>>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const searchLeads = useCallback(async () => {
    if (leadSearch.length < 2) { setLeads([]); return }
    setLoadingLeads(true)
    try {
      const data = await apiFetch(`/api/admin/crm/nps?tenantId=${TENANT_ID}&searchLeads=${encodeURIComponent(leadSearch)}`)
      setLeads((data.leads || []).filter((l: { phone: string }) => l.phone))
    } catch {
      setLeads([])
    }
    setLoadingLeads(false)
  }, [leadSearch])

  useEffect(() => {
    const timer = setTimeout(searchLeads, 400)
    return () => clearTimeout(timer)
  }, [searchLeads])

  const sendNps = async (leadId: string) => {
    setSending(leadId)
    setError(null)
    try {
      await apiFetch('/api/admin/crm/nps', {
        method: 'POST',
        body: JSON.stringify({ tenantId: TENANT_ID, action: 'sendNps', leadId }),
      })
      setSentIds(prev => new Set(prev).add(leadId))
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar')
    } finally {
      setSending(null)
    }
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border overflow-hidden"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--crm-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Enviar NPS via WhatsApp</h3>
          <button onClick={onClose} style={{ color: 'var(--crm-text-muted)' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <input
            type="text"
            value={leadSearch}
            onChange={e => setLeadSearch(e.target.value)}
            placeholder="Buscar lead por nome ou telefone..."
            className="w-full px-3.5 py-2.5 rounded-lg text-xs focus:outline-none"
            style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
            autoFocus
          />

          {error && (
            <p className="text-[11px] px-3 py-2 rounded-lg" style={{ background: '#FF6B4A15', color: '#FF6B4A' }}>{error}</p>
          )}

          {loadingLeads && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--crm-gold)', borderTopColor: 'transparent' }} />
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {leads.map(lead => (
              <div
                key={lead.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--crm-surface-2)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}>
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] truncate" style={{ color: 'var(--crm-text)' }}>{lead.name}</p>
                    <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>{lead.phone}</p>
                  </div>
                </div>
                {sentIds.has(lead.id) ? (
                  <span className="text-[10px] font-medium" style={{ color: '#2ECC8A' }}>Enviado</span>
                ) : (
                  <button
                    onClick={() => sendNps(lead.id)}
                    disabled={sending === lead.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50"
                    style={{ background: 'var(--crm-gold)', color: '#0A0A0B' }}
                  >
                    {sending === lead.id ? '...' : 'Enviar'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {leadSearch.length > 0 && leads.length === 0 && !loadingLeads && (
            <p className="text-center text-[11px] py-3" style={{ color: 'var(--crm-text-muted)' }}>
              Nenhum lead encontrado
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ━━━ Manual NPS Modal ━━━

function ManualNpsModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [leadSearch, setLeadSearch] = useState('')
  const [leads, setLeads] = useState<Array<{ id: string; name: string; phone: string }>>([])
  const [selectedLead, setSelectedLead] = useState<{ id: string; name: string } | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchLeads = useCallback(async () => {
    if (leadSearch.length < 2) { setLeads([]); return }
    try {
      const data = await apiFetch(`/api/admin/crm/nps?tenantId=${TENANT_ID}&searchLeads=${encodeURIComponent(leadSearch)}`)
      setLeads((data.leads || []).slice(0, 10))
    } catch {
      setLeads([])
    }
  }, [leadSearch])

  useEffect(() => {
    const timer = setTimeout(searchLeads, 400)
    return () => clearTimeout(timer)
  }, [searchLeads])

  const handleSubmit = async () => {
    if (!selectedLead || score === null) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch('/api/admin/crm/nps', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: TENANT_ID,
          action: 'addManual',
          leadId: selectedLead.id,
          score,
          feedback: feedback || undefined,
        }),
      })
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar')
    } finally {
      setSaving(false)
    }
  }

  const scoreCategory = score !== null ? (score >= 9 ? 'promoter' : score >= 7 ? 'neutral' : 'detractor') : null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border overflow-hidden"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--crm-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>Registrar Resposta NPS</h3>
          <button onClick={onClose} style={{ color: 'var(--crm-text-muted)' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Lead search */}
          {!selectedLead ? (
            <>
              <input
                type="text"
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                placeholder="Buscar lead..."
                className="w-full px-3.5 py-2.5 rounded-lg text-xs focus:outline-none"
                style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
                autoFocus
              />
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {leads.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLead({ id: l.id, name: l.name })}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all"
                    style={{ background: 'var(--crm-surface-2)' }}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}>
                      {l.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[11px] truncate" style={{ color: 'var(--crm-text)' }}>{l.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--crm-surface-2)' }}>
                <span className="text-xs" style={{ color: 'var(--crm-text)' }}>{selectedLead.name}</span>
                <button onClick={() => setSelectedLead(null)} className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Trocar</button>
              </div>

              {/* Score selector */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>Nota (0-10)</label>
                <div className="flex gap-1.5">
                  {Array.from({ length: 11 }, (_, i) => {
                    const cat = i >= 9 ? 'promoter' : i >= 7 ? 'neutral' : 'detractor'
                    const isSelected = score === i
                    return (
                      <button
                        key={i}
                        onClick={() => setScore(i)}
                        className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: isSelected ? CATEGORY_COLORS[cat] : 'var(--crm-surface-2)',
                          color: isSelected ? '#0A0A0B' : 'var(--crm-text-muted)',
                          border: `1px solid ${isSelected ? CATEGORY_COLORS[cat] : 'var(--crm-border)'}`,
                        }}
                      >
                        {i}
                      </button>
                    )
                  })}
                </div>
                {scoreCategory && (
                  <p className="text-[10px] mt-1.5" style={{ color: CATEGORY_COLORS[scoreCategory] }}>
                    {CATEGORY_LABELS[scoreCategory]}
                  </p>
                )}
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>Feedback (opcional)</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={2}
                  placeholder="Comentário do cliente..."
                  className="w-full px-3 py-2 rounded-lg text-xs resize-none focus:outline-none"
                  style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)', color: 'var(--crm-text)' }}
                />
              </div>

              {error && (
                <p className="text-[11px] px-3 py-2 rounded-lg" style={{ background: '#FF6B4A15', color: '#FF6B4A' }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving || score === null}
                className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
                style={{ background: 'var(--crm-gold)', color: '#0A0A0B' }}
              >
                {saving ? 'Salvando...' : 'Registrar Resposta'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ━━━ Skeleton ━━━

function NpsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--crm-surface-2)' }} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border p-5 animate-pulse" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
            <div className="h-3 w-16 rounded mb-3" style={{ background: 'var(--crm-surface-2)' }} />
            <div className="h-8 w-12 rounded mb-2" style={{ background: 'var(--crm-surface-2)' }} />
            <div className="h-1.5 w-full rounded" style={{ background: 'var(--crm-surface-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
