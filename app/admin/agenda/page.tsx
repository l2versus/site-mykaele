'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAdmin } from '../AdminContext'

interface Appointment {
  id: string; scheduledAt: string; endAt: string; status: string; type: string
  price: number; travelFee: number; location: string; notes?: string; addons?: string
  user: { name: string; phone?: string; email: string }
  service: { name: string; duration: number }
}

interface ScheduleConfig {
  dayOfWeek: number; startTime: string; endTime: string; slotDuration: number
  breakStart?: string; breakEnd?: string; active: boolean
}

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const ST: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  PENDING:   { label: 'Pendente',       dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  CONFIRMED: { label: 'Confirmado',     dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  COMPLETED: { label: 'Realizado',      dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CANCELLED: { label: 'Cancelado',      dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200' },
  NO_SHOW:   { label: 'Não Compareceu', dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200' },
}

function openWhatsApp(phone: string, msg: string) {
  const clean = phone.replace(/\D/g, '')
  const num = clean.startsWith('55') ? clean : `55${clean}`
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
}

/** Gera array de slots de tempo para o dia baseado na config */
function generateSlots(config: ScheduleConfig): string[] {
  const slots: string[] = []
  const [sh, sm] = config.startTime.split(':').map(Number)
  const [eh, em] = config.endTime.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + (em || 0)

  let breakStartMin = -1, breakEndMin = -1
  if (config.breakStart && config.breakEnd) {
    const [bsh, bsm] = config.breakStart.split(':').map(Number)
    const [beh, bem] = config.breakEnd.split(':').map(Number)
    breakStartMin = bsh * 60 + (bsm || 0)
    breakEndMin = beh * 60 + (bem || 0)
  }

  for (let m = startMin; m < endMin; m += config.slotDuration) {
    if (breakStartMin >= 0 && m >= breakStartMin && m < breakEndMin) continue
    const hh = Math.floor(m / 60)
    const mm = m % 60
    slots.push(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`)
  }
  return slots
}

/** Verifica se um slot está ocupado por um agendamento */
function getSlotAppointment(slot: string, appointments: Appointment[], dateStr: string): Appointment | null {
  const [h, m] = slot.split(':').map(Number)
  const slotTime = new Date(dateStr + 'T00:00:00')
  slotTime.setHours(h, m, 0, 0)

  return appointments.find(a => {
    if (a.status === 'CANCELLED') return false
    const start = new Date(a.scheduledAt)
    const end = new Date(a.endAt)
    return slotTime >= start && slotTime < end
  }) || null
}

export default function AgendaPage() {
  const { fetchWithAuth } = useAdmin()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [schedule, setSchedule] = useState<ScheduleConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [filter, setFilter] = useState('ALL')
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, sRes] = await Promise.all([
        fetchWithAuth(`/api/admin/appointments?from=${date}&to=${date}`),
        fetchWithAuth('/api/admin/schedule'),
      ])
      if (aRes.ok) { const d = await aRes.json(); setAppointments(d.appointments || []) }
      if (sRes.ok) { const d = await sRes.json(); setSchedule(d.schedule || []) }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth, date])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id)
    try {
      const res = await fetchWithAuth('/api/admin/appointments', { method: 'PUT', body: JSON.stringify({ id, status }) })
      if (res.ok) load()
    } catch {}
    setUpdating(null)
  }

  const filtered = filter === 'ALL' ? appointments : appointments.filter(a => a.status === filter)
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()
  const todayConfig = schedule.find(s => s.dayOfWeek === dayOfWeek)

  const slots = useMemo(() => {
    if (!todayConfig || !todayConfig.active) return []
    return generateSlots(todayConfig)
  }, [todayConfig])

  const goDate = (d: number) => {
    const dt = new Date(date + 'T12:00:00')
    dt.setDate(dt.getDate() + d)
    setDate(dt.toISOString().split('T')[0])
  }

  const dayLabel = () => {
    const dt = new Date(date + 'T12:00:00')
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    if (date === today) return 'Hoje'
    if (date === tomorrow) return 'Amanhã'
    return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  }

  const stats = useMemo(() => {
    const active = appointments.filter(a => a.status !== 'CANCELLED')
    return { total: active.length, confirmed: active.filter(a => a.status === 'CONFIRMED').length, pending: active.filter(a => a.status === 'PENDING').length, revenue: active.reduce((s, a) => s + a.price, 0) }
  }, [appointments])

  // Hora atual (para indicador)
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])
  const isToday = date === new Date().toISOString().split('T')[0]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Agenda</h1>
          <p className="text-stone-400 text-sm mt-0.5">{filtered.length} atendimento(s) · {fmtCur(stats.revenue)} previsto</p>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-4">
        <button onClick={() => goDate(-1)} className="p-2.5 rounded-xl bg-white border border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 shadow-sm transition-all">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 text-center">
          <div className="text-stone-800 text-base font-semibold capitalize">{dayLabel()}</div>
          <div className="text-stone-400 text-xs">{new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
        </div>
        <button onClick={() => goDate(1)} className="p-2.5 rounded-xl bg-white border border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 shadow-sm transition-all">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-700 text-sm focus:outline-none focus:border-[#b76e79]/40 shadow-sm" />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-stone-700', bg: 'bg-white' },
          { label: 'Confirmados', value: stats.confirmed, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pendentes', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Faturamento', value: fmtCur(stats.revenue), color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3.5 border border-stone-100 shadow-sm`}>
            <div className="text-stone-400 text-[10px] font-medium uppercase tracking-wider">{s.label}</div>
            <div className={`${s.color} text-lg font-bold mt-0.5`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{ k: 'ALL', l: 'Todos' }, ...Object.entries(ST).map(([k, v]) => ({ k, l: v.label }))].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
              filter === f.k
                ? 'bg-[#b76e79] text-white shadow-[#b76e79]/20'
                : 'bg-white text-stone-400 border border-stone-200 hover:text-stone-600 hover:border-stone-300'
            }`}>
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-3 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

          {/* ═══ COLUNA 1: Grade de Horários ═══ */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-stone-400"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span className="text-stone-700 text-sm font-semibold">Grade de Horários</span>
              </div>
              {/* Legenda */}
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Livre</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Marcado</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pendente</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-stone-300" /> Indisponível</span>
              </div>
            </div>

            {!todayConfig || !todayConfig.active ? (
              <div className="text-center py-16 text-stone-400">
                <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" className="mx-auto mb-3 text-stone-300">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                <p className="text-sm font-medium">Dia não configurado</p>
                <p className="text-xs text-stone-300 mt-1">Configure os horários em Configurações → Agenda</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {slots.map(slot => {
                  const [h, m] = slot.split(':').map(Number)
                  const slotMin = h * 60 + m
                  const slotEndMin = slotMin + (todayConfig?.slotDuration || 60)
                  const isPast = isToday && slotEndMin <= nowMinutes
                  const isCurrent = isToday && nowMinutes >= slotMin && nowMinutes < slotEndMin
                  const app = getSlotAppointment(slot, appointments, date)

                  let statusColor = 'bg-emerald-400' // livre
                  let rowBg = 'hover:bg-emerald-50/50'
                  let label = 'Disponível'
                  let labelColor = 'text-emerald-600'

                  if (app) {
                    const st = ST[app.status]
                    statusColor = st?.dot || 'bg-blue-400'
                    rowBg = app.status === 'CANCELLED' ? 'bg-stone-50/50' : `${st?.bg || 'bg-blue-50'}/50`
                    label = `${app.service.name} — ${app.user.name}`
                    labelColor = st?.text || 'text-blue-700'
                  } else if (isPast) {
                    statusColor = 'bg-stone-300'
                    rowBg = 'bg-stone-50/30'
                    label = 'Encerrado'
                    labelColor = 'text-stone-400'
                  }

                  return (
                    <div key={slot}
                      className={`flex items-center gap-4 px-5 py-3 transition-all cursor-default ${rowBg} ${isCurrent ? 'ring-1 ring-inset ring-[#b76e79]/20 bg-[#b76e79]/[0.03]' : ''}`}
                      onClick={() => app && app.status !== 'CANCELLED' && setSelectedApp(app)}
                    >
                      {/* Hora */}
                      <div className={`text-sm font-mono font-semibold w-12 ${isCurrent ? 'text-[#b76e79]' : isPast ? 'text-stone-300' : 'text-stone-600'}`}>
                        {slot}
                      </div>

                      {/* Indicador de status */}
                      <div className={`w-3 h-3 rounded-full ${statusColor} ${isCurrent ? 'ring-2 ring-[#b76e79]/20 animate-pulse' : ''} shadow-sm`} />

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate block ${labelColor} ${isPast && !app ? 'line-through' : ''}`}>
                          {label}
                        </span>
                        {app && app.status !== 'CANCELLED' && (
                          <span className="text-stone-400 text-[11px]">
                            {fmtTime(app.scheduledAt)} – {fmtTime(app.endAt)} · {app.location === 'HOME_SPA' ? 'Home Spa' : 'Clínica'} · {fmtCur(app.price)}
                          </span>
                        )}
                      </div>

                      {/* Badge de status */}
                      {app && app.status !== 'CANCELLED' && (
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${ST[app.status]?.text} ${ST[app.status]?.bg} border ${ST[app.status]?.border}`}>
                          {ST[app.status]?.label}
                        </span>
                      )}

                      {/* Agora indicator */}
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-md bg-[#b76e79] text-white text-[9px] font-bold tracking-wider uppercase">
                          Agora
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ═══ COLUNA 2: Lista / Detalhes ═══ */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <span className="text-stone-700 text-sm font-semibold">
                  {selectedApp ? 'Detalhes do Agendamento' : `Agendamentos · ${filtered.length}`}
                </span>
              </div>

              {/* Detalhes de um agendamento selecionado */}
              {selectedApp ? (
                <div className="p-5 space-y-4">
                  <button onClick={() => setSelectedApp(null)} className="text-stone-400 text-xs hover:text-stone-600 flex items-center gap-1">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                    Voltar
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#b76e79]/10 flex items-center justify-center text-[#b76e79] font-bold text-sm">
                      {selectedApp.user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-stone-800 text-sm font-semibold">{selectedApp.user.name}</div>
                      <div className="text-stone-400 text-[11px]">{selectedApp.user.email}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-stone-50 rounded-xl p-3">
                      <div className="text-stone-400 text-[10px] uppercase tracking-wider font-medium">Serviço</div>
                      <div className="text-stone-700 font-semibold mt-0.5">{selectedApp.service.name}</div>
                    </div>
                    <div className="bg-stone-50 rounded-xl p-3">
                      <div className="text-stone-400 text-[10px] uppercase tracking-wider font-medium">Horário</div>
                      <div className="text-stone-700 font-semibold mt-0.5">{fmtTime(selectedApp.scheduledAt)} – {fmtTime(selectedApp.endAt)}</div>
                    </div>
                    <div className="bg-stone-50 rounded-xl p-3">
                      <div className="text-stone-400 text-[10px] uppercase tracking-wider font-medium">Valor</div>
                      <div className="text-emerald-600 font-semibold mt-0.5">{fmtCur(selectedApp.price)}</div>
                    </div>
                    <div className="bg-stone-50 rounded-xl p-3">
                      <div className="text-stone-400 text-[10px] uppercase tracking-wider font-medium">Local</div>
                      <div className="text-stone-700 font-semibold mt-0.5">{selectedApp.location === 'HOME_SPA' ? 'Home Spa' : 'Clínica'}</div>
                    </div>
                  </div>

                  {selectedApp.notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <div className="text-amber-600 text-[10px] font-bold uppercase mb-1">Observações</div>
                      <div className="text-amber-800 text-xs">{selectedApp.notes}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-2">
                    {selectedApp.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => { updateStatus(selectedApp.id, 'CONFIRMED'); setSelectedApp(null) }} disabled={updating === selectedApp.id}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 shadow-sm transition-all disabled:opacity-30">
                          ✓ Confirmar
                        </button>
                        <button onClick={() => { updateStatus(selectedApp.id, 'CANCELLED'); setSelectedApp(null) }} disabled={updating === selectedApp.id}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-30">
                          ✕ Cancelar
                        </button>
                      </div>
                    )}
                    {selectedApp.status === 'CONFIRMED' && (
                      <div className="flex gap-2">
                        <button onClick={() => { updateStatus(selectedApp.id, 'COMPLETED'); setSelectedApp(null) }} disabled={updating === selectedApp.id}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-all disabled:opacity-30">
                          ✓ Marcar Realizado
                        </button>
                        <button onClick={() => { updateStatus(selectedApp.id, 'NO_SHOW'); setSelectedApp(null) }} disabled={updating === selectedApp.id}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-all disabled:opacity-30">
                          Não Compareceu
                        </button>
                      </div>
                    )}
                    {selectedApp.user.phone && (
                      <button onClick={() => openWhatsApp(selectedApp.user.phone!, `Olá ${selectedApp.user.name.split(' ')[0]}! 🌟\n\nSobre seu agendamento de ${selectedApp.service.name} às ${fmtTime(selectedApp.scheduledAt)}.\n\nMykaele Procópio - Home Spa`)}
                        className="w-full py-2.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-stone-300">
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" className="mx-auto mb-2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <p className="text-xs">Nenhum agendamento</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-50">
                  {filtered.map(a => {
                    const st = ST[a.status] || ST.PENDING
                    return (
                      <div key={a.id}
                        className="px-5 py-3.5 hover:bg-stone-50/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedApp(a)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-stone-700 text-sm font-bold font-mono">{fmtTime(a.scheduledAt)}</span>
                            <span className="text-stone-300">–</span>
                            <span className="text-stone-400 text-xs font-mono">{fmtTime(a.endAt)}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${st.text} ${st.bg} border ${st.border}`}>
                            {st.label}
                          </span>
                        </div>
                        <div className="text-stone-700 text-xs font-semibold">{a.service.name}</div>
                        <div className="text-stone-400 text-[11px] mt-0.5">{a.user.name} · {fmtCur(a.price)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
