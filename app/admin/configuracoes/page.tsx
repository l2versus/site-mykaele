'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../AdminContext'

interface Schedule { id: string; dayOfWeek: number; startTime: string; endTime: string; slotDuration: number; breakStart?: string; breakEnd?: string; active: boolean }
interface BlockedDate { id: string; date: string; reason?: string }

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function ConfiguracoesPage() {
  const { fetchWithAuth } = useAdmin()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [blocked, setBlocked] = useState<BlockedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [editDay, setEditDay] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Schedule>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newBlock, setNewBlock] = useState({ date: '', reason: '' })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    try {
      const [sRes, bRes] = await Promise.all([
        fetchWithAuth('/api/admin/schedule'),
        fetchWithAuth('/api/admin/blocked-dates'),
      ])
      if (sRes.ok) { const d = await sRes.json(); setSchedules(d.schedule || d || []) }
      if (bRes.ok) { const d = await bRes.json(); setBlocked(d.blockedDates || d || []) }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  const startEdit = (idx: number) => {
    const sched = schedules.find(s => s.dayOfWeek === idx)
    setEditDay(idx)
    setEditForm(sched ? {
      startTime: sched.startTime,
      endTime: sched.endTime,
      breakStart: sched.breakStart || '',
      breakEnd: sched.breakEnd || '',
      slotDuration: sched.slotDuration || 60,
      active: sched.active,
    } : {
      startTime: '08:00',
      endTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 60,
      active: true,
    })
  }

  const saveSchedule = async () => {
    if (editDay === null) return
    setSaving(true)
    try {
      const existing = schedules.find(s => s.dayOfWeek === editDay)
      const payload = {
        dayOfWeek: editDay,
        startTime: editForm.startTime || '08:00',
        endTime: editForm.endTime || '18:00',
        breakStart: editForm.breakStart || null,
        breakEnd: editForm.breakEnd || null,
        slotDuration: editForm.slotDuration || 60,
        active: editForm.active ?? true,
      }

      let res: Response
      if (existing) {
        res = await fetchWithAuth('/api/admin/schedule', { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        res = await fetchWithAuth('/api/admin/schedule', { method: 'POST', body: JSON.stringify(payload) })
      }

      if (res.ok) {
        await load()
        setEditDay(null)
        showToast(`${DAYS[editDay]} atualizado com sucesso`)
      } else {
        const err = await res.json()
        showToast(err.error || 'Erro ao salvar')
      }
    } catch { showToast('Erro de conexão') }
    setSaving(false)
  }

  const addBlockedDate = async () => {
    if (!newBlock.date) return
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/admin/blocked-dates', { method: 'POST', body: JSON.stringify({ date: newBlock.date, reason: newBlock.reason }) })
      if (res.ok) { await load(); setNewBlock({ date: '', reason: '' }); showToast('Data bloqueada') }
    } catch {}
    setSaving(false)
  }

  const removeBlocked = async (id: string) => {
    try { await fetchWithAuth(`/api/admin/blocked-dates?id=${id}`, { method: 'DELETE' }); await load(); showToast('Desbloqueado') } catch {}
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500/90 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg animate-[fadeIn_0.2s_ease-out]">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-stone-800">Configurações</h1>
        <p className="text-stone-400 text-xs mt-0.5">Horários de funcionamento e dias bloqueados</p>
      </div>

      {/* Horários Semanais */}
      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <h2 className="text-sm font-semibold text-stone-800">Horários Semanais</h2>
        </div>
        <div className="space-y-1.5">
          {DAYS.map((dayName, idx) => {
            const sched = schedules.find(s => s.dayOfWeek === idx)
            const isEditing = editDay === idx

            if (isEditing) {
              return (
                <div key={idx} className="bg-stone-50 border border-[#b76e79]/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-800 text-sm font-medium">{dayName}</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-stone-500 text-xs">{editForm.active ? 'Aberto' : 'Fechado'}</span>
                      <button onClick={() => setEditForm({ ...editForm, active: !editForm.active })}
                        className={`w-9 h-5 rounded-full transition-colors relative ${editForm.active ? 'bg-emerald-500' : 'bg-stone-200'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${editForm.active ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </label>
                  </div>
                  {editForm.active && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Início</label>
                        <input type="time" value={editForm.startTime || ''} onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40" />
                      </div>
                      <div>
                        <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Fim</label>
                        <input type="time" value={editForm.endTime || ''} onChange={e => setEditForm({ ...editForm, endTime: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40" />
                      </div>
                      <div>
                        <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Pausa início</label>
                        <input type="time" value={editForm.breakStart || ''} onChange={e => setEditForm({ ...editForm, breakStart: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40" />
                      </div>
                      <div>
                        <label className="block text-stone-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Pausa fim</label>
                        <input type="time" value={editForm.breakEnd || ''} onChange={e => setEditForm({ ...editForm, breakEnd: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40" />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => setEditDay(null)} className="px-3 py-1.5 rounded-md text-xs text-stone-400 border border-stone-200 hover:text-stone-500 transition-colors">Cancelar</button>
                    <button onClick={saveSchedule} disabled={saving}
                      className="px-4 py-1.5 rounded-md text-xs bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-[#b76e79]/20 transition-all">
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={idx} className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded-lg px-3.5 py-2.5 group hover:bg-stone-50 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${sched?.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-stone-600 text-sm font-medium w-20">{dayName}</span>
                  {sched?.active ? (
                    <span className="text-stone-400 text-xs">
                      {sched.startTime} – {sched.endTime}
                      {sched.breakStart && <span className="text-stone-300 ml-1.5">(pausa {sched.breakStart}–{sched.breakEnd})</span>}
                    </span>
                  ) : (
                    <span className="text-stone-300 text-xs">Fechado</span>
                  )}
                </div>
                <button onClick={() => startEdit(idx)}
                  className="text-stone-300 group-hover:text-stone-500 transition-colors">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dias Bloqueados */}
      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <h2 className="text-sm font-semibold text-stone-800">Dias Bloqueados</h2>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          <input type="date" value={newBlock.date} onChange={e => setNewBlock({ ...newBlock, date: e.target.value })}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/40" />
          <input placeholder="Motivo (opcional)" value={newBlock.reason} onChange={e => setNewBlock({ ...newBlock, reason: e.target.value })}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-xs placeholder-stone-400 flex-1 min-w-40 focus:outline-none focus:border-[#b76e79]/40" />
          <button onClick={addBlockedDate} disabled={saving || !newBlock.date}
            className="px-3.5 py-2 rounded-lg text-xs bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-all disabled:opacity-50 font-medium">
            Bloquear
          </button>
        </div>
        {blocked.length === 0 ? (
          <p className="text-stone-300 text-xs text-center py-4">Nenhum dia bloqueado</p>
        ) : (
          <div className="space-y-1.5">
            {blocked.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded-lg px-3.5 py-2.5">
                <div>
                  <span className="text-stone-600 text-xs">{new Date(b.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                  {b.reason && <span className="text-stone-400 text-xs ml-2">— {b.reason}</span>}
                </div>
                <button onClick={() => removeBlocked(b.id)} className="text-red-400/30 hover:text-red-400 transition-colors">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
