'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'
const POLL_INTERVAL = 10_000

// ━━━ Types ━━━

interface QueueCounts {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

interface DlqJob {
  jobId: string
  originalQueue: string
  failedReason: string
  failedAt: string
  attemptsMade: number
  payload: unknown
}

interface AutomationLog {
  id: string
  automationName: string
  status: string
  error: string | null
  executedAt: string
}

interface SystemStats {
  redis: { status: 'connected' | 'disconnected'; memoryUsedMb: number }
  queues: { inbox: QueueCounts; automation: QueueCounts; ai: QueueCounts }
  dlq: DlqJob[]
  recentLogs: AutomationLog[]
}

// ━━━ Helpers ━━━

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function queueTotal(q: QueueCounts): number {
  return q.waiting + q.active + q.completed + q.failed + q.delayed
}

// ━━━ Components ━━━

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
      style={{
        background: connected ? 'rgba(46,204,138,0.08)' : 'rgba(255,107,74,0.08)',
        color: connected ? '#2ECC8A' : '#FF6B4A',
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'animate-pulse' : ''}`}
        style={{ background: connected ? '#2ECC8A' : '#FF6B4A' }}
      />
      {connected ? 'Conectado' : 'Offline'}
    </span>
  )
}

function QueueCard({ name, label, counts }: { name: string; label: string; counts: QueueCounts }) {
  const items = [
    { key: 'waiting', label: 'Aguardando', value: counts.waiting, color: '#F0A500' },
    { key: 'active', label: 'Ativo', value: counts.active, color: '#4A7BFF' },
    { key: 'completed', label: 'Concluído', value: counts.completed, color: '#2ECC8A' },
    { key: 'failed', label: 'Falhou', value: counts.failed, color: '#FF6B4A' },
    { key: 'delayed', label: 'Agendado', value: counts.delayed, color: 'var(--crm-text-muted)' },
  ]

  return (
    <div className="rounded-xl border p-4 relative overflow-hidden"
      style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>{label}</span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}
        >
          {name}
        </span>
      </div>
      <div className="flex gap-3 flex-wrap">
        {items.map(item => (
          <div key={item.key} className="text-center min-w-[48px]">
            <p className="text-lg font-bold tabular-nums" style={{ color: item.value > 0 ? item.color : 'var(--crm-text-muted)' }}>
              {item.value}
            </p>
            <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function LogStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    SUCCESS: { bg: 'rgba(46,204,138,0.12)', color: '#2ECC8A', label: 'OK' },
    FAILED: { bg: 'rgba(255,107,74,0.12)', color: '#FF6B4A', label: 'Erro' },
    SKIPPED: { bg: 'rgba(139,138,148,0.12)', color: 'var(--crm-text-muted)', label: 'Pulou' },
  }
  const c = config[status] ?? config.SKIPPED
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

// ━━━ Skeleton ━━━

function SystemSkeleton() {
  return (
    <div>
      <div className="h-8 w-48 rounded-lg animate-pulse mb-6" style={{ background: 'var(--crm-surface)' }} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
    </div>
  )
}

// ━━━ Main Page ━━━

export default function DlqPage() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [requeueing, setRequeueing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dlq' | 'logs'>('dlq')
  const addToast = useToastStore(s => s.addToast)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  const fetchStats = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/system/stats?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setFetchError(true)
        return
      }
      const data: SystemStats = await res.json()
      setStats(data)
      setFetchError(false)
    } catch {
      setFetchError(true)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  // Initial fetch + polling every 10s
  useEffect(() => {
    fetchStats()
    pollRef.current = setInterval(fetchStats, POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStats])

  const handleRequeue = async (job: DlqJob) => {
    if (!token) return
    setRequeueing(job.jobId)
    try {
      const res = await fetch('/api/admin/crm/system/dlq/requeue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          jobId: job.jobId,
          originalQueue: job.originalQueue,
          payload: job.payload,
        }),
      })
      if (!res.ok) throw new Error()
      setStats(prev => prev ? { ...prev, dlq: prev.dlq.filter(j => j.jobId !== job.jobId) } : prev)
      addToast('Job reenfileirado com sucesso')
    } catch {
      addToast('Erro ao reenfileirar', 'error')
    } finally {
      setRequeueing(null)
    }
  }

  if (isLoading) return <SystemSkeleton />

  const redisConnected = stats?.redis.status === 'connected'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--crm-text)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
              <svg width="16" height="16" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            Sistema
          </h1>
          <p className="text-xs mt-1 ml-[42px]" style={{ color: 'var(--crm-text-muted)' }}>
            Monitorização em tempo real · Polling 10s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge connected={!!redisConnected} />
          <button
            onClick={() => { setIsLoading(true); fetchStats() }}
            className="group px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-2"
            style={{
              background: 'rgba(212,175,55,0.08)',
              color: 'var(--crm-gold)',
              border: '1px solid rgba(212,175,55,0.2)',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="transition-transform duration-300 group-hover:rotate-180">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {/* Redis offline banner */}
      {(fetchError || !redisConnected) && (
        <motion.div
          className="rounded-xl border p-4 mb-6"
          style={{ background: 'rgba(212,175,55,0.05)', borderColor: 'rgba(212,175,55,0.2)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(212,175,55,0.1)' }}
            >
              <svg width="16" height="16" fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--crm-text)' }}>
                {fetchError ? 'Erro ao conectar com a API' : 'Redis não conectado'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                {fetchError
                  ? 'Verifique se o servidor está rodando.'
                  : 'Configure REDIS_URL no .env para ativar filas, workers e automações.'}
              </p>
              {!fetchError && (
                <code className="block text-[11px] font-mono mt-2 px-3 py-1.5 rounded"
                  style={{ background: 'var(--crm-bg)', color: '#D4AF37', border: '1px solid var(--crm-border)' }}
                >
                  REDIS_URL=redis://localhost:6379
                </code>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Redis Info Card */}
      {stats && redisConnected && (
        <motion.div
          className="rounded-xl border p-4 mb-4"
          style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(46,204,138,0.08)' }}>
                <svg width="14" height="14" fill="none" stroke="#2ECC8A" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>Redis</p>
                <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                  Memória: {stats.redis.memoryUsedMb} MB
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-center">
              {[
                { label: 'Inbox', total: queueTotal(stats.queues.inbox) },
                { label: 'Automação', total: queueTotal(stats.queues.automation) },
                { label: 'IA', total: queueTotal(stats.queues.ai) },
                { label: 'DLQ', total: stats.dlq.length },
              ].map(q => (
                <div key={q.label}>
                  <p className="text-sm font-bold tabular-nums" style={{ color: q.total > 0 && q.label === 'DLQ' ? '#FF6B4A' : 'var(--crm-text)' }}>
                    {q.total}
                  </p>
                  <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>{q.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Queue Detail Cards */}
      {stats && redisConnected && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            { name: 'crm-inbox', label: 'Inbox', counts: stats.queues.inbox },
            { name: 'crm-automation', label: 'Automação', counts: stats.queues.automation },
            { name: 'crm-ai', label: 'IA', counts: stats.queues.ai },
          ].map((q, i) => (
            <motion.div key={q.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <QueueCard name={q.name} label={q.label} counts={q.counts} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs: DLQ vs Logs */}
      {stats && (
        <>
          <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--crm-surface)' }}>
            {[
              { key: 'dlq' as const, label: 'Dead Letter Queue', count: stats.dlq.length },
              { key: 'logs' as const, label: 'Logs de Execução', count: stats.recentLogs.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 py-2 px-4 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: activeTab === tab.key ? 'var(--crm-surface-2)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--crm-text)' : 'var(--crm-text-muted)',
                  boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px]"
                    style={{
                      background: tab.key === 'dlq' && tab.count > 0 ? 'rgba(255,107,74,0.15)' : 'rgba(139,138,148,0.1)',
                      color: tab.key === 'dlq' && tab.count > 0 ? '#FF6B4A' : 'var(--crm-text-muted)',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* DLQ Tab */}
            {activeTab === 'dlq' && (
              <motion.div key="dlq" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {stats.dlq.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 opacity-40">
                    <svg width="40" height="40" fill="none" stroke="#2ECC8A" strokeWidth="1.2" viewBox="0 0 24 24">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <p className="text-sm mt-3" style={{ color: '#2ECC8A' }}>Nenhum job com erro</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--crm-text-muted)' }}>Todas as filas estão saudáveis</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.dlq.map(job => (
                      <motion.div
                        key={job.jobId}
                        className="rounded-xl border p-4"
                        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(255,107,74,0.12)', color: '#FF6B4A' }}
                              >
                                {job.originalQueue}
                              </span>
                              <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                                {formatDate(job.failedAt)}
                              </span>
                              {job.attemptsMade > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(139,138,148,0.1)', color: 'var(--crm-text-muted)' }}
                                >
                                  {job.attemptsMade} tentativas
                                </span>
                              )}
                            </div>
                            <p className="text-xs truncate mb-1 font-mono" style={{ color: 'var(--crm-text)' }}>
                              {job.jobId}
                            </p>
                            <p className="text-xs leading-relaxed" style={{ color: '#FF6B4A' }}>
                              {job.failedReason.slice(0, 300)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRequeue(job)}
                            disabled={requeueing === job.jobId}
                            className="flex-shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            style={{
                              background: 'rgba(212,175,55,0.1)',
                              color: '#D4AF37',
                              border: '1px solid rgba(212,175,55,0.25)',
                            }}
                          >
                            {requeueing === job.jobId ? (
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
                                Reenfileirando
                              </span>
                            ) : 'Reenfileirar'}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <motion.div key="logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {stats.recentLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 opacity-40">
                    <svg width="40" height="40" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.2" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <p className="text-sm mt-3" style={{ color: 'var(--crm-text-muted)' }}>Nenhuma execução registrada</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--crm-text-muted)' }}>Logs aparecerão aqui quando automações forem disparadas</p>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--crm-border)' }}>
                    <div className="grid grid-cols-[1fr_80px_140px] gap-4 px-4 py-2.5"
                      style={{ background: 'var(--crm-surface)', borderBottom: '1px solid var(--crm-border)' }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Automação</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Status</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Data</span>
                    </div>
                    {stats.recentLogs.map((log, i) => (
                      <div key={log.id}
                        className="grid grid-cols-[1fr_80px_140px] gap-4 px-4 py-3 items-center transition-colors"
                        style={{
                          borderBottom: i < stats.recentLogs.length - 1 ? '1px solid var(--crm-border)' : 'none',
                          background: 'var(--crm-bg)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--crm-surface)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--crm-bg)' }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--crm-text)' }}>{log.automationName}</p>
                          {log.error && (
                            <p className="text-[10px] truncate mt-0.5" style={{ color: '#FF6B4A' }}>{log.error}</p>
                          )}
                        </div>
                        <LogStatusBadge status={log.status} />
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--crm-text-muted)' }}>
                          {formatDate(log.executedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* System Info Footer */}
      <motion.div
        className="mt-10 rounded-xl border p-5"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
            <svg width="12" height="12" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>Informações do Sistema</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-text-muted)' }}>CRM</p>
            <p className="text-sm font-mono font-semibold" style={{ color: 'var(--crm-gold)' }}>v8.0</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-text-muted)' }}>Redis</p>
            <p className="text-sm font-mono" style={{ color: redisConnected ? '#2ECC8A' : '#FF6B4A' }}>
              {redisConnected ? `${stats?.redis.memoryUsedMb ?? 0} MB` : 'Offline'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-text-muted)' }}>Workers</p>
            <p className="text-sm font-mono" style={{ color: 'var(--crm-text)' }}>
              {redisConnected ? '4 ativos' : 'Parados'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-text-muted)' }}>Polling</p>
            <p className="text-sm font-mono" style={{ color: 'var(--crm-text)' }}>10s</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
