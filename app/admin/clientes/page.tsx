'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAdmin } from '../AdminContext'

interface Client {
  id: string; name: string; email: string; phone?: string; balance: number; createdAt: string
  cpfRg?: string; address?: string
  _count: { appointments: number; packages: number }
  totalSpent: number
  packages: Array<{ id: string; totalSessions: number; usedSessions: number; packageOption: { name: string } }>
  appointments: Array<{ id: string; scheduledAt: string; status: string; service: { name: string } }>
}

interface EditForm {
  name: string; email: string; phone: string; cpf: string; address: string; balance: string
}

interface ServiceOption {
  id: string; name: string; price: number; isAddon: boolean
  packageOptions: Array<{ id: string; name: string; sessions: number; price: number }>
}

interface Measurement {
  id: string; date: string; userId: string
  weight?: number; height?: number; bodyFat?: number; muscleMass?: number; bmi?: number
  bust?: number; waist?: number; abdomen?: number; hip?: number
  armLeft?: number; armRight?: number; thighLeft?: number; thighRight?: number
  calfLeft?: number; calfRight?: number
  goalWeight?: number; goalWaist?: number; goalHip?: number; goalBodyFat?: number
  notes?: string; measuredBy?: string
}

interface MeasurementForm {
  weight: string; height: string; bodyFat: string; muscleMass: string
  bust: string; waist: string; abdomen: string; hip: string
  armLeft: string; armRight: string; thighLeft: string; thighRight: string
  calfLeft: string; calfRight: string
  goalWeight: string; goalWaist: string; goalHip: string; goalBodyFat: string
  notes: string
}

const EMPTY_MEASUREMENT_FORM: MeasurementForm = {
  weight: '', height: '', bodyFat: '', muscleMass: '',
  bust: '', waist: '', abdomen: '', hip: '',
  armLeft: '', armRight: '', thighLeft: '', thighRight: '',
  calfLeft: '', calfRight: '',
  goalWeight: '', goalWaist: '', goalHip: '', goalBodyFat: '',
  notes: '',
}

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
const fmtDateTime = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function openWhatsApp(phone: string, msg: string) {
  const clean = phone.replace(/\D/g, '')
  const num = clean.startsWith('55') ? clean : `55${clean}`
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
}

export default function ClientesPage() {
  const { fetchWithAuth } = useAdmin()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [msgModal, setMsgModal] = useState<Client | null>(null)
  const [customMsg, setCustomMsg] = useState('')
  
  // Estado para edição de cliente
  const [editModal, setEditModal] = useState<Client | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', email: '', phone: '', cpf: '', address: '', balance: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  
  // Estado para modal de inserir créditos
  const [creditModal, setCreditModal] = useState<Client | null>(null)
  const [creditType, setCreditType] = useState<'package' | 'sessions' | 'balance' | 'set_balance'>('package')
  const [services, setServices] = useState<ServiceOption[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [creditSessions, setCreditSessions] = useState('1')
  const [creditBalance, setCreditBalance] = useState('')
  const [creditSaving, setCreditSaving] = useState(false)
  const [creditError, setCreditError] = useState('')
  const [creditSuccess, setCreditSuccess] = useState('')

  // Estado para evolução/medidas
  const [evoModal, setEvoModal] = useState<Client | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [evoLoading, setEvoLoading] = useState(false)
  const [evoTab, setEvoTab] = useState<'history' | 'add'>('history')
  const [mForm, setMForm] = useState<MeasurementForm>(EMPTY_MEASUREMENT_FORM)
  const [evoSaving, setEvoSaving] = useState(false)
  const [evoError, setEvoError] = useState('')
  const [evoSuccess, setEvoSuccess] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/clients')
      if (res.ok) { const d = await res.json(); setClients(d.clients || d || []) }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  // Abrir modal de edição
  const openEdit = (c: Client) => {
    setEditForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      cpf: c.cpfRg || '',
      address: c.address || '',
      balance: String(c.balance || 0)
    })
    setEditError('')
    setEditModal(c)
  }
  
  // Salvar edição do cliente
  const saveEdit = async () => {
    if (!editModal) return
    setSaving(true)
    setEditError('')
    try {
      const res = await fetchWithAuth(`/api/admin/clients/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          cpf: editForm.cpf || null,
          address: editForm.address || null,
          balance: parseFloat(editForm.balance) || 0
        })
      })
      if (res.ok) {
        setEditModal(null)
        load()
      } else {
        const data = await res.json()
        setEditError(data.error || 'Erro ao salvar')
      }
    } catch (e) {
      setEditError('Erro de conexão')
    }
    setSaving(false)
  }

  // Carregar serviços disponíveis para inserir créditos
  const loadServices = async () => {
    try {
      const res = await fetch('/api/services')
      if (res.ok) {
        const data = await res.json()
        setServices(data || [])
        if (data.length > 0) setSelectedServiceId(data[0].id)
      }
    } catch {}
  }

  // Abrir modal de inserir créditos
  const openCreditModal = (c: Client) => {
    setCreditModal(c)
    setCreditType('package')
    setCreditError('')
    setCreditSuccess('')
    setCreditBalance('')
    setCreditSessions('1')
    setSelectedPackageId('')
    loadServices()
  }

  // Inserir créditos para o cliente
  const insertCredits = async () => {
    if (!creditModal) return
    setCreditSaving(true)
    setCreditError('')
    setCreditSuccess('')
    try {
      const body: any = { type: creditType }
      if (creditType === 'package') {
        if (!selectedPackageId) { setCreditError('Selecione um pacote'); setCreditSaving(false); return }
        body.packageOptionId = selectedPackageId
      } else if (creditType === 'sessions') {
        if (!selectedServiceId) { setCreditError('Selecione um serviço'); setCreditSaving(false); return }
        body.serviceId = selectedServiceId
        body.sessions = creditSessions
      } else if (creditType === 'balance') {
        if (!creditBalance || parseFloat(creditBalance) < 0) { setCreditError('Informe um valor válido'); setCreditSaving(false); return }
        body.balance = creditBalance
      } else if (creditType === 'set_balance') {
        const val = parseFloat(creditBalance)
        if (isNaN(val) || val < 0) { setCreditError('Informe um valor válido (0 para zerar)'); setCreditSaving(false); return }
        body.balance = creditBalance
      }

      const res = await fetchWithAuth(`/api/admin/clients/${creditModal.id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) {
        setCreditSuccess(data.message || 'Créditos inseridos com sucesso!')
        load() // recarregar lista
        setTimeout(() => { setCreditModal(null) }, 2000)
      } else {
        setCreditError(data.error || 'Erro ao inserir créditos')
      }
    } catch {
      setCreditError('Erro de conexão')
    }
    setCreditSaving(false)
  }

  // ═══ Evolução / Medidas ═══
  const openEvoModal = async (c: Client) => {
    setEvoModal(c)
    setEvoTab('history')
    setEvoError('')
    setEvoSuccess('')
    setMForm(EMPTY_MEASUREMENT_FORM)
    setEvoLoading(true)
    try {
      const res = await fetchWithAuth(`/api/admin/measurements?userId=${c.id}`)
      if (res.ok) {
        const data = await res.json()
        setMeasurements(data.measurements || [])
        // Pre-fill goals from last measurement
        const last = (data.measurements || [])[0]
        if (last) {
          setMForm(prev => ({
            ...prev,
            height: last.height ? String(last.height) : '',
            goalWeight: last.goalWeight ? String(last.goalWeight) : '',
            goalWaist: last.goalWaist ? String(last.goalWaist) : '',
            goalHip: last.goalHip ? String(last.goalHip) : '',
            goalBodyFat: last.goalBodyFat ? String(last.goalBodyFat) : '',
          }))
        }
      }
    } catch {}
    setEvoLoading(false)
  }

  const saveMeasurement = async () => {
    if (!evoModal) return
    setEvoSaving(true)
    setEvoError('')
    setEvoSuccess('')
    try {
      const body: Record<string, unknown> = { userId: evoModal.id, measuredBy: 'Mykaele Procópio' }
      // Parse numeric fields
      const numFields: Array<keyof MeasurementForm> = [
        'weight','height','bodyFat','muscleMass','bust','waist','abdomen','hip',
        'armLeft','armRight','thighLeft','thighRight','calfLeft','calfRight',
        'goalWeight','goalWaist','goalHip','goalBodyFat',
      ]
      let hasValue = false
      for (const f of numFields) {
        const v = parseFloat(mForm[f])
        if (!isNaN(v) && v > 0) { body[f] = v; hasValue = true }
      }
      if (mForm.notes) body.notes = mForm.notes
      if (!hasValue) { setEvoError('Preencha ao menos uma medida'); setEvoSaving(false); return }

      const res = await fetchWithAuth('/api/admin/measurements', { method: 'POST', body: JSON.stringify(body) })
      if (res.ok) {
        setEvoSuccess('Medidas salvas com sucesso!')
        setMForm(prev => ({ ...EMPTY_MEASUREMENT_FORM, height: prev.height, goalWeight: prev.goalWeight, goalWaist: prev.goalWaist, goalHip: prev.goalHip, goalBodyFat: prev.goalBodyFat }))
        // Reload measurements
        const r2 = await fetchWithAuth(`/api/admin/measurements?userId=${evoModal.id}`)
        if (r2.ok) { const d = await r2.json(); setMeasurements(d.measurements || []) }
        setTimeout(() => setEvoSuccess(''), 3000)
      } else {
        const d = await res.json()
        setEvoError(d.error || 'Erro ao salvar')
      }
    } catch { setEvoError('Erro de conexão') }
    setEvoSaving(false)
  }

  const deleteMeasurement = async (id: string) => {
    if (!confirm('Remover esta medição?')) return
    try {
      const res = await fetchWithAuth(`/api/admin/measurements?id=${id}`, { method: 'DELETE' })
      if (res.ok && evoModal) {
        setMeasurements(prev => prev.filter(m => m.id !== id))
      }
    } catch {}
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  const quickMsgs = [
    { label: 'Lembrete de sessão', msg: (c: Client) => `Olá ${c.name.split(' ')[0]}! 🌟\n\nPassando para lembrar da sua sessão agendada. Qualquer dúvida, estou à disposição!\n\nMykaele Procópio - Home Spa` },
    { label: 'Reagendar', msg: (c: Client) => `Olá ${c.name.split(' ')[0]}!\n\nPreciso reagendar sua próxima sessão. Podemos combinar um novo horário?\n\nMykaele Procópio - Home Spa` },
    { label: 'Pós-atendimento', msg: (c: Client) => `Olá ${c.name.split(' ')[0]}! 💆‍♀️\n\nComo você está se sentindo após a sessão? Lembre-se de manter a hidratação e seguir as recomendações!\n\nQualquer dúvida, pode me chamar.\nMykaele Procópio - Home Spa` },
    { label: 'Promoção/Novidade', msg: (c: Client) => `Olá ${c.name.split(' ')[0]}! ✨\n\nTenho uma novidade especial para você! Entre em contato para saber mais.\n\nMykaele Procópio - Home Spa` },
  ]

  const ST: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Pendente', cls: 'text-amber-400' },
    CONFIRMED: { label: 'Confirmado', cls: 'text-emerald-400' },
    COMPLETED: { label: 'Realizado', cls: 'text-blue-400' },
    CANCELLED: { label: 'Cancelado', cls: 'text-red-400' },
  }

  return (
    <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Clientes</h1>
          <p className="text-stone-400 text-xs mt-0.5">{clients.length} cliente(s) cadastrado(s)</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="absolute left-3 top-3 text-stone-400"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou telefone..."
          className="w-full px-3.5 py-2.5 pl-9 bg-white border border-stone-200 rounded-lg text-stone-800 text-xs placeholder-stone-400 focus:outline-none focus:border-[#b76e79]/30" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24" className="mx-auto mb-3 opacity-30"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p className="text-xs">Nenhum cliente encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const isExpanded = expanded === c.id
            return (
              <div key={c.id} className="bg-white border border-stone-100 rounded-xl overflow-hidden">
                {/* Header row */}
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white transition-all" onClick={() => setExpanded(isExpanded ? null : c.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#b76e79]/20 to-[#d4a0a7]/10 flex items-center justify-center text-[#b76e79] text-xs font-bold">{c.name?.charAt(0)}</div>
                    <div>
                      <div className="text-stone-800 text-xs font-medium">{c.name}</div>
                      <div className="text-stone-400 text-[10px]">{c.email}{c.phone && ` · ${c.phone}`}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-[#b76e79] text-xs font-medium">{fmtCur(c.totalSpent)}</div>
                      <div className="text-stone-400 text-[10px]">{c._count.appointments} sessões · {c._count.packages} pacotes</div>
                      {(c.balance || 0) > 0 && (
                        <div className="text-emerald-500 text-[10px] font-semibold mt-0.5">Saldo: {fmtCur(c.balance)}</div>
                      )}
                    </div>
                    {/* Botão Inserir Créditos */}
                    <button onClick={(e) => { e.stopPropagation(); openCreditModal(c) }}
                      className="p-1.5 rounded-md bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all" title="Inserir créditos">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </button>
                    {/* Botão Editar */}
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                      className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all" title="Editar cliente">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    {c.phone && (
                      <button onClick={(e) => { e.stopPropagation(); setMsgModal(c); setCustomMsg('') }}
                        className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all" title="WhatsApp">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                    )}
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={`text-stone-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-stone-100 px-4 py-3 space-y-3 bg-stone-50/50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white rounded-md p-2.5">
                        <div className="text-stone-400 text-[9px] uppercase tracking-wider">Total gasto</div>
                        <div className="text-[#b76e79] text-sm font-bold mt-0.5">{fmtCur(c.totalSpent)}</div>
                      </div>
                      <div className="bg-white rounded-md p-2.5">
                        <div className="text-stone-400 text-[9px] uppercase tracking-wider">Saldo</div>
                        <div className="text-emerald-400 text-sm font-bold mt-0.5">{fmtCur(c.balance || 0)}</div>
                      </div>
                      <div className="bg-white rounded-md p-2.5">
                        <div className="text-stone-400 text-[9px] uppercase tracking-wider">Sessões</div>
                        <div className="text-stone-800 text-sm font-bold mt-0.5">{c._count.appointments}</div>
                      </div>
                      <div className="bg-white rounded-md p-2.5">
                        <div className="text-stone-400 text-[9px] uppercase tracking-wider">Cliente desde</div>
                        <div className="text-stone-600 text-sm font-bold mt-0.5">{fmtDate(c.createdAt)}</div>
                      </div>
                    </div>

                    {/* Active packages */}
                    {c.packages && c.packages.length > 0 && (
                      <div>
                        <div className="text-stone-400 text-[10px] uppercase font-medium mb-1.5">Pacotes ativos</div>
                        <div className="flex gap-2 flex-wrap">
                          {c.packages.map(p => (
                            <div key={p.id} className="bg-[#b76e79]/8 border border-[#b76e79]/15 rounded-md px-2.5 py-1.5">
                              <div className="text-[#b76e79] text-[10px] font-medium">{p.packageOption.name}</div>
                              <div className="text-stone-400 text-[9px]">{p.usedSessions}/{p.totalSessions} sessões usadas</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent appointments */}
                    {c.appointments && c.appointments.length > 0 && (
                      <div>
                        <div className="text-stone-400 text-[10px] uppercase font-medium mb-1.5">Últimas sessões</div>
                        <div className="space-y-1">
                          {c.appointments.map(a => {
                            const st = ST[a.status] || ST.PENDING
                            return (
                              <div key={a.id} className="flex items-center justify-between text-[10px] bg-stone-50 rounded-md px-2.5 py-1.5">
                                <span className="text-stone-500">{fmtDateTime(a.scheduledAt)} · {a.service.name}</span>
                                <span className={`font-medium ${st.cls}`}>{st.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick actions */}
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      <button onClick={() => openCreditModal(c)}
                        className="px-2.5 py-1.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/15 hover:bg-amber-500/20 transition-all flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        Inserir Créditos
                      </button>
                      <button onClick={() => openEvoModal(c)}
                        className="px-2.5 py-1.5 rounded-md text-[10px] font-medium bg-violet-500/10 text-violet-500 border border-violet-500/15 hover:bg-violet-500/20 transition-all flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                        📊 Evolução / Medidas
                      </button>
                      {c.phone && (
                        <>
                        {quickMsgs.map((q, i) => (
                          <button key={i} onClick={() => openWhatsApp(c.phone!, q.msg(c))}
                            className="px-2.5 py-1.5 rounded-md text-[10px] font-medium bg-emerald-500/8 text-emerald-400/70 border border-emerald-500/15 hover:bg-emerald-500/15 transition-all">
                            {q.label}
                          </button>
                        ))}
                        <button onClick={() => { setMsgModal(c); setCustomMsg('') }}
                          className="px-2.5 py-1.5 rounded-md text-[10px] font-medium bg-stone-50 text-stone-400 border border-stone-200 hover:text-stone-500 transition-all">
                          Mensagem personalizada
                        </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Custom message modal */}
      {msgModal && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center px-4" onClick={() => setMsgModal(null)}>
          <div className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-stone-800 text-sm font-semibold mb-1">Enviar mensagem via WhatsApp</h3>
            <p className="text-stone-400 text-xs mb-4">para {msgModal.name} · {msgModal.phone}</p>

            {/* Quick templates */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              {quickMsgs.map((q, i) => (
                <button key={i} onClick={() => setCustomMsg(q.msg(msgModal))}
                  className="px-2 py-1 rounded text-[10px] bg-stone-50 text-stone-400 border border-stone-200 hover:text-stone-500 transition-all">
                  {q.label}
                </button>
              ))}
            </div>

            <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={5} placeholder="Digite sua mensagem..."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-xs focus:outline-none focus:border-[#b76e79]/40 resize-none placeholder-stone-400" />
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => setMsgModal(null)} className="px-3 py-1.5 rounded-md text-xs text-stone-400 border border-stone-200">Cancelar</button>
              <button onClick={() => { if (customMsg && msgModal.phone) { openWhatsApp(msgModal.phone, customMsg); setMsgModal(null) } }}
                disabled={!customMsg}
                className="px-4 py-1.5 rounded-md text-xs bg-emerald-500/80 text-white font-medium disabled:opacity-30 hover:bg-emerald-500 transition-all flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Edição de Cliente */}
      {editModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center px-4" onClick={() => setEditModal(null)}>
          <div className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-stone-800 text-lg font-semibold mb-1">Editar Cliente</h3>
            <p className="text-stone-400 text-xs mb-4">Altere os dados do cliente abaixo</p>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">{editError}</div>
            )}

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-stone-500 text-xs font-medium mb-1">Nome completo *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-stone-500 text-xs font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40"
                />
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-stone-500 text-xs font-medium mb-1">Telefone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="(85) 99999-0000"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40"
                />
              </div>

              {/* CPF/RG */}
              <div>
                <label className="block text-stone-500 text-xs font-medium mb-1">CPF/RG</label>
                <input
                  type="text"
                  value={editForm.cpf}
                  onChange={e => setEditForm({ ...editForm, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40"
                />
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-stone-500 text-xs font-medium mb-1">Endereço</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40"
                />
              </div>

              {/* Saldo */}
              <div>
                <label className="block text-stone-500 text-xs font-medium mb-1">Saldo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.balance}
                  onChange={e => setEditForm({ ...editForm, balance: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 rounded-lg text-sm text-stone-400 border border-stone-200 hover:bg-stone-50 transition-all">
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !editForm.name || !editForm.email}
                className="px-5 py-2 rounded-lg text-sm bg-[#b76e79] text-white font-medium disabled:opacity-50 hover:bg-[#a05d67] transition-all flex items-center gap-2"
              >
                {saving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Inserir Créditos */}
      {creditModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center px-4" onClick={() => setCreditModal(null)}>
          <div className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              </div>
              <div>
                <h3 className="text-stone-800 text-base font-semibold">Inserir Créditos</h3>
                <p className="text-stone-400 text-xs">para {creditModal.name}</p>
              </div>
            </div>

            {creditError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">{creditError}</div>}
            {creditSuccess && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 text-xs flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>{creditSuccess}</div>}

            {/* Tabs de tipo */}
            <div className="flex gap-2 mb-5">
              {[
                { key: 'package' as const, label: 'Pacote', icon: '📦' },
                { key: 'sessions' as const, label: 'Sessões Avulsas', icon: '🎯' },
                { key: 'balance' as const, label: '+ Saldo', icon: '💰' },
                { key: 'set_balance' as const, label: 'Definir Saldo', icon: '✏️' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setCreditType(t.key)}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
                    creditType === t.key
                      ? 'bg-amber-500/10 text-amber-600 border-2 border-amber-500/30'
                      : 'bg-stone-50 text-stone-400 border-2 border-transparent hover:text-stone-600'
                  }`}
                >
                  <span className="block text-base mb-0.5">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* Tipo: Pacote */}
              {creditType === 'package' && (
                <>
                  <div>
                    <label className="block text-stone-500 text-xs font-medium mb-1">Serviço</label>
                    <select
                      value={selectedServiceId}
                      onChange={e => { setSelectedServiceId(e.target.value); setSelectedPackageId('') }}
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-amber-500/40"
                    >
                      <option value="">Selecione um serviço...</option>
                      {services.filter(s => s.packageOptions?.length > 0).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedServiceId && (
                    <div>
                      <label className="block text-stone-500 text-xs font-medium mb-1.5">Pacote</label>
                      <div className="space-y-2">
                        {services.find(s => s.id === selectedServiceId)?.packageOptions.map(po => (
                          <button
                            key={po.id}
                            onClick={() => setSelectedPackageId(po.id)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              selectedPackageId === po.id
                                ? 'border-amber-500/50 bg-amber-50'
                                : 'border-stone-200 hover:border-stone-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-stone-800 text-sm font-medium">{po.name}</div>
                                <div className="text-stone-400 text-xs">{po.sessions} sessões</div>
                              </div>
                              <div className="text-amber-600 font-bold text-sm">{fmtCur(po.price)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Tipo: Sessões Avulsas */}
              {creditType === 'sessions' && (
                <>
                  <div>
                    <label className="block text-stone-500 text-xs font-medium mb-1">Serviço</label>
                    <select
                      value={selectedServiceId}
                      onChange={e => setSelectedServiceId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-amber-500/40"
                    >
                      <option value="">Selecione um serviço...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({fmtCur(s.price)}/sessão)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-stone-500 text-xs font-medium mb-1">Quantidade de sessões</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={creditSessions}
                      onChange={e => setCreditSessions(e.target.value)}
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                  {selectedServiceId && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200/50">
                      <div className="text-amber-700 text-xs font-medium">Resumo</div>
                      <div className="text-stone-600 text-sm mt-1">
                        {creditSessions} sessão(ões) × {fmtCur(services.find(s => s.id === selectedServiceId)?.price || 0)} = 
                        <span className="font-bold text-amber-700 ml-1">{fmtCur((services.find(s => s.id === selectedServiceId)?.price || 0) * parseInt(creditSessions || '0'))}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Tipo: Adicionar saldo monetário */}
              {creditType === 'balance' && (
                <>
                  <div>
                    <label className="block text-stone-500 text-xs font-medium mb-1">Valor a adicionar (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={creditBalance}
                      onChange={e => setCreditBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200/50">
                    <div className="text-stone-500 text-xs">Saldo atual: <span className="font-bold text-stone-700">{fmtCur(creditModal.balance || 0)}</span></div>
                    <div className="text-stone-500 text-xs mt-1">Novo saldo: <span className="font-bold text-emerald-600">{fmtCur((creditModal.balance || 0) + (parseFloat(creditBalance) || 0))}</span></div>
                  </div>
                </>
              )}

              {/* Tipo: Definir saldo exato (pode zerar com 0) */}
              {creditType === 'set_balance' && (
                <>
                  <div>
                    <label className="block text-stone-500 text-xs font-medium mb-1">Definir saldo para (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={creditBalance}
                      onChange={e => setCreditBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-amber-500/40"
                    />
                    <p className="text-stone-400 text-[10px] mt-1">Use 0 para zerar o saldo da cliente</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200/50">
                    <div className="text-stone-500 text-xs">Saldo atual: <span className="font-bold text-stone-700">{fmtCur(creditModal.balance || 0)}</span></div>
                    <div className="text-stone-500 text-xs mt-1">Novo saldo: <span className={`font-bold ${(parseFloat(creditBalance) || 0) === 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtCur(parseFloat(creditBalance) || 0)}</span></div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setCreditModal(null)} className="px-4 py-2 rounded-lg text-sm text-stone-400 border border-stone-200 hover:bg-stone-50 transition-all">
                Cancelar
              </button>
              <button
                onClick={insertCredits}
                disabled={creditSaving || !!creditSuccess}
                className="px-5 py-2 rounded-lg text-sm bg-amber-500 text-white font-medium disabled:opacity-50 hover:bg-amber-600 transition-all flex items-center gap-2"
              >
                {creditSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Inserir Créditos
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════ MODAL EVOLUÇÃO / MEDIDAS ══════════════ */}
      {evoModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEvoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-200 bg-gradient-to-r from-violet-50 to-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                    📊 Evolução Corporal
                  </h2>
                  <p className="text-stone-500 text-sm mt-0.5">{evoModal.name}</p>
                </div>
                <button onClick={() => setEvoModal(null)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 mt-3">
                <button
                  onClick={() => { setEvoTab('history'); setEvoError(''); setEvoSuccess('') }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${evoTab === 'history' ? 'bg-violet-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                >
                  Histórico ({measurements.length})
                </button>
                <button
                  onClick={() => { setEvoTab('add'); setEvoError(''); setEvoSuccess('') }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${evoTab === 'add' ? 'bg-violet-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                >
                  + Nova Medição
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {evoLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : evoTab === 'history' ? (
                /* ──── Tab: Histórico ──── */
                measurements.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">📏</div>
                    <p className="text-stone-400 text-sm">Nenhuma medição registrada</p>
                    <button onClick={() => setEvoTab('add')} className="mt-3 text-violet-500 text-sm font-medium hover:underline">
                      Registrar primeira medição →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Comparação última vs penúltima */}
                    {measurements.length >= 2 && (() => {
                      const last = measurements[0]
                      const prev = measurements[1]
                      const diffs: Array<{ label: string; last: number; prev: number; unit: string; invertGood?: boolean }> = []
                      if (last.weight && prev.weight) diffs.push({ label: 'Peso', last: last.weight, prev: prev.weight, unit: 'kg', invertGood: true })
                      if (last.waist && prev.waist) diffs.push({ label: 'Cintura', last: last.waist, prev: prev.waist, unit: 'cm', invertGood: true })
                      if (last.hip && prev.hip) diffs.push({ label: 'Quadril', last: last.hip, prev: prev.hip, unit: 'cm', invertGood: true })
                      if (last.abdomen && prev.abdomen) diffs.push({ label: 'Abdômen', last: last.abdomen, prev: prev.abdomen, unit: 'cm', invertGood: true })
                      if (last.bodyFat && prev.bodyFat) diffs.push({ label: '% Gordura', last: last.bodyFat, prev: prev.bodyFat, unit: '%', invertGood: true })
                      if (last.muscleMass && prev.muscleMass) diffs.push({ label: 'M. Muscular', last: last.muscleMass, prev: prev.muscleMass, unit: 'kg' })

                      if (diffs.length === 0) return null
                      return (
                        <div className="p-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-200/50 mb-4">
                          <div className="text-xs font-bold text-violet-700 mb-2">📈 Evolução (última vs anterior)</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {diffs.map((d, i) => {
                              const delta = d.last - d.prev
                              const isGood = d.invertGood ? delta < 0 : delta > 0
                              return (
                                <div key={i} className="bg-white/80 rounded-lg px-3 py-2">
                                  <div className="text-[10px] text-stone-400 uppercase font-medium">{d.label}</div>
                                  <div className="text-sm font-bold text-stone-800">{d.last}{d.unit}</div>
                                  <div className={`text-[11px] font-semibold ${delta === 0 ? 'text-stone-400' : isGood ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}{d.unit} {isGood ? '✓' : '↑'}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Lista de medições */}
                    {measurements.map((m, idx) => (
                      <div key={m.id} className="border border-stone-200 rounded-xl p-4 hover:border-violet-300 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center">
                              {measurements.length - idx}
                            </span>
                            <span className="text-stone-700 text-sm font-semibold">{fmtDate(m.date)}</span>
                            {idx === 0 && <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">MAIS RECENTE</span>}
                          </div>
                          <button onClick={() => deleteMeasurement(m.id)} className="text-stone-300 hover:text-red-500 transition-colors p-1" title="Remover">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
                          {m.weight && <div><span className="text-stone-400">Peso:</span> <span className="font-medium text-stone-700">{m.weight}kg</span></div>}
                          {m.height && <div><span className="text-stone-400">Altura:</span> <span className="font-medium text-stone-700">{m.height}cm</span></div>}
                          {m.bmi && <div><span className="text-stone-400">IMC:</span> <span className="font-medium text-stone-700">{m.bmi.toFixed(1)}</span></div>}
                          {m.bodyFat && <div><span className="text-stone-400">Gordura:</span> <span className="font-medium text-stone-700">{m.bodyFat}%</span></div>}
                          {m.muscleMass && <div><span className="text-stone-400">M. Musc:</span> <span className="font-medium text-stone-700">{m.muscleMass}kg</span></div>}
                          {m.bust && <div><span className="text-stone-400">Busto:</span> <span className="font-medium text-stone-700">{m.bust}cm</span></div>}
                          {m.waist && <div><span className="text-stone-400">Cintura:</span> <span className="font-medium text-stone-700">{m.waist}cm</span></div>}
                          {m.abdomen && <div><span className="text-stone-400">Abdômen:</span> <span className="font-medium text-stone-700">{m.abdomen}cm</span></div>}
                          {m.hip && <div><span className="text-stone-400">Quadril:</span> <span className="font-medium text-stone-700">{m.hip}cm</span></div>}
                          {m.armLeft && <div><span className="text-stone-400">Braço E:</span> <span className="font-medium text-stone-700">{m.armLeft}cm</span></div>}
                          {m.armRight && <div><span className="text-stone-400">Braço D:</span> <span className="font-medium text-stone-700">{m.armRight}cm</span></div>}
                          {m.thighLeft && <div><span className="text-stone-400">Coxa E:</span> <span className="font-medium text-stone-700">{m.thighLeft}cm</span></div>}
                          {m.thighRight && <div><span className="text-stone-400">Coxa D:</span> <span className="font-medium text-stone-700">{m.thighRight}cm</span></div>}
                          {m.calfLeft && <div><span className="text-stone-400">Pantur E:</span> <span className="font-medium text-stone-700">{m.calfLeft}cm</span></div>}
                          {m.calfRight && <div><span className="text-stone-400">Pantur D:</span> <span className="font-medium text-stone-700">{m.calfRight}cm</span></div>}
                        </div>
                        {(m.goalWeight || m.goalWaist || m.goalHip || m.goalBodyFat) && (
                          <div className="mt-2 pt-2 border-t border-stone-100 flex flex-wrap gap-3 text-[10px]">
                            <span className="text-stone-400 font-medium">Metas:</span>
                            {m.goalWeight && <span className="text-amber-600">Peso: {m.goalWeight}kg</span>}
                            {m.goalWaist && <span className="text-amber-600">Cintura: {m.goalWaist}cm</span>}
                            {m.goalHip && <span className="text-amber-600">Quadril: {m.goalHip}cm</span>}
                            {m.goalBodyFat && <span className="text-amber-600">Gordura: {m.goalBodyFat}%</span>}
                          </div>
                        )}
                        {m.notes && (
                          <div className="mt-2 text-[11px] text-stone-500 italic bg-stone-50 rounded-lg px-3 py-2">
                            📝 {m.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* ──── Tab: Nova Medição ──── */
                <div className="space-y-4">
                  {evoError && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">{evoError}</div>}
                  {evoSuccess && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm border border-emerald-200">{evoSuccess}</div>}

                  {/* Composição corporal */}
                  <div>
                    <div className="text-xs font-bold text-stone-600 mb-2 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px]">1</span>
                      Composição Corporal
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {([
                        ['weight', 'Peso (kg)'], ['height', 'Altura (cm)'], ['bodyFat', '% Gordura'], ['muscleMass', 'M. Muscular (kg)'],
                      ] as const).map(([k, label]) => (
                        <div key={k}>
                          <label className="block text-stone-400 text-[10px] mb-0.5">{label}</label>
                          <input type="number" step="0.1" value={mForm[k]} onChange={e => setMForm(p => ({ ...p, [k]: e.target.value }))}
                            className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-violet-400 transition-colors" placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Circunferências */}
                  <div>
                    <div className="text-xs font-bold text-stone-600 mb-2 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px]">2</span>
                      Circunferências (cm)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {([
                        ['bust', 'Busto'], ['waist', 'Cintura'], ['abdomen', 'Abdômen'],
                        ['hip', 'Quadril'], ['armLeft', 'Braço Esq'], ['armRight', 'Braço Dir'],
                        ['thighLeft', 'Coxa Esq'], ['thighRight', 'Coxa Dir'], ['calfLeft', 'Panturrilha Esq'], ['calfRight', 'Panturrilha Dir'],
                      ] as const).map(([k, label]) => (
                        <div key={k}>
                          <label className="block text-stone-400 text-[10px] mb-0.5">{label}</label>
                          <input type="number" step="0.1" value={mForm[k]} onChange={e => setMForm(p => ({ ...p, [k]: e.target.value }))}
                            className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-violet-400 transition-colors" placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metas */}
                  <div>
                    <div className="text-xs font-bold text-stone-600 mb-2 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px]">🎯</span>
                      Metas
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {([
                        ['goalWeight', 'Peso (kg)'], ['goalWaist', 'Cintura (cm)'], ['goalHip', 'Quadril (cm)'], ['goalBodyFat', '% Gordura'],
                      ] as const).map(([k, label]) => (
                        <div key={k}>
                          <label className="block text-amber-500 text-[10px] mb-0.5">{label}</label>
                          <input type="number" step="0.1" value={mForm[k]} onChange={e => setMForm(p => ({ ...p, [k]: e.target.value }))}
                            className="w-full px-2.5 py-2 bg-amber-50/50 border border-amber-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-amber-400 transition-colors" placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-stone-400 text-[10px] mb-0.5">Observações</label>
                    <textarea value={mForm.notes} onChange={e => setMForm(p => ({ ...p, notes: e.target.value }))}
                      rows={2} placeholder="Ex: Paciente relatou melhora na retenção de líquidos..."
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 text-sm focus:outline-none focus:border-violet-400 transition-colors resize-none"
                    />
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2 justify-end pt-2">
                    <button onClick={() => setEvoTab('history')} className="px-4 py-2 rounded-lg text-sm text-stone-400 border border-stone-200 hover:bg-stone-50 transition-all">
                      Cancelar
                    </button>
                    <button onClick={saveMeasurement} disabled={evoSaving}
                      className="px-5 py-2 rounded-lg text-sm bg-violet-500 text-white font-medium disabled:opacity-50 hover:bg-violet-600 transition-all flex items-center gap-2"
                    >
                      {evoSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Salvar Medição
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
