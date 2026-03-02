'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../AdminContext'

interface Protocol {
  id: number; name: string; description: string | null; serviceId: number
  totalSteps: number; intervalDays: number; steps: string; isActive: boolean; createdAt: string
}

interface Step { order: number; title: string; description: string; products?: string }

export default function ProtocolosPage() {
  const { fetchWithAuth } = useAdmin()
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', description: '', serviceId: '', intervalDays: '7', isActive: true })
  const [steps, setSteps] = useState<Step[]>([{ order: 1, title: '', description: '', products: '' }])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/admin/protocols')
      if (res.ok) setProtocols(await res.json())
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.name || !form.serviceId) return
    const body = {
      ...form, serviceId: +form.serviceId, intervalDays: +form.intervalDays,
      totalSteps: steps.length, steps: JSON.stringify(steps),
      ...(editId ? { id: editId } : {})
    }
    try {
      const res = await fetchWithAuth('/api/admin/protocols', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (res.ok) { load(); resetForm() }
    } catch {}
  }

  const remove = async (id: number) => {
    if (!confirm('Excluir protocolo?')) return
    try {
      const res = await fetchWithAuth(`/api/admin/protocols?id=${id}`, { method: 'DELETE' })
      if (res.ok) load()
    } catch {}
  }

  const edit = (p: Protocol) => {
    setEditId(p.id)
    setForm({ name: p.name, description: p.description || '', serviceId: String(p.serviceId), intervalDays: String(p.intervalDays), isActive: p.isActive })
    try { setSteps(JSON.parse(p.steps)) } catch { setSteps([{ order: 1, title: '', description: '', products: '' }]) }
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false); setEditId(null)
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
        <button onClick={() => setShowForm(true)} className="px-4 py-2.5 bg-[#b76e79] text-white text-sm font-semibold rounded-xl hover:bg-[#a25d68] transition-colors shadow-md">
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
            try { parsedSteps = JSON.parse(p.steps) } catch {}
            return (
              <div key={p.id} className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-stone-800 font-semibold">{p.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
                        {p.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {p.description && <p className="text-stone-400 text-xs mt-1">{p.description}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-stone-500">
                      <span>{p.totalSteps} etapas</span>
                      <span>Intervalo: {p.intervalDays} dias</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => edit(p)} className="px-3 py-1.5 text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">Editar</button>
                    <button onClick={() => remove(p.id)} className="px-3 py-1.5 text-[10px] font-semibold bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">Excluir</button>
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
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 overflow-y-auto" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-stone-800">{editId ? 'Editar' : 'Novo'} Protocolo</h2>
            <div className="space-y-3">
              <input placeholder="Nome do protocolo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <textarea placeholder="Descricao" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40 resize-none" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="ID do Servico" value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })} className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
                <input type="number" placeholder="Intervalo (dias)" value={form.intervalDays} onChange={e => setForm({ ...form, intervalDays: e.target.value })} className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded" /> Ativo
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-stone-700">Etapas</h3>
                <button onClick={addStep} className="text-xs text-[#b76e79] font-semibold hover:underline">+ Etapa</button>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {steps.map((st, i) => (
                  <div key={i} className="bg-stone-50 rounded-xl p-3 space-y-2 relative">
                    <div className="flex items-center gap-2">
                      <span className="text-stone-400 text-xs font-bold">#{st.order}</span>
                      <input placeholder="Titulo da etapa" value={st.title} onChange={e => updateStep(i, 'title', e.target.value)} className="flex-1 px-2 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
                      {steps.length > 1 && (
                        <button onClick={() => removeStep(i)} className="text-red-400 text-xs hover:text-red-600">✕</button>
                      )}
                    </div>
                    <input placeholder="Descricao" value={st.description} onChange={e => updateStep(i, 'description', e.target.value)} className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
                    <input placeholder="Produtos usados (opcional)" value={st.products || ''} onChange={e => updateStep(i, 'products', e.target.value)} className="w-full px-2 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={resetForm} className="flex-1 py-2.5 text-sm font-semibold text-stone-500 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors">Cancelar</button>
              <button onClick={save} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#b76e79] rounded-xl hover:bg-[#a25d68] transition-colors">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
