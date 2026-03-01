'use client'

import { useState, useEffect } from 'react'
import { useClient } from '../ClientContext'
import Link from 'next/link'
import { SkeletonAppointment } from '@/components/Skeleton'

interface Appointment {
  id: string; scheduledAt: string; endAt: string; status: string
  type: string; location: string; price: number; service: { name: string; duration: number }
}

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
  COMPLETED: { label: 'Realizado', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20', dot: 'bg-blue-400' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-red-500/15 text-red-400 border-red-500/20', dot: 'bg-red-400' },
  NO_SHOW: { label: 'Faltou', cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20', dot: 'bg-zinc-400' },
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function AgendamentosPage() {
  const { fetchWithAuth } = useClient()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)

  const cancelAppointment = async (id: string) => {
    setCancellingId(id)
    try {
      const res = await fetchWithAuth('/api/patient/appointments', {
        method: 'PATCH',
        body: JSON.stringify({ appointmentId: id, action: 'cancel' }),
      })
      if (res.ok) {
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' } : a))
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao cancelar')
      }
    } catch { alert('Erro ao cancelar') }
    setCancellingId(null)
    setCancelConfirm(null)
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/api/patient/appointments')
        if (res.ok) { const data = await res.json(); setAppointments(data.appointments || data || []) }
      } catch { /* */ }
      setLoading(false)
    })()
  }, [fetchWithAuth])

  const now = new Date()
  const upcoming = appointments.filter(a => ['PENDING', 'CONFIRMED'].includes(a.status) && new Date(a.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  const history = appointments.filter(a => !['PENDING', 'CONFIRMED'].includes(a.status) || new Date(a.scheduledAt) <= now)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
  const list = tab === 'upcoming' ? upcoming : history

  return (
    <div className="space-y-5 animate-[fadeIn_0.6s_ease-out]">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-light text-white/90 tracking-tight">Minha Agenda</h1>
        <Link href="/cliente/agendar" className="text-[10px] px-4 py-2 rounded-2xl bg-gradient-to-r from-[#b76e79]/20 to-[#d4a0a7]/10 border border-[#b76e79]/15 text-[#d4a0a7]/80 font-medium hover:border-[#b76e79]/30 hover:text-[#d4a0a7] transition-all">
          + Nova Sessao
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/[0.03] border border-white/[0.05] rounded-2xl p-1">
        <button onClick={() => setTab('upcoming')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${tab === 'upcoming' ? 'bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/15' : 'text-white/25 hover:text-white/40'}`}>
          Proximos ({upcoming.length})
        </button>
        <button onClick={() => setTab('history')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${tab === 'history' ? 'bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/15' : 'text-white/25 hover:text-white/40'}`}>
          Historico ({history.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonAppointment />
          <SkeletonAppointment />
          <SkeletonAppointment />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-white/15"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <p className="text-white/25 text-sm">{tab === 'upcoming' ? 'Nenhum agendamento próximo' : 'Nenhum histórico'}</p>
          {tab === 'upcoming' && (
            <Link href="/cliente/agendar" className="text-[#d4a0a7] text-xs mt-2 inline-block hover:underline">Agendar sessão</Link>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((apt) => {
            const st = STATUS_MAP[apt.status] || STATUS_MAP.PENDING
            return (
              <div key={apt.id} className="relative overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" />
                <div className="relative border border-white/[0.05] rounded-2xl p-4 hover:border-white/[0.08] transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      <div className="text-white font-medium text-sm">{apt.service.name}</div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-white/30 text-[11px]">
                      <span className="flex items-center gap-1">
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {fmtDate(apt.scheduledAt)}
                      </span>
                      <span>{fmtTime(apt.scheduledAt)}</span>
                      <span>{apt.service.duration}min</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-white/15 text-[10px]">
                      <span>{apt.type === 'FIRST' ? 'Avaliação' : 'Sessão'}</span>
                      <span>·</span>
                      <span>{apt.location === 'CLINIC' ? 'Clínica' : 'Home Spa'}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1.5">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border ${st.cls}`}>{st.label}</span>
                    <span className="text-[#d4a0a7]/50 text-xs font-medium">{fmtCur(apt.price)}</span>
                  </div>
                </div>

                {/* Cancel button */}
                {['PENDING', 'CONFIRMED'].includes(apt.status) && new Date(apt.scheduledAt) > now && (
                  cancelConfirm === apt.id ? (
                    <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                      <span className="text-white/30 text-[11px]">Confirma o cancelamento?</span>
                      <div className="flex gap-2">
                        <button onClick={() => setCancelConfirm(null)}
                          className="px-3 py-1.5 rounded-lg text-[10px] border border-white/[0.06] text-white/30 hover:text-white/50 transition-all">
                          Não
                        </button>
                        <button onClick={() => cancelAppointment(apt.id)} disabled={cancellingId === apt.id}
                          className="px-3 py-1.5 rounded-lg text-[10px] bg-red-500/15 border border-red-500/20 text-red-400 font-medium hover:bg-red-500/25 transition-all disabled:opacity-50">
                          {cancellingId === apt.id ? 'Cancelando...' : 'Sim, cancelar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-white/[0.04] flex justify-end">
                      <button onClick={() => setCancelConfirm(apt.id)}
                        className="text-[10px] text-white/15 hover:text-red-400/60 transition-colors">
                        Cancelar sessão
                      </button>
                    </div>
                  )
                )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
