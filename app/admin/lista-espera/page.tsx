'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../AdminContext'

interface WaitlistEntry {
  id: number; userId: number; serviceId: number; date: string; timeSlot: string; status: string
  notes: string | null; priority: string; createdAt: string
  userName: string; userPhone: string; userEmail: string; serviceName: string
}

export default function ListaEsperaPage() {
  const { fetchWithAuth } = useAdmin()
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('WAITING')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ userId: '', serviceId: '', date: '', timeSlot: '', notes: '', priority: 'NORMAL' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/admin/waitlist?status=${filter}`)
      if (res.ok) {
        const d = await res.json()
        setEntries(Array.isArray(d) ? d : d.entries || [])
      }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth, filter])

  useEffect(() => { load() }, [load])

  const addEntry = async () => {
    if (!form.userId || !form.serviceId || !form.date) return
    try {
      const res = await fetchWithAuth('/api/admin/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId: +form.userId, serviceId: +form.serviceId })
      })
      if (res.ok) { load(); setShowAdd(false); setForm({ userId: '', serviceId: '', date: '', timeSlot: '', notes: '', priority: 'NORMAL' }) }
    } catch {}
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetchWithAuth('/api/admin/waitlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      if (res.ok) load()
    } catch {}
  }

  const remove = async (id: number) => {
    if (!confirm('Remover da lista?')) return
    try {
      const res = await fetchWithAuth(`/api/admin/waitlist?id=${id}`, { method: 'DELETE' })
      if (res.ok) load()
    } catch {}
  }

  const priorityColors: Record<string, string> = { HIGH: 'bg-red-100 text-red-700', NORMAL: 'bg-stone-100 text-stone-600', LOW: 'bg-blue-100 text-blue-600' }
  const statusLabels: Record<string, string> = { WAITING: 'Aguardando', NOTIFIED: 'Notificado', SCHEDULED: 'Agendado', EXPIRED: 'Expirado' }

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Lista de Espera</h1>
          <p className="text-stone-400 text-sm mt-0.5">Gerencie clientes aguardando vaga</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2.5 bg-[#b76e79] text-white text-sm font-semibold rounded-xl hover:bg-[#a25d68] transition-colors shadow-md">
          + Adicionar
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['WAITING', 'NOTIFIED', 'SCHEDULED', 'EXPIRED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === s ? 'bg-[#b76e79] text-white' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
            }`}>
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-3 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-100 shadow-sm">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-stone-400 text-sm">Nenhum registro na lista</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-stone-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-stone-800 font-semibold text-sm">{e.userName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityColors[e.priority] || 'bg-stone-100 text-stone-500'}`}>
                      {e.priority}
                    </span>
                  </div>
                  <div className="text-stone-500 text-xs mt-1">{e.serviceName}</div>
                  <div className="text-stone-400 text-xs mt-0.5">
                    {new Date(e.date).toLocaleDateString('pt-BR')} {e.timeSlot && `· ${e.timeSlot}`}
                  </div>
                  {e.notes && <div className="text-stone-400 text-xs mt-1 italic">{e.notes}</div>}
                  {e.userPhone && (
                    <a href={`https://wa.me/55${e.userPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                      className="text-emerald-600 text-xs font-medium mt-1 inline-flex items-center gap-1 hover:underline">
                      WhatsApp
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {filter === 'WAITING' && (
                    <>
                      <button onClick={() => updateStatus(e.id, 'NOTIFIED')} className="px-3 py-1.5 text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">Notificar</button>
                      <button onClick={() => updateStatus(e.id, 'SCHEDULED')} className="px-3 py-1.5 text-[10px] font-semibold bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">Agendar</button>
                    </>
                  )}
                  {filter === 'NOTIFIED' && (
                    <button onClick={() => updateStatus(e.id, 'SCHEDULED')} className="px-3 py-1.5 text-[10px] font-semibold bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">Agendar</button>
                  )}
                  <button onClick={() => remove(e.id)} className="px-3 py-1.5 text-[10px] font-semibold bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">Remover</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-stone-800">Adicionar a Lista</h2>
            <div className="space-y-3">
              <input placeholder="ID do Cliente" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <input placeholder="ID do Servico" value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <input placeholder="Horario desejado (ex: 14:00)" value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40">
                <option value="LOW">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
              </select>
              <textarea placeholder="Observacoes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40 resize-none" rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 text-sm font-semibold text-stone-500 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors">Cancelar</button>
              <button onClick={addEntry} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#b76e79] rounded-xl hover:bg-[#a25d68] transition-colors">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
