'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAdmin } from '../AdminContext'

interface Protocol {
  id: string; name: string; description: string | null; serviceId: string | null
  totalSteps: number; intervalDays: number; steps: string; active: boolean; createdAt: string
}

interface Step { order: number; title: string; description: string; products?: string }

interface ServiceOption {
  id: string; name: string; price: number; duration: number
}

export default function ProtocolosPage() {
  const { fetchWithAuth } = useAdmin()
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', serviceId: '', intervalDays: '7', isActive: true })
  const [steps, setSteps] = useState<Step[]>([{ order: 1, title: '', description: '', products: '' }])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/admin/protocols')
      if (res.ok) {
        const d = await res.json()
        setProtocols(Array.isArray(d) ? d : d.protocols || [])
      }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  // Carregar serviços disponíveis
  const loadServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services')
      if (res.ok) {
        const data = await res.json()
        setServices(Array.isArray(data) ? data : [])
      }
    } catch {}
  }, [])

  useEffect(() => { load(); loadServices() }, [load, loadServices])

  const openForm = () => {
    setFormError('')
    setShowForm(true)
  }

  const save = async () => {
    setFormError('')
    if (!form.name.trim()) {
      setFormError('Preencha o nome do protocolo')
      return
    }
    setSaving(true)
    const body = {
      name: form.name, description: form.description, serviceId: form.serviceId || null,
      intervalDays: +form.intervalDays, active: form.isActive,
      totalSteps: steps.length, steps,
      ...(editId ? { id: editId } : {})
    }
    try {
      const res = await fetchWithAuth('/api/admin/protocols', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (res.ok) { load(); resetForm() }
      else {
        const d = await res.json().catch(() => ({}))
        setFormError(d.error || 'Erro ao salvar protocolo')
      }
    } catch {
      setFormError('Erro de conexão')
    }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir protocolo?')) return
    try {
      const res = await fetchWithAuth('/api/admin/protocols', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) load()
    } catch {}
  }

  const edit = (p: Protocol) => {
    setEditId(p.id)
    setFormError('')
    setForm({ name: p.name, description: p.description || '', serviceId: p.serviceId || '', intervalDays: String(p.intervalDays), isActive: p.active })
    try {
      const parsed = typeof p.steps === 'string' ? JSON.parse(p.steps) : p.steps
      setSteps(Array.isArray(parsed) ? parsed : [{ order: 1, title: '', description: '', products: '' }])
    } catch { setSteps([{ order: 1, title: '', description: '', products: '' }]) }
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false); setEditId(null); setFormError('')
    setForm({ name: '', description: '', serviceId: '', intervalDays: '7', isActive: true })
    setSteps([{ order: 1, title: '', description: '', products: '' }])
  }

  const addStep = () => setSteps([...steps, { order: steps.length + 1, title: '', description: '', products: '' }])
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })))
  const updateStep = (i: number, field: keyof Step, value: string) => setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Protocolos de Tratamento</h1>
          <p className="text-stone-400 text-sm mt-0.5">Configure protocolos com etapas e intervalos</p>
        </div>
        <button type="button" onClick={openForm} className="px-5 py-3.5 bg-[#b76e79] text-white text-sm font-semibold rounded-xl hover:bg-[#a25d68] active:scale-[0.97] transition-all shadow-md min-h-[48px] min-w-[160px] touch-manipulation cursor-pointer select-none">
          + Novo Protocolo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-3 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : protocols.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-100 shadow-sm">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-stone-400 text-sm">Nenhum protocolo cadastrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {protocols.map(p => {
            let parsedSteps: Step[] = []
            try {
              let parsed = typeof p.steps === 'string' ? JSON.parse(p.steps) : p.steps
              if (typeof parsed === 'string') parsed = JSON.parse(parsed) // handle double-encoded
              parsedSteps = Array.isArray(parsed) ? parsed : []
            } catch {}
            return (
              <div key={p.id} className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-stone-800 font-semibold">{p.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
                        {p.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {p.description && <p className="text-stone-400 text-xs mt-1">{p.description}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-stone-500">
                      <span>{p.totalSteps} etapas</span>
                      <span>Intervalo: {p.intervalDays} dias</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button type="button" onClick={() => edit(p)} className="px-3 py-2 text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 active:scale-[0.97] transition-all min-h-[40px] touch-manipulation cursor-pointer">Editar</button>
                    <button type="button" onClick={() => remove(p.id)} className="px-3 py-2 text-[10px] font-semibold bg-red-50 text-red-500 rounded-lg hover:bg-red-100 active:scale-[0.97] transition-all min-h-[40px] touch-manipulation cursor-pointer">Excluir</button>
                  </div>
                </div>
                {/* Steps Preview */}
                {parsedSteps.length > 0 && (
                  <div className="mt-4 pl-3 border-l-2 border-[#b76e79]/20 space-y-2">
                    {parsedSteps.map((st, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#b76e79]/10 text-[#b76e79] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{st.order}</span>
                        <div>
                          <div className="text-stone-700 text-xs font-medium">{st.title}</div>
                          {st.description && <div className="text-stone-400 text-[10px]">{st.description}</div>}
                          {st.products && <div className="text-stone-300 text-[10px] mt-0.5">Produtos: {st.products}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/30 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto touch-manipulation" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 sm:p-6 space-y-4 my-2 sm:my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-800">{editId ? 'Editar' : 'Novo'} Protocolo</h2>
              <button type="button" onClick={resetForm} className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">{formError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-stone-500 text-xs font-medium mb-1">Nome do protocolo *</label>
                <input placeholder="Ex: Protocolo Corporal 10 sessões" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-3 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40 min-h-[48px]" />
              </div>
              <div>
                <label className="block text-stone-500 text-xs font-medium mb-1">Descrição</label>
                <textarea placeholder="Descrição do protocolo..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-3 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40 resize-none" rows={2} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-500 text-xs font-medium mb-1">Serviço vinculado</label>
                  <select
                    value={form.serviceId}
                    onChange={e => setForm({ ...form, serviceId: e.target.value })}
                    className="w-full px-3 py-3 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40 bg-white min-h-[48px] appearance-auto"
                  >
                    <option value="">Nenhum (opcional)</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-stone-500 text-xs font-medium mb-1">Intervalo entre etapas (dias)</label>
                  <input type="number" placeholder="7" value={form.intervalDays} onChange={e => setForm({ ...form, intervalDays: e.target.value })} className="w-full px-3 py-3 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40 min-h-[48px]" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-600 py-1">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded w-5 h-5" /> Ativo
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-stone-700">Etapas</h3>
                <button type="button" onClick={addStep} className="text-xs text-[#b76e79] font-semibold hover:underline px-3 py-2 min-h-[40px] touch-manipulation">+ Etapa</button>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {steps.map((st, i) => (
                  <div key={i} className="bg-stone-50 rounded-xl p-3 space-y-2 relative">
                    <div className="flex items-center gap-2">
                      <span className="text-stone-400 text-xs font-bold">#{st.order}</span>
                      <input placeholder="Titulo da etapa" value={st.title} onChange={e => updateStep(i, 'title', e.target.value)} className="flex-1 px-2 py-2 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:border-[#b76e79]/40 min-h-[40px]" />
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStep(i)} className="text-red-400 text-xs hover:text-red-600 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation">✕</button>
                      )}
                    </div>
                    <input placeholder="Descricao" value={st.description} onChange={e => updateStep(i, 'description', e.target.value)} className="w-full px-2 py-2 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:border-[#b76e79]/40 min-h-[40px]" />
                    <input placeholder="Produtos usados (opcional)" value={st.products || ''} onChange={e => updateStep(i, 'products', e.target.value)} className="w-full px-2 py-2 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:border-[#b76e79]/40 min-h-[40px]" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-1">
              <button type="button" onClick={resetForm} className="flex-1 py-3.5 text-sm font-semibold text-stone-500 bg-stone-100 rounded-xl hover:bg-stone-200 active:scale-[0.97] transition-all min-h-[52px] touch-manipulation cursor-pointer">Cancelar</button>
              <button type="button" onClick={save} disabled={saving || !form.name.trim()} className="flex-1 py-3.5 text-sm font-semibold text-white bg-[#b76e79] rounded-xl hover:bg-[#a25d68] active:scale-[0.97] transition-all min-h-[52px] touch-manipulation cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
