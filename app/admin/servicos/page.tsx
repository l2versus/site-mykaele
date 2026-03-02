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
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Partial<Service & { newPkgs: { name: string; sessions: number; price: number }[] }>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/services')
      if (res.ok) { const d = await res.json(); setServices(d.services || d || []) }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  const startEdit = (s: Service) => {
    setCreating(false); setEditing(s.id)
    setForm({ name: s.name, price: s.price, priceReturn: s.priceReturn || undefined, description: s.description || '', duration: s.duration, active: s.active, isAddon: s.isAddon, travelFee: s.travelFee || '' })
  }
  const startCreate = () => { setEditing(null); setCreating(true); setForm({ name: '', price: 0, duration: 60, active: true, isAddon: false, description: '', newPkgs: [] }) }
  const addPkg = () => setForm({ ...form, newPkgs: [...(form.newPkgs || []), { name: '', sessions: 3, price: 0 }] })
  const removePkg = (i: number) => { const p = [...(form.newPkgs || [])]; p.splice(i, 1); setForm({ ...form, newPkgs: p }) }
  const updatePkg = (i: number, f: string, v: string | number) => { const p = [...(form.newPkgs || [])]; p[i] = { ...p[i], [f]: v }; setForm({ ...form, newPkgs: p }) }

  const save = async () => {
    setSaving(true)
    try {
      if (creating) {
        const body: Record<string, unknown> = { name: form.name, description: form.description, duration: form.duration, price: form.price, priceReturn: form.priceReturn, isAddon: form.isAddon, travelFee: form.travelFee || null }
        if (form.newPkgs?.length) body.packageOptions = form.newPkgs.filter(p => p.name && p.price > 0)
        const res = await fetchWithAuth('/api/admin/services', { method: 'POST', body: JSON.stringify(body) })
        if (res.ok) { setCreating(false); setToast('Servico criado!'); load() }
        else { const d = await res.json(); setToast(d.error || 'Erro') }
      } else if (editing) {
        const res = await fetchWithAuth('/api/admin/services', { method: 'PUT', body: JSON.stringify({ id: editing, ...form }) })
        if (res.ok) { setEditing(null); setToast('Servico atualizado!'); load() }
      }
    } catch {}
    setSaving(false); setTimeout(() => setToast(''), 3000)
  }

  const deleteService = async (id: string) => {
    try {
      const res = await fetchWithAuth('/api/admin/services', { method: 'DELETE', body: JSON.stringify({ id }) })
      if (res.ok) { setToast('Servico excluido!'); setConfirmDelete(null); load() }
    } catch {}
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Servicos</h1>
          <p className="text-stone-400 text-xs mt-0.5">Gerencie servicos, precos e pacotes</p>
        </div>
        <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#b76e79] text-white text-xs font-semibold hover:bg-[#a25d67] shadow-sm transition-all">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
          Novo Servico
        </button>
      </div>

      {toast && <div className="fixed top-4 right-4 z-50 bg-emerald-500/90 text-white text-xs px-4 py-2.5 rounded-lg backdrop-blur animate-[fadeIn_0.2s]">{toast}</div>}

      {creating && (
        <div className="bg-white border-2 border-[#b76e79]/20 rounded-2xl p-5 space-y-4 animate-[fadeIn_0.2s]">
          <h2 className="text-stone-700 text-sm font-bold">Criar Novo Servico</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Nome *</label>
              <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Limpeza de Pele" className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40" /></div>
            <div><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Preco *</label>
              <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: +e.target.value })} className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#b76e79]/40" /></div>
            <div><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Preco retorno</label>
              <input type="number" step="0.01" value={form.priceReturn ?? ''} onChange={e => setForm({ ...form, priceReturn: e.target.value ? +e.target.value : undefined })} className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#b76e79]/40" /></div>
            <div><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Duracao (min)</label>
              <input type="number" value={form.duration || 60} onChange={e => setForm({ ...form, duration: +e.target.value })} className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#b76e79]/40" /></div>
            <div><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Taxa deslocamento</label>
              <input value={form.travelFee || ''} onChange={e => setForm({ ...form, travelFee: e.target.value })} className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#b76e79]/40" /></div>
            <div className="sm:col-span-2"><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Descricao</label>
              <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#b76e79]/40 resize-none" /></div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`w-9 h-[20px] rounded-full relative transition-colors ${form.isAddon ? 'bg-amber-500/60' : 'bg-stone-200'}`} onClick={() => setForm({ ...form, isAddon: !form.isAddon })}>
                  <div className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm ${form.isAddon ? 'left-[19px]' : 'left-[3px]'}`} /></div>
                <span className="text-stone-500 text-xs">Add-on</span></label></div>
          </div>
          <div className="border-t border-stone-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-stone-500 text-[10px] uppercase tracking-wider font-semibold">Opcoes de Pacote</span>
              <button onClick={addPkg} className="text-[#b76e79] text-[10px] font-semibold hover:underline">+ Adicionar</button>
            </div>
            {(form.newPkgs || []).map((pkg, i) => (
              <div key={i} className="flex gap-2 items-end mb-2">
                <input value={pkg.name} onChange={e => updatePkg(i, 'name', e.target.value)} placeholder="Nome" className="flex-1 px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs focus:outline-none" />
                <input type="number" value={pkg.sessions} onChange={e => updatePkg(i, 'sessions', +e.target.value)} className="w-20 px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs" />
                <input type="number" step="0.01" value={pkg.price || ''} onChange={e => updatePkg(i, 'price', +e.target.value)} placeholder="R$" className="w-24 px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs" />
                <button onClick={() => removePkg(i)} className="p-2 text-red-400 hover:text-red-600"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg text-xs text-stone-400 border border-stone-200">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name || !form.price} className="px-5 py-2 rounded-lg text-xs bg-[#b76e79] text-white font-semibold disabled:opacity-30 hover:bg-[#a25d67] transition-all">{saving ? 'Criando...' : 'Criar Servico'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="space-y-3">
          {services.map(s => (
            <div key={s.id} className="bg-white border border-stone-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.isAddon ? 'bg-amber-500/10' : 'bg-[#b76e79]/10'}`}>
                    {s.isAddon ? <svg width="16" height="16" fill="none" stroke="#d4a0a7" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
                    : <svg width="16" height="16" fill="none" stroke="#d4a0a7" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>}
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
                <div className="flex items-center gap-1.5">
                  <button onClick={() => startEdit(s)} className="p-1.5 rounded-md bg-stone-50 text-stone-400 hover:text-stone-600 transition-all">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  {confirmDelete === s.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteService(s.id)} className="px-2 py-1 rounded text-[10px] bg-red-500 text-white font-semibold">Sim</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded text-[10px] bg-stone-100 text-stone-500">Nao</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(s.id)} className="p-1.5 rounded-md bg-red-50 text-red-400 hover:text-red-600 transition-all">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>
              </div>
              {s.packageOptions.length > 0 && (
                <div className="border-t border-stone-100 px-4 py-2.5 flex gap-2 flex-wrap">
                  {s.packageOptions.map(p => (<div key={p.id} className="bg-stone-50 rounded-md px-2.5 py-1.5">
                    <div className="text-stone-500 text-[10px] font-medium">{p.name}</div>
                    <div className="text-stone-400 text-[9px]">{p.sessions} sessoes · {fmtCur(p.price)}</div>
                  </div>))}
                </div>
              )}
              {editing === s.id && (
                <div className="border-t border-stone-100 px-4 py-3 bg-stone-50/50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Nome</label>
                      <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30" /></div>
                    <div><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Preco</label>
                      <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: +e.target.value })} className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30" /></div>
                    <div><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Preco retorno</label>
                      <input type="number" step="0.01" value={form.priceReturn ?? ''} onChange={e => setForm({ ...form, priceReturn: e.target.value ? +e.target.value : undefined })} className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30" /></div>
                    <div><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Duracao (min)</label>
                      <input type="number" value={form.duration || ''} onChange={e => setForm({ ...form, duration: +e.target.value })} className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30" /></div>
                    <div className="flex items-end gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div className={`w-8 h-[18px] rounded-full relative transition-colors cursor-pointer ${form.active ? 'bg-emerald-500/60' : 'bg-stone-200'}`} onClick={() => setForm({ ...form, active: !form.active })}>
                          <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm ${form.active ? 'left-[18px]' : 'left-[2px]'}`} /></div>
                        <span className="text-stone-400 text-[10px]">{form.active ? 'Ativo' : 'Inativo'}</span></label>
                    </div>
                  </div>
                  <div><label className="text-stone-400 text-[9px] uppercase tracking-wider block mb-1">Descricao</label>
                    <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/30 resize-none" /></div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md text-xs text-stone-400 border border-stone-200">Cancelar</button>
                    <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-md text-xs bg-[#b76e79]/80 text-white font-medium disabled:opacity-30 hover:bg-[#b76e79] transition-all">{saving ? 'Salvando...' : 'Salvar'}</button>
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
