'use client'

import { useClient } from '../ClientContext'
import { useCart } from '../CartContext'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { InfoTooltip } from '@/components/InfoTooltip'
import { SessionTicket } from '@/components/SessionTicket'

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface ServiceData {
  id: string
  name: string
  description: string | null
  price: number
  isAddon: boolean
  packageOptions: PackageOptionData[]
}

interface PackageOptionData {
  id: string
  name: string
  sessions: number
  price: number
  serviceId: string
}

interface MyPackage {
  id: string
  totalSessions: number
  usedSessions: number
  status: string
  expirationDate?: string
  packageOption: {
    name: string
    sessions: number
    serviceId: string
    service: { name: string }
  }
}

export default function CreditosPage() {
  const { user, fetchWithAuth } = useClient()
  const { addItem } = useCart()
  const [services, setServices] = useState<ServiceData[]>([])
  const [packages, setPackages] = useState<MyPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [toast, setToast] = useState('')
  const [contactModal, setContactModal] = useState(false)
  const [contactType, setContactType] = useState<'whatsapp' | 'email'>('whatsapp')
  const [message, setMessage] = useState('')
  const [clinicWhatsapp, setClinicWhatsapp] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const [pkgRes, svcRes, settingsRes] = await Promise.all([
          fetchWithAuth('/api/patient/packages'),
          fetchWithAuth('/api/services'),
          fetch('/api/admin/settings'),
        ])
        if (pkgRes.ok) {
          const data = await pkgRes.json()
          setPackages(data.packages || data || [])
        }
        if (svcRes.ok) {
          const raw = await svcRes.json()
          const svcs: ServiceData[] = Array.isArray(raw) ? raw : (raw.services || [])
          setServices(svcs)
          if (svcs.length > 0) setSelectedServiceId(svcs[0].id)
        }
        if (settingsRes.ok) {
          const { settings } = await settingsRes.json()
          if (settings?.whatsapp) {
            const clean = settings.whatsapp.replace(/\D/g, '')
            setClinicWhatsapp(clean.startsWith('55') ? clean : `55${clean}`)
          }
        }
      } catch { /* */ }
      setLoading(false)
    })()
  }, [fetchWithAuth])

  const selectedService = services.find(s => s.id === selectedServiceId)
  const activePackages = packages.filter(p => p.status === 'ACTIVE')

  // Calcula economia: preço avulso * sessions - preço pacote
  const getEconomy = (opt: PackageOptionData) => {
    if (!selectedService) return 0
    return Math.max(0, (selectedService.price * opt.sessions) - opt.price)
  }

  const addToCart = (opt: { id: string; name: string; price: number; sessions: number; serviceId: string; serviceName: string }) => {
    addItem({
      id: opt.id,
      packageOptionId: opt.id,
      name: opt.name,
      sessions: opt.sessions,
      price: opt.price,
      serviceId: opt.serviceId,
      serviceName: opt.serviceName,
    })
    setToast(opt.name)
    setTimeout(() => setToast(''), 2500)
  }

  const handleContact = () => {
    if (contactType === 'whatsapp') {
      const text = `Olá Myka! Tenho dúvida sobre meus créditos. ${message}`
      const encodedText = encodeURIComponent(text)
      const waNumber = clinicWhatsapp || '5585999086924'
      window.open(`https://wa.me/${waNumber}?text=${encodedText}`, '_blank')
    } else if (contactType === 'email') {
      window.location.href = `mailto:mykaele@spa.com?subject=Dúvida sobre Créditos&body=${encodeURIComponent(message)}`
    }
    setContactModal(false)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
      {/* Seção de compra de créditos */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6 mb-8 bg-white/[0.01]">
        <h2 className="text-white/90 text-xl font-bold mb-2">Comprar Créditos</h2>
        <p className="text-white/50 text-sm mb-4">Escolha o serviço e selecione sessão avulsa ou pacote com desconto.</p>

        {services.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-white/25 text-sm">Nenhum serviço disponível no momento</p>
          </div>
        ) : (
          <>
            {/* Tabs de serviços */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {services.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => setSelectedServiceId(svc.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedServiceId === svc.id
                      ? 'bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] text-white'
                      : 'bg-white/[0.05] text-white/60 hover:text-white/90 border border-white/10'
                  }`}
                >
                  {svc.name}
                </button>
              ))}
            </div>

            {selectedService && (
              <div className="space-y-4">
                {selectedService.description && (
                  <p className="text-white/40 text-xs">{selectedService.description}</p>
                )}

                {/* Sessão Avulsa (preço unitário do serviço = 1 sessão) */}
                <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white/90 font-semibold">Sessão Avulsa</h3>
                      <p className="text-white/50 text-sm">1 sessão</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/90 text-xl font-bold">{fmtCur(selectedService.price)}</p>
                      <button
                        onClick={() => addToCart({
                          id: `avulso_${selectedService.id}`,
                          name: `${selectedService.name} - Avulso`,
                          price: selectedService.price,
                          sessions: 1,
                          serviceId: selectedService.id,
                          serviceName: selectedService.name,
                        })}
                        className="mt-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] text-white text-sm font-bold shadow hover:opacity-90 transition-all"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pacotes do banco */}
                {selectedService.packageOptions.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {selectedService.packageOptions.map(opt => {
                      const economy = getEconomy(opt)
                      return (
                        <div key={opt.id} className="border border-emerald-500/20 rounded-xl p-4 bg-emerald-500/[0.03] relative overflow-hidden">
                          {economy > 0 && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                              Economia {fmtCur(economy)}
                            </div>
                          )}
                          <h3 className="text-white/90 font-semibold">{opt.name}</h3>
                          <p className="text-white/50 text-sm mb-2">{opt.sessions} sessões</p>
                          <p className="text-emerald-400 text-xl font-bold">{fmtCur(opt.price)}</p>
                          <p className="text-white/40 text-xs">{fmtCur(opt.price / opt.sessions)}/sessão</p>
                          <button
                            onClick={() => addToCart({
                              id: opt.id,
                              name: `${selectedService.name} - ${opt.name}`,
                              price: opt.price,
                              sessions: opt.sessions,
                              serviceId: selectedService.id,
                              serviceName: selectedService.name,
                            })}
                            className="mt-3 w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold shadow hover:bg-emerald-700 transition-all"
                          >
                            Adicionar ao carrinho
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast de feedback */}
      {toast && (
        <div className="fixed bottom-36 right-4 z-50 animate-[slideUp_0.3s_ease-out] flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-600/95 backdrop-blur-sm shadow-xl shadow-emerald-900/30 border border-emerald-500/30">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            <p className="text-white text-xs font-semibold">Adicionado ao carrinho!</p>
            <p className="text-emerald-200/70 text-[10px] truncate max-w-[200px]">{toast}</p>
          </div>
        </div>
      )}

      {/* Meus Créditos Ativos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white/90 text-sm font-semibold">Meus Créditos Ativos <InfoTooltip text="Pacotes que você comprou e ainda tem sessões para usar. Agende diretamente pelo app!" /></h3>
          <button onClick={() => setContactModal(true)} className="px-4 py-2 rounded-xl border border-white/15 text-white/60 hover:text-white text-xs font-medium transition-all">
            💬 Dúvida?
          </button>
        </div>
        {activePackages.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-white/25 text-sm">Nenhum crédito disponível</p>
            <a href="#comprar" className="text-[#d4a0a7] text-xs mt-2 inline-block hover:underline" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
              Adquirir créditos →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activePackages.map(pkg => (
              <SessionTicket
                key={pkg.id}
                serviceName={pkg.packageOption.service.name}
                remaining={pkg.totalSessions - pkg.usedSessions}
                total={pkg.totalSessions}
                expirationDate={pkg.expirationDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/cliente/agendar" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06]" />
          <div className="relative border border-white/[0.06] rounded-2xl p-4 text-center">
            <div className="text-2xl mb-2">📅</div>
            <div className="text-white/70 text-xs font-medium group-hover:text-white/90 transition-colors">Agendar Sessão</div>
          </div>
        </Link>
        <button onClick={() => setContactModal(true)} className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06]" />
          <div className="relative border border-white/[0.06] rounded-2xl p-4 text-center">
            <div className="text-2xl mb-2">💬</div>
            <div className="text-white/70 text-xs font-medium group-hover:text-white/90 transition-colors">Enviar Mensagem</div>
          </div>
        </button>
      </div>

      {/* Contact Modal */}
      {contactModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e0b10] border border-[#b76e79]/20 rounded-3xl p-6 max-w-md w-full space-y-4 animate-[slideUp_0.3s_ease-out]">
            <h3 className="text-white/90 font-semibold">Como prefere entrar em contato?</h3>

            <div className="space-y-2">
              <button
                onClick={() => setContactType('whatsapp')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  contactType === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/[0.06] hover:border-white/[0.10]'
                }`}
              >
                <div className="font-medium text-white/90">💬 WhatsApp</div>
                <div className="text-xs text-white/40 mt-1">{user?.phone || 'Sem número'}</div>
              </button>

              <button
                onClick={() => setContactType('email')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  contactType === 'email'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/[0.06] hover:border-white/[0.10]'
                }`}
              >
                <div className="font-medium text-white/90">📧 Email</div>
                <div className="text-xs text-white/40 mt-1">mykaele@spa.com</div>
              </button>
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.07] rounded-xl text-white placeholder-white/15 focus:outline-none focus:border-[#b76e79]/40 resize-none text-sm"
              rows={3}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setContactModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/[0.06] text-white/60 hover:text-white text-sm font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleContact}
                disabled={!message.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
