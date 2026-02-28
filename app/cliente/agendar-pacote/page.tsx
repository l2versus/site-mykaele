'use client'

import { useState, useCallback } from 'react'
import { useClient } from '../ClientContext'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ScheduledSession { date: string; time: string; label: string }

export default function AgendarPacotePage() {
  const { fetchWithAuth } = useClient()
  const params = useSearchParams()
  const packageId = params.get('packageId')
  const totalSessions = parseInt(params.get('sessions') || '0')
  const serviceId = params.get('serviceId')
  const serviceName = params.get('serviceName') || 'Serviço'

  const [step, setStep] = useState<'schedule' | 'confirm' | 'done'>('schedule')
  const [currentSession, setCurrentSession] = useState(0)
  const [scheduled, setScheduled] = useState<ScheduledSession[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const dates: string[] = []
  const today = new Date()
  for (let i = 1; i <= 60; i++) { const d = new Date(today); d.setDate(d.getDate() + i); dates.push(d.toISOString().split('T')[0]) }
  const scheduledDates = scheduled.map(s => s.date)

  const loadSlots = useCallback(async (d: string) => {
    if (!serviceId || !d) return
    setLoadingSlots(true); setSlots([])
    try {
      const res = await fetch(`/api/booking/availability?date=${d}&serviceId=${serviceId}`)
      if (res.ok) {
        const data = await res.json()
        const usedTimes = scheduled.filter(s => s.date === d).map(s => s.time)
        const rawSlots: { time: string; available: boolean }[] = data.slots || []
        setSlots(rawSlots.filter(s => s.available && !usedTimes.includes(s.time)).map(s => s.time))
      }
    } catch {}
    setLoadingSlots(false)
  }, [serviceId, scheduled])

  const selectDate = (d: string) => { setSelectedDate(d); setSelectedTime(''); loadSlots(d) }

  const addSession = () => {
    if (!selectedDate || !selectedTime) return
    const dt = new Date(selectedDate + 'T12:00:00')
    const label = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) + ` às ${selectedTime}`
    setScheduled([...scheduled, { date: selectedDate, time: selectedTime, label }])
    setCurrentSession(currentSession + 1)
    setSelectedDate(''); setSelectedTime(''); setSlots([])
  }

  const removeSession = (idx: number) => { setScheduled(scheduled.filter((_, i) => i !== idx)); setCurrentSession(currentSession - 1) }
  const allScheduled = scheduled.length >= totalSessions

  const submitAll = async () => {
    if (scheduled.length === 0) return
    setSubmitting(true); setError('')
    try {
      let successCount = 0
      for (const session of scheduled) {
        const scheduledAt = new Date(`${session.date}T${session.time}:00`)
        const endAt = new Date(scheduledAt.getTime() + 60 * 60000)
        const res = await fetchWithAuth('/api/patient/appointments', {
          method: 'POST',
          body: JSON.stringify({ serviceId, scheduledAt: scheduledAt.toISOString(), endAt: endAt.toISOString(), type: successCount === 0 ? 'FIRST' : 'RETURN', location: 'HOME_SPA', notes: `Pacote - sessao ${successCount + 1}/${totalSessions}`, packageId, skipWhatsApp: true }),
        })
        if (res.ok) { successCount++ } else {
          const data = await res.json()
          setError(`Sessao ${successCount + 1} falhou: ${data.error || 'Horario indisponivel'}. ${successCount} anteriores agendados.`)
          break
        }
      }
      if (successCount === scheduled.length) {
        // Envia notificacao WhatsApp consolidada com todas as sessoes
        try {
          await fetchWithAuth('/api/patient/appointments/notify-package', {
            method: 'POST',
            body: JSON.stringify({
              serviceName,
              packageName: `Pacote ${totalSessions} sessoes`,
              totalSessions,
              sessions: scheduled.map(s => ({ date: s.date, time: s.time })),
            }),
          })
        } catch { /* nao bloqueia */ }
        setStep('done')
      }
    } catch { setError('Erro ao agendar sessoes') }
    setSubmitting(false)
  }

  if (!packageId || !totalSessions || !serviceId) {
    return (
      <div className="text-center py-16 animate-[fadeIn_0.5s_ease-out]">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-white/15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <p className="text-white/25 text-sm">Protocolo não encontrado</p>
        <Link href="/cliente/pacotes" className="mt-3 inline-block text-[#d4a0a7] text-xs font-medium hover:underline">← Voltar aos protocolos</Link>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="text-center py-16 animate-[fadeIn_0.5s_ease-out]">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <svg width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 className="text-xl font-light text-white/90 tracking-tight">{scheduled.length} sessões agendadas!</h2>
        <p className="text-white/25 text-xs mt-2">Todas as sessões do protocolo foram reservadas</p>
        <div className="mt-5 relative overflow-hidden rounded-2xl max-w-sm mx-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
          <div className="relative border border-white/[0.06] rounded-2xl p-4 text-left space-y-2">
          {scheduled.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs">
              <span className="w-6 h-6 rounded-full bg-[#b76e79]/10 text-[#d4a0a7] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-white/40">{s.label}</span>
            </div>
          ))}
          </div>
        </div>
        <div className="flex gap-3 justify-center mt-6">
          <Link href="/cliente/agendamentos" className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-xs font-medium shadow-lg shadow-[#b76e79]/15">
            Ver Agenda
          </Link>
          <Link href="/cliente" className="px-5 py-2.5 rounded-2xl border border-white/[0.06] text-white/25 text-xs hover:text-white/40 hover:border-white/[0.10] transition-all">
            Início
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div>
        <Link href="/cliente/pacotes" className="text-[#d4a0a7]/50 text-[10px] font-medium mb-2 inline-block hover:text-[#d4a0a7]">← Protocolos</Link>
        <h1 className="text-xl font-light text-white/90 tracking-tight">Agendar Sessões</h1>
        <p className="text-[#c28a93]/40 text-[10px] mt-0.5 tracking-wide">{serviceName} · {totalSessions} sessões</p>
      </div>

      {/* Progress */}
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
        <div className="relative border border-white/[0.06] rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/25 text-[10px]">Sessões agendadas</span>
          <span className="text-[#d4a0a7] text-xs font-semibold">{scheduled.length}/{totalSessions}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalSessions }).map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-500 ${i < scheduled.length ? 'bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] shadow-sm shadow-[#b76e79]/15' : 'bg-white/[0.04]'}`} />
          ))}
        </div>
        </div>
      </div>

      {/* Already scheduled sessions */}
      {scheduled.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-white/15 text-[10px] font-medium uppercase tracking-wider">Reservadas</div>
          {scheduled.map((s, i) => (
            <div key={i} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-white/40 text-xs">{s.label}</span>
              </div>
              <button onClick={() => removeSession(i)} className="text-red-400/30 hover:text-red-400/60 p-1 transition-colors">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Schedule next session */}
      {!allScheduled && (
        <div className="space-y-3">
          <div className="text-white/30 text-xs font-medium">
            Sessão {scheduled.length + 1} de {totalSessions} — Escolha a data:
          </div>

          {/* Date picker */}
          <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
            {dates.map(d => {
              const dt = new Date(d + 'T12:00:00')
              const dayName = dt.toLocaleDateString('pt-BR', { weekday: 'short' })
              const dayNum = dt.getDate()
              const month = dt.toLocaleDateString('pt-BR', { month: 'short' })
              const isSunday = dt.getDay() === 0
              const isAlreadyPicked = scheduledDates.includes(d)
              return (
                <button key={d} onClick={() => selectDate(d)} disabled={isSunday}
                  className={`rounded-2xl p-2.5 text-center transition-all duration-300 border ${
                    selectedDate === d ? 'border-[#b76e79]/30 bg-[#b76e79]/8' :
                    isAlreadyPicked ? 'border-emerald-500/15 bg-emerald-500/5' :
                    'border-white/[0.05] bg-white/[0.03]'
                  } ${isSunday ? 'opacity-15 cursor-not-allowed' : 'hover:bg-white/[0.05]'}`}>
                  <div className="text-white/15 text-[9px] uppercase">{dayName}</div>
                  <div className={`font-bold text-sm ${isAlreadyPicked ? 'text-emerald-400' : 'text-white'}`}>{dayNum}</div>
                  <div className="text-white/15 text-[9px]">{month}</div>
                </button>
              )
            })}
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <div className="text-white/20 text-[10px] mb-2">
                Horários em {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}:
              </div>
              {loadingSlots ? (
                <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
              ) : slots.length === 0 ? (
                <div className="text-center py-6"><p className="text-white/15 text-xs">Nenhum horário disponível</p></div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {slots.map(t => (
                    <button key={t} onClick={() => setSelectedTime(t)}
                      className={`py-3 rounded-xl text-center text-xs font-medium transition-all duration-300 border ${
                        selectedTime === t ? 'border-[#b76e79]/30 bg-[#b76e79]/10 text-[#d4a0a7] shadow-sm shadow-[#b76e79]/10' : 'border-white/[0.05] bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add session button */}
          {selectedDate && selectedTime && (
            <button onClick={addSession}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-xs font-medium shadow-lg shadow-[#b76e79]/10 hover:shadow-[#b76e79]/25 active:scale-[0.98] transition-all">
              Reservar sessão {scheduled.length + 1}
            </button>
          )}
        </div>
      )}

      {/* Confirm all */}
      {allScheduled && step === 'schedule' && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/15">
            <div className="absolute inset-0 bg-emerald-500/[0.06]" />
            <div className="relative p-4 text-center">
            <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24" className="mx-auto mb-2"><polyline points="20 6 9 17 4 12"/></svg>
            <p className="text-emerald-400 text-xs font-medium">Todas as {totalSessions} sessões selecionadas!</p>
            </div>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/15 text-red-400 text-xs rounded-xl px-4 py-3">{error}</div>}
          <button onClick={submitAll} disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-sm font-medium shadow-lg shadow-[#b76e79]/15 hover:shadow-[#b76e79]/25 active:scale-[0.98] transition-all disabled:opacity-50">
            {submitting ? 'Agendando sessões...' : `Confirmar ${totalSessions} sessões`}
          </button>
        </div>
      )}

      {/* Option to confirm fewer sessions */}
      {scheduled.length > 0 && !allScheduled && (
        <div className="text-center pt-2">
          <button onClick={submitAll} disabled={submitting} className="text-[#d4a0a7]/40 text-[10px] hover:text-[#d4a0a7]/60 transition-colors">
            Ou agendar só as {scheduled.length} selecionadas
          </button>
        </div>
      )}
    </div>
  )
}
