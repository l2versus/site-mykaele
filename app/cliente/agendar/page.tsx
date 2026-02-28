'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useClient } from '../ClientContext'

interface Service { id: string; name: string; description?: string; duration: number; price: number; priceReturn?: number }
interface Slot { time: string; available: boolean }
interface Package { id: string; totalSessions: number; usedSessions: number; status: string; purchaseDate: string; packageOption: { name: string; sessions: number; serviceId: string; service: { id: string; name: string } } }

const STEPS = ['Servico', 'Tipo', 'Local', 'Data', 'Horario', 'Creditos', 'Confirmacao']
const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function AgendarPage() {
  const { fetchWithAuth } = useClient()
  const [step, setStep] = useState(0)
  const [services, setServices] = useState<Service[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [bookingResult, setBookingResult] = useState<{
    clientName?: string
    serviceName?: string
    scheduledAt?: string
    location?: string
    type?: string
    address?: string
    usedCredit?: string
    packageInfo?: { packageName: string; sessionsUsed: number; sessionsTotal: number; sessionsRemaining: number } | null
  } | null>(null)
  const [serviceId, setServiceId] = useState('')
  const [type, setType] = useState<'FIRST' | 'RETURN'>('FIRST')
  const [location, setLocation] = useState<'CLINIC' | 'HOME_SPA'>('CLINIC')
  const [address, setAddress] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)

  const selectedService = services.find(s => s.id === serviceId)
  const selectedPackage = packages.find(p => p.id === selectedPackageId)
  const price = selectedService ? (type === 'RETURN' && selectedService.priceReturn ? selectedService.priceReturn : selectedService.price) : 0

  useEffect(() => {
    (async () => {
      try {
        const [svcRes, pkgRes] = await Promise.all([
          fetch('/api/services'),
          fetchWithAuth('/api/patient/packages')
        ])
        if (svcRes.ok) { const raw = await svcRes.json(); setServices(Array.isArray(raw) ? raw : (raw.services || [])) }
        if (pkgRes.ok) { const data = await pkgRes.json(); setPackages((data.packages || data || []).filter((p: Package) => p.status === 'ACTIVE' && p.usedSessions < p.totalSessions)) }
      } catch { /* */ }
      setLoading(false)
    })()
  }, [fetchWithAuth])

  const loadSlots = useCallback(async (d: string) => {
    if (!serviceId || !d) return
    setSlots([])
    try {
      const res = await fetch(`/api/booking/availability?date=${d}&serviceId=${serviceId}`)
      if (res.ok) { const data = await res.json(); setSlots(data.slots || []) }
    } catch { /* */ }
  }, [serviceId])

  const selectDate = (d: string) => { setDate(d); setTime(''); loadSlots(d) }

  const submit = async () => {
    setSubmitting(true)
    try {
      const scheduledAt = new Date(`${date}T${time}:00`)
      const endAt = new Date(scheduledAt.getTime() + (selectedService?.duration || 60) * 60000)
      const res = await fetchWithAuth('/api/patient/appointments', {
        method: 'POST',
        body: JSON.stringify({
          serviceId,
          scheduledAt: scheduledAt.toISOString(),
          endAt: endAt.toISOString(),
          type,
          location,
          address: location === 'HOME_SPA' ? address : undefined,
          price,
          packageId: selectedPackageId || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setBookingResult({
          clientName: data.clientName || 'Cliente',
          serviceName: selectedService?.name || '',
          scheduledAt: scheduledAt.toISOString(),
          location: location === 'HOME_SPA' ? 'Home Spa (domicilio)' : 'Clinica',
          address: location === 'HOME_SPA' ? address : undefined,
          type: type === 'FIRST' ? 'Primeira Consulta' : 'Retorno',
          usedCredit: selectedPackage ? selectedPackage.packageOption.name : undefined,
          packageInfo: data.packageInfo || null,
        })
        setSuccess(true)
      }
    } catch { /* */ }
    setSubmitting(false)
  }

  /* ── Tela de sucesso ── */
  if (success && bookingResult) {
    const dt = bookingResult.scheduledAt ? new Date(bookingResult.scheduledAt) : new Date()
    const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    return (
      <div className="text-center py-12 animate-[fadeIn_0.5s_ease-out]">
        <div className="relative w-20 h-20 mx-auto mb-5">
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-pulse" />
          <div className="relative w-full h-full rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <h2 className="text-xl font-light text-white/90 tracking-tight">Sessão Agendada!</h2>
        <p className="text-white/30 text-xs mt-2 max-w-xs mx-auto">
          Mykaele já recebeu a notificação automática pelo WhatsApp.
        </p>

        {/* Resumo */}
        <div className="relative overflow-hidden rounded-2xl mt-6 text-left">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
          <div className="relative border border-white/[0.06] rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4a0a7]" />
            <span className="text-white/40 text-xs">{bookingResult.serviceName}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4a0a7]" />
            <span className="text-white/40 text-xs">{dateStr} as {timeStr}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4a0a7]" />
            <span className="text-white/40 text-xs">{bookingResult.location}</span>
          </div>
          {bookingResult.address && (
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#d4a0a7]" />
              <span className="text-white/40 text-xs">{bookingResult.address}</span>
            </div>
          )}
          {bookingResult.packageInfo && (
            <div className="flex items-center gap-2.5 pt-2 border-t border-white/[0.05]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#d4a0a7]" />
              <span className="text-white/40 text-xs">
                {bookingResult.packageInfo.packageName} — faltam <span className="text-[#d4a0a7] font-semibold">{bookingResult.packageInfo.sessionsRemaining}</span> sessões
              </span>
            </div>
          )}
          {bookingResult.usedCredit && (
            <div className="flex items-center gap-2.5 pt-2 border-t border-white/[0.05]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-white/40 text-xs">
                Crédito utilizado: <span className="text-emerald-400 font-semibold">{bookingResult.usedCredit}</span>
              </span>
            </div>
          )}
          </div>
        </div>

        {/* WhatsApp confirmation badge */}
        <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/10 border border-[#25D366]/20">
          <svg width="16" height="16" fill="#25D366" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          <span className="text-[#25D366] text-xs font-medium">Notificacao enviada automaticamente</span>
        </div>

        <button onClick={() => { setSuccess(false); setBookingResult(null); setStep(0); setServiceId(''); setDate(''); setTime(''); setAddress('') }}
          className="mt-6 block mx-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-xs font-medium shadow-lg shadow-[#b76e79]/15 hover:shadow-[#b76e79]/25 active:scale-[0.98] transition-all">
          Nova Sessão
        </button>
      </div>
    )
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>

  const dates: string[] = []
  const today = new Date()
  for (let i = 1; i <= 30; i++) { const d = new Date(today); d.setDate(d.getDate() + i); dates.push(d.toISOString().split('T')[0]) }

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-light text-white/90 tracking-tight">Agendar Sessão</h1>
            <p className="text-[#c28a93]/40 text-[10px] mt-0.5 tracking-wide">Passo {step + 1} de {STEPS.length} · {STEPS[step]}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#b76e79]/20 to-[#d4a0a7]/10 flex items-center justify-center border border-[#b76e79]/15">
            <span className="text-[#d4a0a7] text-xs font-bold">{step + 1}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] shadow-sm shadow-[#b76e79]/20' : 'bg-white/[0.04]'}`} />
          ))}
        </div>
      </div>

      {/* Step 0: Service */}
      {step === 0 && (
        <div className="space-y-2.5">
          <p className="text-white/25 text-xs">Qual servico deseja?</p>
          {services.map((s) => (
            <button key={s.id} onClick={() => { setServiceId(s.id); setStep(1) }}
              className={`group w-full text-left relative overflow-hidden rounded-2xl transition-all duration-300 ${
                serviceId === s.id ? 'ring-1 ring-[#b76e79]/30' : ''
              }`}>
              <div className={`absolute inset-0 transition-all duration-300 ${serviceId === s.id ? 'bg-gradient-to-br from-[#b76e79]/10 to-white/[0.02]' : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06] group-hover:to-white/[0.02]'}`} />
              <div className="relative border border-white/[0.06] group-hover:border-white/[0.10] rounded-2xl p-5 transition-all">
                <div className="font-medium text-white/90 text-sm tracking-tight">{s.name}</div>
                {s.description && <div className="text-white/25 text-[11px] mt-1 leading-relaxed">{s.description}</div>}
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-[#d4a0a7] font-semibold text-sm">{fmtCur(s.price)}</span>
                  <span className="text-white/20 text-[10px] flex items-center gap-1">
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {s.duration}min
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 1: Type */}
      {step === 1 && (
        <div className="space-y-2.5">
          <p className="text-white/25 text-xs">Tipo de consulta</p>
          {(['FIRST', 'RETURN'] as const).map((t) => (
            <button key={t} onClick={() => { setType(t); setStep(2) }}
              className={`group w-full text-left relative overflow-hidden rounded-2xl transition-all duration-300 ${
                type === t ? 'ring-1 ring-[#b76e79]/30' : ''
              }`}>
              <div className={`absolute inset-0 transition-all duration-300 ${type === t ? 'bg-gradient-to-br from-[#b76e79]/10 to-white/[0.02]' : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06] group-hover:to-white/[0.02]'}`} />
              <div className={`relative border border-white/[0.06] group-hover:border-white/[0.10] rounded-2xl p-5 transition-all`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t === 'FIRST' ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                  {t === 'FIRST' ? (
                    <svg width="16" height="16" fill="none" stroke="#f59e0b" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="#3b82f6" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                  )}
                </div>
                <div>
                  <div className="font-medium text-white/90 text-sm tracking-tight">{t === 'FIRST' ? 'Primeira Consulta' : 'Retorno'}</div>
                  <div className="text-white/25 text-[11px]">{t === 'FIRST' ? 'Primeira sessão com avaliação' : 'Sessão de acompanhamento'}</div>
                  <div className="text-[#d4a0a7] font-semibold text-sm mt-1.5">
                    {fmtCur(t === 'RETURN' && selectedService?.priceReturn ? selectedService.priceReturn : selectedService?.price || 0)}
                  </div>
                </div>
              </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Location */}
      {step === 2 && (
        <div className="space-y-2.5">
          <p className="text-white/25 text-xs">Onde prefere ser atendida?</p>
          {(['CLINIC', 'HOME_SPA'] as const).map((l) => (
            <button key={l} onClick={() => {
              setLocation(l)
              if (l === 'CLINIC') { setAddress(''); setStep(3) }
            }}
              className={`group w-full text-left relative overflow-hidden rounded-2xl transition-all duration-300 ${
                location === l ? 'ring-1 ring-[#b76e79]/30' : ''
              }`}>
              <div className={`absolute inset-0 transition-all duration-300 ${location === l ? 'bg-gradient-to-br from-[#b76e79]/10 to-white/[0.02]' : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06] group-hover:to-white/[0.02]'}`} />
              <div className={`relative border border-white/[0.06] group-hover:border-white/[0.10] rounded-2xl p-5 transition-all`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${l === 'CLINIC' ? 'bg-purple-500/10' : 'bg-emerald-500/10'}`}>
                  {l === 'CLINIC' ? (
                    <svg width="16" height="16" fill="none" stroke="#a855f7" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="#10b981" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  )}
                </div>
                <div>
                  <div className="font-medium text-white/90 text-sm tracking-tight">{l === 'CLINIC' ? 'Clínica' : 'Home Spa'}</div>
                  <div className="text-white/25 text-[11px]">{l === 'CLINIC' ? 'Atendimento na clínica' : 'Atendimento em domicílio'}</div>
                </div>
              </div>
              </div>
            </button>
          ))}

          {/* Address input for Home Spa */}
          {location === 'HOME_SPA' && (
            <div className="mt-3 space-y-2 animate-[fadeIn_0.3s_ease-out]">
              <label className="text-white/30 text-xs font-medium">Endereco para atendimento</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, complemento..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3.5 text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#b76e79]/30 focus:bg-white/[0.06] transition-all"
              />
              <button
                onClick={() => { if (address.trim()) setStep(3) }}
                disabled={!address.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-sm font-medium shadow-lg shadow-[#b76e79]/15 hover:shadow-[#b76e79]/25 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                Continuar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Date */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-white/25 text-xs">Escolha a data</p>
          <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
            {dates.map((d) => {
              const dt = new Date(d + 'T12:00:00')
              const dayName = dt.toLocaleDateString('pt-BR', { weekday: 'short' })
              const dayNum = dt.getDate()
              const month = dt.toLocaleDateString('pt-BR', { month: 'short' })
              const isSunday = dt.getDay() === 0
              return (
                <button key={d} onClick={() => { selectDate(d); setStep(4) }} disabled={isSunday}
                  className={`relative overflow-hidden rounded-2xl p-3 text-center transition-all duration-300 border hover:bg-white/[0.05] disabled:opacity-20 disabled:cursor-not-allowed ${
                    date === d ? 'border-[#b76e79]/25 bg-[#b76e79]/8' : 'border-white/[0.05] bg-white/[0.03]'
                  }`}>
                  <div className="text-white/25 text-[9px] uppercase font-medium">{dayName}</div>
                  <div className="text-white font-bold text-lg">{dayNum}</div>
                  <div className="text-white/20 text-[9px]">{month}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 4: Time */}
      {step === 4 && (
        <div className="space-y-3">
          <p className="text-white/25 text-xs">Horario para {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
          {slots.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-white/10"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <p className="text-white/20 text-xs">Nenhum horario disponivel</p>
              <button onClick={() => setStep(3)} className="mt-3 text-[#d4a0a7] text-xs font-medium hover:underline">Escolher outra data</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.filter(s => s.available).map((s) => (
                <button key={s.time} onClick={() => { setTime(s.time); setStep(5) }}
                  className={`rounded-2xl py-3.5 text-center transition-all duration-300 border hover:bg-white/[0.06] ${
                    time === s.time ? 'border-[#b76e79]/30 bg-[#b76e79]/10 shadow-sm shadow-[#b76e79]/10' : 'border-white/[0.05] bg-white/[0.03]'
                  }`}>
                  <div className="text-white font-medium text-sm">{s.time}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Credits/Packages */}
      {step === 5 && (
        <div className="space-y-3">
          <div>
            <p className="text-white/25 text-xs mb-3">Usar crédito de {selectedService?.name} ou pagar agora?</p>
            
            {/* Pay Now Option */}
            <button onClick={() => { setSelectedPackageId(null); setStep(6) }}
              className={`group w-full text-left relative overflow-hidden rounded-2xl transition-all duration-300 mb-3 ${
                !selectedPackageId ? 'ring-1 ring-[#b76e79]/30' : ''
              }`}>
              <div className={`absolute inset-0 transition-all duration-300 ${!selectedPackageId ? 'bg-gradient-to-br from-[#b76e79]/10 to-white/[0.02]' : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06] group-hover:to-white/[0.02]'}`} />
              <div className={`relative border border-white/[0.06] group-hover:border-white/[0.10] rounded-2xl p-4 transition-all`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/50">💳</div>
                  <div>
                    <div className="font-medium text-white/90 text-sm">Pagar na hora</div>
                    <div className="text-white/25 text-[11px]">Débito/Crédito ou Pix</div>
                  </div>
                </div>
                <div className="text-[#d4a0a7] font-bold text-sm">{fmtCur(price)}</div>
              </div>
              </div>
            </button>

            {/* Available Credits */}
            {packages.length > 0 && (
              <div>
                <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-2">Créditos Disponíveis</p>
                <div className="space-y-2">
                  {packages
                    .filter(pkg => {
                      // Only show pcs that match the selected service
                      return pkg.packageOption.service.id === serviceId
                    })
                    .map((pkg) => {
                      const remaining = pkg.totalSessions - pkg.usedSessions
                      return (
                        <button key={pkg.id} onClick={() => { setSelectedPackageId(pkg.id); setStep(6) }}
                          className={`group w-full text-left relative overflow-hidden rounded-2xl transition-all duration-300 ${
                            selectedPackageId === pkg.id ? 'ring-1 ring-emerald-500/30' : ''
                          }`}>
                          <div className={`absolute inset-0 transition-all duration-300 ${selectedPackageId === pkg.id ? 'bg-gradient-to-br from-emerald-500/15 to-white/[0.02]' : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06] group-hover:to-white/[0.02]'}`} />
                          <div className={`relative border border-white/[0.06] group-hover:border-white/[0.10] rounded-2xl p-4 transition-all`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 flex-shrink-0 font-semibold text-sm">✓</div>
                              <div className="min-w-0">
                                <div className="font-medium text-white/90 text-sm truncate">{pkg.packageOption.name}</div>
                                <div className="text-emerald-400/70 text-[11px] font-medium">{remaining} sessões restantes</div>
                              </div>
                            </div>
                            <div className="text-emerald-400 font-bold text-sm flex-shrink-0">Grátis</div>
                          </div>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

            {/* No matching credits */}
            {packages.length > 0 && packages.filter(pkg => pkg.packageOption.service.id === serviceId).length === 0 && (
              <div className="text-center py-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-white/40 text-xs mb-2">Você não tem créditos para este serviço</p>
                <a href="/cliente/creditos" className="text-[#d4a0a7] text-xs font-medium hover:underline">Ver meus créditos →</a>
              </div>
            )}

            {/* No credits at all */}
            {packages.length === 0 && (
              <div className="text-center py-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-white/40 text-xs mb-2">Você não tem créditos disponíveis</p>
                <Link href="/cliente/creditos" className="text-[#d4a0a7] text-xs font-medium hover:underline">Comprar créditos →</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 6: Confirmation */}
      {step === 6 && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
            <div className="relative border border-white/[0.06] rounded-2xl p-5 space-y-3">
            <h3 className="font-light text-white/90 text-sm tracking-tight">Resumo da Sessão</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Servico', value: selectedService?.name || '' },
                { label: 'Tipo', value: type === 'FIRST' ? 'Primeira Consulta' : 'Retorno' },
                { label: 'Local', value: location === 'CLINIC' ? 'Clinica' : 'Home Spa' },
                ...(location === 'HOME_SPA' && address ? [{ label: 'Endereco', value: address }] : []),
                { label: 'Data', value: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) },
                { label: 'Horario', value: time },
                { label: 'Duracao', value: `${selectedService?.duration || 60} min` },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-white/20 text-xs">{item.label}</span>
                  <span className="text-white/60 text-xs font-medium">{item.value}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-white/[0.05] flex justify-between items-center">
                <span className="text-white/30 text-xs font-medium">{selectedPackageId ? 'Crédito' : 'Valor'}</span>
                <span className="text-[#d4a0a7] font-bold text-lg">
                  {selectedPackageId ? (
                    <span className="text-emerald-400">Incluído no crédito</span>
                  ) : (
                    fmtCur(price)
                  )}
                </span>
              </div>
            </div>
          </div>
          </div>
          <button onClick={submit} disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-sm font-medium shadow-lg shadow-[#b76e79]/15 hover:shadow-[#b76e79]/25 active:scale-[0.98] transition-all disabled:opacity-50">
            {submitting ? 'Agendando...' : 'Confirmar Agendamento'}
          </button>
        </div>
      )}

      {/* Back button */}
      {step > 0 && !success && (
        <button onClick={() => setStep(step - 1)}
          className="w-full py-3 rounded-2xl border border-white/[0.06] text-white/25 text-xs font-medium hover:text-white/45 hover:border-white/[0.10] hover:bg-white/[0.02] transition-all">
          ← Voltar
        </button>
      )}
    </div>
  )
}
