'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'

interface DlqJob {
  id: string
  name: string
  data: {
    originalQueue: string
    jobId: string
    reason: string
    payload: unknown
    failedAt: string
  }
  timestamp: number
}

type SystemStatus = 'online' | 'offline' | 'error'

function StatusCard({ label, status, detail }: { label: string; status: SystemStatus; detail: string }) {
  const colors: Record<SystemStatus, { bg: string; text: string; dot: string }> = {
    online: { bg: 'rgba(46,204,138,0.08)', text: '#2ECC8A', dot: '#2ECC8A' },
    offline: { bg: 'rgba(139,138,148,0.08)', text: '#8B8A94', dot: '#8B8A94' },
    error: { bg: 'rgba(255,107,74,0.08)', text: '#FF6B4A', dot: '#FF6B4A' },
  }
  const c = colors[status]

  return (
    <div className="rounded-xl border p-4 relative overflow-hidden" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{ background: `radial-gradient(circle at 80% 20%, ${c.text}, transparent 60%)` }} />
      <div className="flex items-center justify-between mb-2 relative z-10">
        <span className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>{label}</span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: c.bg, color: c.text }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'animate-pulse' : ''}`} style={{ background: c.dot }} />
          {status === 'online' ? 'Ativo' : status === 'offline' ? 'Offline' : 'Erro'}
        </span>
      </div>
      <p className="text-[11px] relative z-10" style={{ color: 'var(--crm-text-muted)' }}>{detail}</p>
    </div>
  )
}

export default function DlqPage() {
  const [jobs, setJobs] = useState<DlqJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [requeueing, setRequeueing] = useState<string | null>(null)
  const addToast = useToastStore(s => s.addToast)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  const fetchJobs = useCallback(async () => {
    if (!token) return
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/crm/system/dlq', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setFetchError(true)
        return
      }
      const data = await res.json()
      setJobs(data.jobs ?? [])
      setFetchError(false)
    } catch {
      setFetchError(true)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const handleRequeue = async (jobId: string, originalQueue: string, payload: unknown) => {
    if (!token) return
    setRequeueing(jobId)
    try {
      await fetch('/api/admin/crm/system/dlq/requeue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId, originalQueue, payload }),
      })
      setJobs(prev => prev.filter(j => j.id !== jobId))
      addToast('Job reenfileirado')
    } catch {
      addToast('Erro ao reenfileirar', 'error')
    } finally {
      setRequeueing(null)
    }
  }

  // Determine system status based on fetch result
  const redisStatus: SystemStatus = fetchError ? 'offline' : 'online'
  const webhookStatus: SystemStatus = 'online' // webhook always active (stateless)

  if (isLoading) {
    return (
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5 mb-6" style={{ color: 'var(--crm-text)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
            <svg width="16" height="16" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          Sistema
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
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
            Status dos serviços e fila de erros
          </p>
        </div>
        <button
          onClick={fetchJobs}
          className="group px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-2"
          style={{
            background: 'rgba(212,175,55,0.08)',
            color: 'var(--crm-gold)',
            border: '1px solid rgba(212,175,55,0.2)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(212,175,55,0.15)'
            e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(212,175,55,0.08)'
            e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="transition-transform duration-300 group-hover:rotate-180">
            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          {
            label: 'Redis / Filas',
            status: redisStatus,
            detail: redisStatus === 'online'
              ? `${jobs.length} jobs na fila de erros`
              : 'Redis não configurado ou inacessível. Configure REDIS_URL no .env',
          },
          {
            label: 'Workers',
            status: (redisStatus === 'online' ? 'online' : 'offline') as SystemStatus,
            detail: redisStatus === 'online'
              ? 'Inbox, Automação, IA, Agendador'
              : 'Necessita Redis ativo para funcionar',
          },
          {
            label: 'Webhook',
            status: webhookStatus,
            detail: '/api/webhooks/evolution (público)',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <StatusCard label={card.label} status={card.status} detail={card.detail} />
          </motion.div>
        ))}
      </div>

      {/* Redis offline banner */}
      {fetchError && (
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
              <p className="text-sm font-medium" style={{ color: '#F0EDE8' }}>
                Sistema de filas não configurado
              </p>
              <p className="text-xs mt-1" style={{ color: '#8B8A94' }}>
                Configure o Redis nas variáveis de ambiente para ativar processamento em tempo real,
                workers de IA e automações. O CRM funciona normalmente sem Redis — apenas as filas
                assíncronas ficam desativadas.
              </p>
              <code className="block text-[11px] font-mono mt-2 px-3 py-1.5 rounded"
                style={{ background: '#0A0A0B', color: '#D4AF37', border: '1px solid #2A2A32' }}
              >
                REDIS_URL=redis://localhost:6379
              </code>
            </div>
          </div>
        </motion.div>
      )}

      {/* DLQ Jobs */}
      {!fetchError && (
        <>
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#F0EDE8' }}>
            Dead Letter Queue
            <span className="text-[10px] font-normal ml-2" style={{ color: '#8B8A94' }}>
              {jobs.length} pendentes
            </span>
          </h2>

          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <svg width="40" height="40" fill="none" stroke="#2ECC8A" strokeWidth="1.2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-sm mt-3" style={{ color: '#2ECC8A' }}>Nenhum job com erro</p>
              <p className="text-xs mt-1" style={{ color: '#8B8A94' }}>Todas as filas estão saudáveis</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => (
                <motion.div
                  key={job.id}
                  className="rounded-xl border p-4"
                  style={{ background: '#111114', borderColor: '#2A2A32' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(255,107,74,0.15)', color: '#FF6B4A' }}
                        >
                          {job.data.originalQueue}
                        </span>
                        <span className="text-[10px]" style={{ color: '#8B8A94' }}>
                          {new Date(job.data.failedAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs truncate mb-1" style={{ color: '#F0EDE8' }}>
                        Job: {job.data.jobId}
                      </p>
                      <p className="text-xs" style={{ color: '#FF6B4A' }}>
                        {job.data.reason.slice(0, 200)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRequeue(job.id, job.data.originalQueue, job.data.payload)}
                      disabled={requeueing === job.id}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                      style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
                    >
                      {requeueing === job.id ? 'Reenfileirando...' : 'Reenfileirar'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Version / Info */}
      <motion.div
        className="mt-10 rounded-xl border p-5"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
            <svg width="12" height="12" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>Informações do Sistema</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-text-muted)' }}>Versão do CRM</p>
            <p className="text-sm font-mono font-semibold" style={{ color: 'var(--crm-gold)' }}>v8.0</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-text-muted)' }}>Ambiente</p>
            <p className="text-sm font-mono" style={{ color: 'var(--crm-text)' }}>
              {process.env.NODE_ENV === 'production' ? 'Produção' : 'Desenvolvimento'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-text-muted)' }}>Stack</p>
            <p className="text-sm font-mono" style={{ color: 'var(--crm-text)' }}>Next.js + Prisma + BullMQ</p>
          </div>
        </div>
        <div className="mt-4 pt-3 flex flex-wrap gap-3" style={{ borderTop: '1px solid var(--crm-border)' }}>
          <a
            href="https://github.com/l2versus/site-mykaele"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--crm-text-muted)', background: 'rgba(139,138,148,0.06)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--crm-gold)'; e.currentTarget.style.background = 'rgba(212,175,55,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--crm-text-muted)'; e.currentTarget.style.background = 'rgba(139,138,148,0.06)' }}
          >
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            Repositório
          </a>
          <a
            href="/admin/crm/pipeline"
            className="text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--crm-text-muted)', background: 'rgba(139,138,148,0.06)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--crm-gold)'; e.currentTarget.style.background = 'rgba(212,175,55,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--crm-text-muted)'; e.currentTarget.style.background = 'rgba(139,138,148,0.06)' }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            Pipeline CRM
          </a>
          <a
            href="/admin/crm/integrations"
            className="text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--crm-text-muted)', background: 'rgba(139,138,148,0.06)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--crm-gold)'; e.currentTarget.style.background = 'rgba(212,175,55,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--crm-text-muted)'; e.currentTarget.style.background = 'rgba(139,138,148,0.06)' }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            Integrações
          </a>
        </div>
      </motion.div>
    </div>
  )
}
