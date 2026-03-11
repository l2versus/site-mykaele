'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

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

export default function DlqPage() {
  const [jobs, setJobs] = useState<DlqJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [requeueing, setRequeueing] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  const fetchJobs = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/admin/crm/system/dlq', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setJobs(data.jobs)
    } catch {
      // silently fail
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
    } catch {
      // silently fail
    } finally {
      setRequeueing(null)
    }
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6" style={{ color: '#F0EDE8' }}>Dead Letter Queue</h1>
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
          <h1 className="text-xl font-bold" style={{ color: '#F0EDE8' }}>Dead Letter Queue</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B8A94' }}>
            Jobs que falharam após todas as tentativas. {jobs.length} pendentes.
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

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-40">
          <svg width="48" height="48" fill="none" stroke="#2ECC8A" strokeWidth="1.2" viewBox="0 0 24 24">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-sm mt-3" style={{ color: '#2ECC8A' }}>Nenhum job falho</p>
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
    </div>
  )
}
