// src/components/AgendamentoSection.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ===== TYPES =====
interface ServiceConfig {
  id: string
  name: string
  duration: number
  price: number
  description?: string | null
}

interface TimeSlot {
  time: string
  available: boolean
}

interface BookingData {
  serviceId: string
  date: string
  time: string
}

type Step = 'service' | 'calendar' | 'time' | 'login'

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatCurrency(value: number): string {
  if (value === 0) return 'Gratuito'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function AgendamentoSection() {
  const [step, setStep] = useState<Step>('service')
  const [services, setServices] = useState<ServiceConfig[]>([])
  const [selectedService, setSelectedService] = useState<ServiceConfig | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [availableDates, setAvailableDates] = useState<Record<string, number>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastPollTime, setLastPollTime] = useState<number>(0)

  // ===== FETCH SERVICES FROM PRISMA =====
  useEffect(() => {
    fetch('/api/services')
      .then(r => r.json())
      .then(data => {
        const svc = Array.isArray(data) ? data : (data.services || [])
        setServices(svc.filter((s: any) => !s.isAddon).map((s: any) => ({
          id: s.id, name: s.name, duration: s.duration, price: s.price, description: s.description || ''
        })))
      })
      .catch(() => {})
  }, [])

  // ===== FETCH AVAILABLE DATES (Prisma) =====
  const fetchAvailableDates = useCallback(async () => {
    if (!selectedService) return
    setLoading(true)
    try {
      // Calcula range do mês para a API de disponibilidade
      const startDate = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      const endDate = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${daysInMonth.toString().padStart(2, '0')}`
      const res = await fetch(`/api/booking/availability?mode=days&startDate=${startDate}&endDate=${endDate}&serviceId=${selectedService.id}`)
      const data = await res.json()
      // Converte array days[] para Record<string, number>
      const datesMap: Record<string, number> = {}
      if (data.days) {
        for (const d of data.days) {
          if (d.status === 'available' && d.availableSlots > 0) {
            datesMap[d.date] = d.availableSlots
          }
        }
      }
      setAvailableDates(datesMap)
    } catch {
      setAvailableDates({})
    }
    setLoading(false)
  }, [currentMonth, currentYear, selectedService])

  useEffect(() => {
    if (step === 'calendar' && selectedService) {
      fetchAvailableDates()
    }
  }, [step, fetchAvailableDates, selectedService])

  // ===== POLLING para atualização em tempo real (Prisma) =====
  useEffect(() => {
    if (step !== 'time' || !selectedDate || !selectedService) return

    const pollSlots = async () => {
      try {
        const res = await fetch(`/api/booking/availability?date=${selectedDate}&serviceId=${selectedService.id}`)
        const data = await res.json()
        setTimeSlots(data.slots || [])
        setLastPollTime(Date.now())
      } catch { /* silent */ }
    }

    pollSlots()
    const interval = setInterval(pollSlots, 15000) // Poll a cada 15s
    return () => clearInterval(interval)
  }, [step, selectedDate, selectedService])

  // ===== FETCH TIME SLOTS (Prisma) =====
  const fetchTimeSlots = async (date: string) => {
    if (!selectedService) return
    setLoading(true)
    try {
      const res = await fetch(`/api/booking/availability?date=${date}&serviceId=${selectedService.id}`)
      const data = await res.json()
      setTimeSlots(data.slots || [])
    } catch {
      setTimeSlots([])
    }
    setLoading(false)
  }

  // ===== HELPERS =====
  function formatDateDisplay(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return `${d} de ${MONTHS[m - 1]}, ${DAYS_OF_WEEK[date.getDay()]}`
  }

  function getCalendarDays(): (number | null)[] {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  function goBack() {
    if (step === 'calendar') { setStep('service'); setSelectedDate(null) }
    else if (step === 'time') { setStep('calendar'); setSelectedTime(null) }
    else if (step === 'login') { setStep('time') }
  }

  function resetAll() {
    setStep('service')
    setSelectedService(null)
    setSelectedDate(null)
    setSelectedTime(null)
  }

  // ===== RENDER =====
  return (
    <section id="agendamento" className="relative py-32 md:py-40 bg-[#faf9f7] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(183,110,121,0.06),transparent_60%)]" />

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 relative z-10">
        {/* Header */}
        <div className="reveal-blur text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-[#b76e79] mb-6">
            <span className="w-8 h-[1px] bg-[#b76e79]" />
            Agendamento Online
            <span className="w-8 h-[1px] bg-[#b76e79]" />
          </span>
          <h2 className="text-4xl md:text-6xl font-extralight leading-[1.1] tracking-[-0.02em] text-[#2d2d2d]">
            Agende seu
            <br />
            <span className="font-medium text-[#b76e79]">horário</span>
          </h2>
          <p className="mt-6 text-[#8a8580] text-lg font-light max-w-lg mx-auto">
            Escolha o procedimento, data e horário. Disponibilidade atualizada em tempo real.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {(['service', 'calendar', 'time', 'login'] as Step[]).map((s, i) => {
            const stepNames = ['Serviço', 'Data', 'Horário', 'Agendar']
            const isActive = step === s
            const isPast = ['service', 'calendar', 'time', 'login'].indexOf(step) > i
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-[1px] ${isPast ? 'bg-[#b76e79]' : 'bg-[#e8dfd6]'}`} />}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wider uppercase transition-all duration-500 ${
                  isActive ? 'bg-[#b76e79] text-white' : isPast ? 'bg-[#b76e79]/10 text-[#b76e79]' : 'bg-[#e8dfd6]/50 text-[#8a8580]'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isPast && !isActive ? 'bg-[#b76e79] text-white' : isActive ? 'bg-white/20 text-white' : 'bg-[#8a8580]/20 text-[#8a8580]'
                  }`}>
                    {isPast && !isActive ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{stepNames[i]}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Real-time indicator */}
        {step === 'time' && (
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-[#8a8580]">Disponibilidade ao vivo — atualiza a cada 15s</span>
          </div>
        )}

        {/* Content Card */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.04] border border-[#e8dfd6]/50 overflow-hidden">

            {/* ===== STEP 1: SERVICE SELECTION ===== */}
            {step === 'service' && (
              <div className="p-8 md:p-12">
                <h3 className="text-xl font-medium text-[#2d2d2d] mb-2">Escolha o procedimento</h3>
                <p className="text-sm text-[#8a8580] mb-8">Selecione o serviço desejado para ver a disponibilidade</p>
                <div className="grid gap-3">
                  {services.map(service => (
                    <button
                      key={service.id}
                      onClick={() => { setSelectedService(service); setStep('calendar') }}
                      className="group flex items-center gap-5 p-5 rounded-2xl border border-[#e8dfd6]/70 hover:border-[#b76e79]/40 hover:bg-[#faf9f7] transition-all duration-400 text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#b76e79]/8 flex items-center justify-center flex-shrink-0 group-hover:bg-[#b76e79]/15 transition-colors">
                        <svg className="w-5 h-5 text-[#b76e79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#2d2d2d] group-hover:text-[#b76e79] transition-colors">{service.name}</p>
                        <p className="text-xs text-[#8a8580] mt-0.5">{service.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-[#b76e79]">{formatCurrency(service.price)}</p>
                        <p className="text-[10px] text-[#8a8580] uppercase tracking-wider">{service.duration} min</p>
                      </div>
                      <svg className="w-4 h-4 text-[#8a8580] group-hover:text-[#b76e79] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== STEP 2: CALENDAR ===== */}
            {step === 'calendar' && (
              <div className="p-8 md:p-12">
                <div className="flex items-center gap-3 mb-8">
                  <button onClick={goBack} className="w-8 h-8 rounded-full border border-[#e8dfd6] flex items-center justify-center hover:border-[#b76e79] hover:text-[#b76e79] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div>
                    <h3 className="text-xl font-medium text-[#2d2d2d]">Escolha a data</h3>
                    <p className="text-sm text-[#8a8580]">{selectedService?.name} — {selectedService?.duration} min</p>
                  </div>
                </div>

                {/* Month navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => {
                      if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
                      else setCurrentMonth(m => m - 1)
                    }}
                    className="w-10 h-10 rounded-full border border-[#e8dfd6] flex items-center justify-center hover:border-[#b76e79] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h4 className="text-lg font-medium text-[#2d2d2d]">{MONTHS[currentMonth]} {currentYear}</h4>
                  <button
                    onClick={() => {
                      if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
                      else setCurrentMonth(m => m + 1)
                    }}
                    className="w-10 h-10 rounded-full border border-[#e8dfd6] flex items-center justify-center hover:border-[#b76e79] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAYS_OF_WEEK.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold tracking-widest uppercase text-[#8a8580] py-2">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {loading ? (
                    <div className="col-span-7 py-16 text-center">
                      <div className="inline-flex items-center gap-2 text-[#8a8580]">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Carregando...
                      </div>
                    </div>
                  ) : (
                    getCalendarDays().map((day, i) => {
                      if (!day) return <div key={`empty-${i}`} />
                      const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
                      const slotsAvailable = availableDates[dateStr] || 0
                      const isAvailable = slotsAvailable > 0
                      const isSelected = selectedDate === dateStr
                      const today = new Date()
                      const isPast = new Date(dateStr + 'T23:59:59') < today

                      return (
                        <button
                          key={dateStr}
                          disabled={!isAvailable || isPast}
                          onClick={() => { setSelectedDate(dateStr); fetchTimeSlots(dateStr); setStep('time') }}
                          className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all duration-300 ${
                            isSelected ? 'bg-[#b76e79] text-white shadow-lg shadow-[#b76e79]/30'
                              : isAvailable ? 'hover:bg-[#b76e79]/10 text-[#2d2d2d] cursor-pointer'
                              : 'text-[#e8dfd6] cursor-not-allowed'
                          }`}
                        >
                          <span className={`font-medium ${isPast ? 'line-through' : ''}`}>{day}</span>
                          {isAvailable && !isSelected && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#b76e79]" />
                          )}
                          {isAvailable && slotsAvailable <= 3 && (
                            <span className="absolute top-0.5 right-0.5 text-[8px] text-orange-500 font-bold">{slotsAvailable}</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-6 text-[10px] text-[#8a8580] uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#b76e79]" /> Disponível
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Poucos horários
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e8dfd6]" /> Indisponível
                  </div>
                </div>
              </div>
            )}

            {/* ===== STEP 3: TIME SLOTS ===== */}
            {step === 'time' && (
              <div className="p-8 md:p-12">
                <div className="flex items-center gap-3 mb-8">
                  <button onClick={goBack} className="w-8 h-8 rounded-full border border-[#e8dfd6] flex items-center justify-center hover:border-[#b76e79] hover:text-[#b76e79] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div>
                    <h3 className="text-xl font-medium text-[#2d2d2d]">Escolha o horário</h3>
                    <p className="text-sm text-[#8a8580]">{selectedDate && formatDateDisplay(selectedDate)} — {selectedService?.name}</p>
                  </div>
                </div>

                {/* Time slot sections */}
                {(() => {
                  const morning = timeSlots.filter(s => parseInt(s.time) < 12)
                  const afternoon = timeSlots.filter(s => parseInt(s.time) >= 13 && parseInt(s.time) < 18)
                  const evening = timeSlots.filter(s => parseInt(s.time) >= 18)

                  return (
                    <div className="space-y-6">
                      {[
                        { label: 'Manhã', icon: '☀️', slots: morning },
                        { label: 'Tarde', icon: '🌤️', slots: afternoon },
                        { label: 'Noite', icon: '🌙', slots: evening },
                      ].map(period => {
                        if (period.slots.length === 0) return null
                        return (
                          <div key={period.label}>
                            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#8a8580] mb-3">
                              {period.icon} {period.label}
                            </p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                              {period.slots.map(slot => (
                                <button
                                  key={slot.time}
                                  disabled={!slot.available}
                                  onClick={() => { setSelectedTime(slot.time); setStep('login') }}
                                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                                    selectedTime === slot.time
                                      ? 'bg-[#b76e79] text-white shadow-lg shadow-[#b76e79]/20'
                                      : slot.available
                                        ? 'bg-[#faf9f7] border border-[#e8dfd6] text-[#2d2d2d] hover:border-[#b76e79] hover:text-[#b76e79]'
                                        : 'bg-[#f5f0eb]/50 text-[#e8dfd6] cursor-not-allowed line-through'
                                  }`}
                                >
                                  {slot.time}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {timeSlots.length === 0 && !loading && (
                  <div className="text-center py-12 text-[#8a8580]">
                    <p className="text-lg mb-2">Nenhum horário disponível</p>
                    <p className="text-sm">Tente outra data</p>
                  </div>
                )}
              </div>
            )}

            {/* ===== STEP 4: LOGIN CTA ===== */}
            {step === 'login' && (
              <div className="p-8 md:p-12">
                <div className="flex items-center gap-3 mb-8">
                  <button onClick={goBack} className="w-8 h-8 rounded-full border border-[#e8dfd6] flex items-center justify-center hover:border-[#b76e79] hover:text-[#b76e79] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div>
                    <h3 className="text-xl font-medium text-[#2d2d2d]">Quase lá!</h3>
                    <p className="text-sm text-[#8a8580]">Faça login para confirmar o agendamento</p>
                  </div>
                </div>

                {/* Summary card */}
                <div className="bg-[#faf9f7] rounded-2xl p-5 mb-8 border border-[#e8dfd6]/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#b76e79]/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#b76e79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-[#2d2d2d]">{selectedService?.name}</p>
                      <p className="text-sm text-[#8a8580]">{selectedDate && formatDateDisplay(selectedDate)} às {selectedTime}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-lg font-semibold text-[#b76e79]">{selectedService && formatCurrency(selectedService.price)}</p>
                      <p className="text-[10px] text-[#8a8580] uppercase">{selectedService?.duration} min</p>
                    </div>
                  </div>
                </div>

                {/* Login/Register CTA */}
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#b76e79]/10 flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-[#b76e79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-[#2d2d2d] mb-2">Acesse sua conta para agendar</h4>
                    <p className="text-sm text-[#8a8580] max-w-md mx-auto">
                      Para sua segurança e melhor experiência, o agendamento é feito através da sua área de cliente. 
                      Cadastre-se rápido com Google, Instagram ou e-mail.
                    </p>
                  </div>

                  <div className="space-y-3 max-w-sm mx-auto">
                    <Link
                      href="/cliente/agendar"
                      className="w-full py-4 px-6 bg-[#b76e79] text-white text-[13px] font-semibold tracking-[0.1em] uppercase rounded-full hover:bg-[#8c4f58] transition-all duration-500 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Entrar e Agendar
                    </Link>
                    <Link
                      href="/cliente"
                      className="w-full py-3.5 px-6 bg-white text-[#b76e79] text-[12px] font-semibold tracking-[0.1em] uppercase rounded-full border-2 border-[#b76e79]/30 hover:border-[#b76e79] hover:bg-[#b76e79]/5 transition-all duration-400 flex items-center justify-center gap-2"
                    >
                      Criar Conta Grátis
                    </Link>
                  </div>

                  <div className="flex items-center gap-4 justify-center text-[#8a8580] text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Rápido e seguro
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Acompanhe seus agendamentos
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
