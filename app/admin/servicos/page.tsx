'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAdmin } from '../AdminContext'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

interface PackageOption { id: string; name: string; sessions: number; price: number; active: boolean }
interface Service {
  id: string; name: string; description?: string; duration: number; price: number; priceReturn?: number
  active: boolean; isAddon: boolean; travelFee?: string; packageOptions: PackageOption[]
}
interface PkgDraft { id?: string; name: string; sessions: number; price: number }

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const INPUT = "w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40"
const LABEL = "text-stone-400 text-[9px] uppercase tracking-wider block mb-1"

/* ════════════════════════════════════════════
   ServiceForm — componente unificado criar/editar
   ════════════════════════════════════════════ */
function ServiceForm({ initialData, onSave, onCancel, saving }: {
  initialData?: Service
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  saving: boolean
}) {
  const isEdit = !!initialData
  const [name, setName] = useState(initialData?.name || '')
  const [price, setPrice] = useState(initialData?.price || 0)
  const [priceReturn, setPriceReturn] = useState<number | undefined>(initialData?.priceReturn || undefined)
  const [duration, setDuration] = useState(initialData?.duration || 60)
  const [description, setDescription] = useState(initialData?.description || '')
  const [travelFee, setTravelFee] = useState(initialData?.travelFee || '')
  const [isAddon, setIsAddon] = useState(initialData?.isAddon || false)
  const [active, setActive] = useState(initialData?.active ?? true)
  const [pkgs, setPkgs] = useState<PkgDraft[]>(
    initialData?.packageOptions?.map(p => ({ id: p.id, name: p.name, sessions: p.sessions, price: p.price })) || []
  )

  const addPkg = () => setPkgs([...pkgs, { name: '', sessions: 3, price: 0 }])
  const removePkg = (i: number) => { const p = [...pkgs]; p.splice(i, 1); setPkgs(p) }
  const updatePkg = (i: number, f: string, v: string | number) => { const p = [...pkgs]; p[i] = { ...p[i], [f]: v }; setPkgs(p) }

  const handleSubmit = () => {
    const data: Record<string, unknown> = { name, description, duration, price, priceReturn: priceReturn || null, isAddon, travelFee: travelFee || null, active }
    if (isEdit) data.id = initialData!.id
    data.packageOptions = pkgs.filter(p => p.name && p.price > 0)
    onSave(data)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-stone-700 text-sm font-bold">{isEdit ? 'Editar Servico' : 'Criar Novo Servico'}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label className={LABEL}>Nome *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Limpeza de Pele" className={INPUT} /></div>
        <div><label className={LABEL}>Preco *</label>
          <input type="number" step="0.01" value={price || ''} onChange={e => setPrice(+e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Preco retorno</label>
          <input type="number" step="0.01" value={priceReturn ?? ''} onChange={e => setPriceReturn(e.target.value ? +e.target.value : undefined)} className={INPUT} /></div>
        <div><label className={LABEL}>Duracao (min)</label>
          <input type="number" value={duration} onChange={e => setDuration(+e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Taxa deslocamento</label>
          <input value={travelFee} onChange={e => setTravelFee(e.target.value)} className={INPUT} /></div>
        <div className="sm:col-span-2"><label className={LABEL}>Descricao</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${INPUT} resize-none`} /></div>
        <div className="flex items-center gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`w-9 h-[20px] rounded-full relative transition-colors cursor-pointer ${isAddon ? 'bg-amber-500/60' : 'bg-stone-200'}`} onClick={() => setIsAddon(!isAddon)}>
              <div className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm ${isAddon ? 'left-[19px]' : 'left-[3px]'}`} /></div>
            <span className="text-stone-500 text-xs">Add-on</span></label>
          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`w-9 h-[20px] rounded-full relative transition-colors cursor-pointer ${active ? 'bg-emerald-500/60' : 'bg-stone-200'}`} onClick={() => setActive(!active)}>
                <div className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm ${active ? 'left-[19px]' : 'left-[3px]'}`} /></div>
              <span className="text-stone-500 text-xs">{active ? 'Ativo' : 'Inativo'}</span></label>
          )}
        </div>
      </div>

      {/* Pacotes — sempre editáveis */}
      <div className="border-t border-stone-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-stone-500 text-[10px] uppercase tracking-wider font-semibold">
            Opcoes de Pacote {pkgs.length > 0 && `(${pkgs.length})`}
          </span>
          <button type="button" onClick={addPkg} className="text-[#b76e79] text-[10px] font-semibold hover:underline cursor-pointer">+ Adicionar</button>
        </div>
        {pkgs.map((pkg, i) => (
          <div key={pkg.id || `new-${i}`} className="flex gap-2 items-end mb-2">
            <input value={pkg.name} onChange={e => updatePkg(i, 'name', e.target.value)} placeholder="Nome" className="flex-1 px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs focus:outline-none" />
            <input type="number" value={pkg.sessions} onChange={e => updatePkg(i, 'sessions', +e.target.value)} placeholder="Sessões" className="w-20 px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs" />
            <input type="number" step="0.01" value={pkg.price || ''} onChange={e => updatePkg(i, 'price', +e.target.value)} placeholder="R$" className="w-24 px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs" />
            <button type="button" onClick={() => removePkg(i)} className="p-2 text-red-400 hover:text-red-600 cursor-pointer"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>))}
        {pkgs.length === 0 && <p className="text-stone-300 text-[10px] text-center py-2">Nenhum pacote configurado</p>}
      </div>

      <div className="flex gap-2 justify-end sticky bottom-0 bg-white pt-3 pb-1">
        <button type="button" onClick={onCancel} className="px-4 py-3 rounded-lg text-xs text-stone-400 border border-stone-200 min-h-[44px] touch-manipulation cursor-pointer active:bg-stone-50">Cancelar</button>
        <button type="button" onClick={handleSubmit} disabled={saving || !name || !price} className="px-5 py-3 rounded-lg text-xs bg-[#b76e79] text-white font-semibold disabled:opacity-30 hover:bg-[#a25d67] active:scale-[0.97] transition-all min-h-[44px] touch-manipulation cursor-pointer">
          {saving ? (isEdit ? 'Salvando...' : 'Criando...') : (isEdit ? 'Salvar Alteracoes' : 'Criar Servico')}
        </button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   ServicosPage
   ════════════════════════════════════════════ */
export default function ServicosPage() {
  const { fetchWithAuth } = useAdmin()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Service | 'create' | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useBodyScrollLock(!!modal)

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/services')
      if (res.ok) { const d = await res.json(); setServices(Array.isArray(d) ? d : d.services || []) }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleSave = async (data: Record<string, unknown>) => {
    setSaving(true)
    try {
      const isEdit = !!data.id
      const res = await fetchWithAuth('/api/admin/services', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(data),
      })
      if (res.ok) { setModal(null); showToast(isEdit ? 'Servico atualizado!' : 'Servico criado!'); load() }
      else { const d = await res.json(); showToast(d.error || 'Erro') }
    } catch {}
    setSaving(false)
  }

  const deleteService = async (id: string) => {
    try {
      const res = await fetchWithAuth('/api/admin/services', { method: 'DELETE', body: JSON.stringify({ id }) })
      if (res.ok) { showToast('Servico excluido!'); setConfirmDelete(null); load() }
    } catch {}
  }

  return (
    <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Servicos</h1>
          <p className="text-stone-400 text-xs mt-0.5">Gerencie servicos, precos e pacotes</p>
        </div>
        <button type="button" onClick={() => setModal('create')} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#b76e79] text-white text-xs font-semibold hover:bg-[#a25d67] active:scale-[0.97] shadow-sm transition-all touch-manipulation cursor-pointer min-h-[44px]">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
          Novo Servico
        </button>
      </div>

      {toast && <div className="fixed top-4 right-4 z-50 bg-emerald-500/90 text-white text-xs px-4 py-2.5 rounded-lg backdrop-blur animate-[fadeIn_0.2s]">{toast}</div>}

      {/* Modal unificado criar/editar */}
      {modal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/30 backdrop-blur-sm p-4 overflow-y-auto touch-manipulation" onClick={() => setModal(null)}>
          <div className="bg-white border-2 border-[#b76e79]/20 rounded-2xl p-5 animate-[fadeIn_0.2s] w-full max-w-lg my-4 sm:my-8" onClick={e => e.stopPropagation()}>
            <ServiceForm
              initialData={modal !== 'create' ? modal : undefined}
              onSave={handleSave}
              onCancel={() => setModal(null)}
              saving={saving}
            />
          </div>
        </div>,
        document.body
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
                  <button onClick={() => setModal(s)} className="p-1.5 rounded-md bg-stone-50 text-stone-400 hover:text-stone-600 transition-all">
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
