'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../AdminContext'

interface PackageOption { id: string; name: string; sessions: number; price: number; active: boolean }
interface Service {
  id: string; name: string; description?: string; duration: number; price: number; priceReturn?: number
  active: boolean; isAddon: boolean; travelFee?: string; packageOptions: PackageOption[]
}

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function ServicosPage() {
  const { fetchWithAuth } = useAdmin()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Service>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/services')
      if (res.ok) { const d = await res.json(); setServices(d.services || d || []) }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  const startEdit = (s: Service) => {
    setEditing(s.id)
    setForm({ price: s.price, priceReturn: s.priceReturn || undefined, description: s.description || '', duration: s.duration, active: s.active })
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/admin/services', {
        method: 'PUT',
        body: JSON.stringify({ id: editing, ...form }),
      })
      if (res.ok) { setEditing(null); setToast('Serviço atualizado!'); load() }
    } catch {}
    setSaving(false)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
      <div>
        <h1 className="text-xl font-semibold text-stone-800">Serviços</h1>
        <p className="text-stone-400 text-xs mt-0.5">Gerencie serviços, preços e pacotes</p>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500/90 text-white text-xs px-4 py-2.5 rounded-lg backdrop-blur animate-[fadeIn_0.2s]">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="inline mr-1.5 -mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {services.map(s => (
            <div key={s.id} className="bg-white border border-stone-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.isAddon ? 'bg-amber-500/10' : 'bg-[#b76e79]/10'}`}>
                    {s.isAddon ? (
                      <svg width="16" height="16" fill="none" stroke="#d4a0a7" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
                    ) : (
                      <svg width="16" height="16" fill="none" stroke="#d4a0a7" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-stone-800 text-xs font-medium">{s.name}</span>
                      {s.isAddon && <span className="text-[9px] bg-amber-500/10 text-amber-400/80 px-1.5 py-0.5 rounded">Addon</span>}
                      {!s.active && <span className="text-[9px] bg-red-500/10 text-red-400/80 px-1.5 py-0.5 rounded">Inativo</span>}
                    </div>
                    <div className="text-stone-400 text-[10px] mt-0.5">{s.duration}min · {fmtCur(s.price)}{s.priceReturn ? ` · Retorno ${fmtCur(s.priceReturn)}` : ''}</div>
                  </div>
                </div>
                <button onClick={() => startEdit(s)} className="p-1.5 rounded-md bg-stone-50 text-stone-400 hover:text-stone-600 transition-all">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>

              {/* Package options */}
              {s.packageOptions.length > 0 && (
                <div className="border-t border-stone-100 px-4 py-2.5 flex gap-2 flex-wrap">
                  {s.packageOptions.map(p => (
                    <div key={p.id} className="bg-white rounded-md px-2.5 py-1.5">
                      <div className="text-stone-500 text-[10px] font-medium">{p.name}</div>
                      <div className="text-stone-400 text-[9px]">{p.sessions} sessões · {fmtCur(p.price)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Edit form */}
              {editing === s.id && (
                <div className="border-t border-stone-100 px-4 py-3 bg-stone-50/50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Preço</label>
                      <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: +e.target.value })}
                        className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30" />
                    </div>
                    <div>
                      <label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Preço retorno</label>
                      <input type="number" step="0.01" value={form.priceReturn ?? ''} onChange={e => setForm({ ...form, priceReturn: e.target.value ? +e.target.value : undefined })}
                        className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30" />
                    </div>
                    <div>
                      <label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Duração (min)</label>
                      <input type="number" value={form.duration || ''} onChange={e => setForm({ ...form, duration: +e.target.value })}
                        className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30" />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div className={`w-8 h-[18px] rounded-full relative transition-colors cursor-pointer ${form.active ? 'bg-emerald-500/60' : 'bg-stone-200'}`}
                          onClick={() => setForm({ ...form, active: !form.active })}>
                          <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm ${form.active ? 'left-[18px]' : 'left-[2px]'}`} />
                        </div>
                        <span className="text-stone-400 text-[10px]">{form.active ? 'Ativo' : 'Inativo'}</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Descrição</label>
                    <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                      className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30 resize-none" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md text-xs text-stone-400 border border-stone-200">Cancelar</button>
                    <button onClick={save} disabled={saving}
                      className="px-4 py-1.5 rounded-md text-xs bg-[#b76e79]/80 text-white font-medium disabled:opacity-30 hover:bg-[#b76e79] transition-all">
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
