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
    online: { bg: 'rgba(46,204,138,0.1)', text: '#2ECC8A', dot: '#2ECC8A' },
    offline: { bg: 'rgba(139,138,148,0.1)', text: '#8B8A94', dot: '#8B8A94' },
    error: { bg: 'rgba(255,107,74,0.1)', text: '#FF6B4A', dot: '#FF6B4A' },
  }
  const c = colors[status]

  return (
    <div className="rounded-xl border p-4" style={{ background: '#111114', borderColor: '#2A2A32' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: '#F0EDE8' }}>{label}</span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: c.bg, color: c.text }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
          {status === 'online' ? 'Ativo' : status === 'offline' ? 'Offline' : 'Erro'}
        </span>
      </div>
      <p className="text-[11px]" style={{ color: '#8B8A94' }}>{detail}</p>
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
        <h1 className="text-xl font-bold mb-6" style={{ color: '#F0EDE8' }}>Sistema</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#111114' }} />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#111114' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0EDE8' }}>Sistema</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B8A94' }}>
            Status dos serviços e fila de erros
          </p>
        </div>
        <button
          onClick={fetchJobs}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ background: '#1A1A1F', color: '#8B8A94', border: '1px solid #2A2A32' }}
        >
          Atualizar
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatusCard
          label="Redis / Filas"
          status={redisStatus}
          detail={redisStatus === 'online'
            ? `${jobs.length} jobs na fila de erros`
            : 'Redis não configurado ou inacessível. Configure REDIS_URL no .env'
          }
        />
        <StatusCard
          label="Workers"
          status={redisStatus === 'online' ? 'online' : 'offline'}
          detail={redisStatus === 'online'
            ? 'Inbox, Automação, IA, Agendador'
            : 'Necessita Redis ativo para funcionar'
          }
        />
        <StatusCard
          label="Webhook"
          status={webhookStatus}
          detail="/api/webhooks/evolution (público)"
        />
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
    </div>
  )
}
