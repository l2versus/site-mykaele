'use client'

import { useClient } from '../ClientContext'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// Serviços e pacotes disponíveis para compra de créditos
const creditOptions = {
  metodo: {
    name: 'Método Mykaele Procópio',
    description: 'Protocolo exclusivo de remodelação corporal',
    avulso: { price: 330, sessions: 1 },
    pacotes: [
      { id: 'm5', name: 'Pacote 5 sessões', sessions: 5, price: 1500, economy: 150 },
      { id: 'm10', name: 'Pacote 10 sessões', sessions: 10, price: 2800, economy: 500 },
    ]
  },
  massagem: {
    name: 'Massagem Relaxante',
    description: 'Massagem terapêutica de relaxamento profundo',
    avulso: { price: 280, sessions: 1 },
    pacotes: [
      { id: 'r5', name: 'Pacote 5 sessões', sessions: 5, price: 1300, economy: 100 },
      { id: 'r10', name: 'Pacote 10 sessões', sessions: 10, price: 2500, economy: 300 },
    ]
  },
  adicional: {
    name: 'Manta Térmica (Adicional)',
    description: 'Potencialize seu tratamento com 30 minutos de manta térmica',
    avulso: { price: 80, sessions: 1 },
    pacotes: []
  }
}

interface Package {
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

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString('pt-BR') : 'Sem expiração'

export default function CreditosPage() {
  const { user, fetchWithAuth } = useClient()
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [contactModal, setContactModal] = useState(false)
  const [contactType, setContactType] = useState<'whatsapp' | 'email'>('whatsapp')
  const [message, setMessage] = useState('')
  // Carrinho de créditos
  const [cart, setCart] = useState<any[]>([])
  const [selectedService, setSelectedService] = useState<'metodo' | 'massagem' | 'adicional'>('metodo')
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [cartBounce, setCartBounce] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  
  // Adiciona item ao carrinho com feedback visual
  const addToCart = (item: any) => {
    setCart(prev => [...prev, item]);
    setToast(item.name);
    setCartBounce(true);
    setTimeout(() => setToast(''), 2500);
    setTimeout(() => setCartBounce(false), 600);
  };
  
  // Remove item do carrinho
  const removeFromCart = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
  };
  
  // Total do carrinho
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const cartSessions = cart.reduce((sum, item) => sum + item.sessions, 0);

  // Finalizar compra via Mercado Pago
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const items = cart.map((item, idx) => ({
        packageOptionId: `credit_${idx}_${Date.now()}`,
        name: item.name,
        sessions: item.sessions,
        price: item.price,
        serviceName: item.name,
      }));
      const res = await fetchWithAuth('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || 'Erro ao processar pagamento');
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setCheckoutError('URL de pagamento n\u00e3o recebida');
      }
    } catch {
      setCheckoutError('Erro de conex\u00e3o. Tente novamente.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/api/patient/packages')
        if (res.ok) {
          const data = await res.json()
          setPackages(data.packages || data || [])
        }
      } catch { /* */ }
      setLoading(false)
    })()
  }, [fetchWithAuth])

  const activePackages = packages.filter(p => p.status === 'ACTIVE')
  const totalSessions = activePackages.reduce((sum, p) => sum + (p.totalSessions - p.usedSessions), 0)

  const handleContact = () => {
    if (contactType === 'whatsapp' && user?.phone) {
      const text = `Olá Mykaele! Tenho dúvida sobre meus créditos. ${message}`
      const encodedText = encodeURIComponent(text)
      window.open(`https://wa.me/55${user.phone.replace(/\D/g, '')}?text=${encodedText}`, '_blank')
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
      {/* NOVO: Seção de compra de créditos */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6 mb-8 bg-white/[0.01]">
        <h2 className="text-white/90 text-xl font-bold mb-2">Comprar Créditos</h2>
        <p className="text-white/50 text-sm mb-4">Escolha o serviço e selecione sessão avulsa ou pacote com desconto.</p>
        
        {/* Tabs de serviços */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {Object.entries(creditOptions).map(([key, svc]) => (
            <button
              key={key}
              onClick={() => setSelectedService(key as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedService === key
                  ? 'bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] text-white'
                  : 'bg-white/[0.05] text-white/60 hover:text-white/90 border border-white/10'
              }`}
            >
              {svc.name}
            </button>
          ))}
        </div>
        
        {/* Serviço selecionado */}
        <div className="space-y-4">
          <p className="text-white/40 text-xs">{creditOptions[selectedService].description}</p>
          
          {/* Sessão Avulsa */}
          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white/90 font-semibold">Sessão Avulsa</h3>
                <p className="text-white/50 text-sm">1 sessão</p>
              </div>
              <div className="text-right">
                <p className="text-white/90 text-xl font-bold">R$ {creditOptions[selectedService].avulso.price.toFixed(2)}</p>
                <button 
                  onClick={() => addToCart({ 
                    name: `${creditOptions[selectedService].name} - Avulso`, 
                    price: creditOptions[selectedService].avulso.price,
                    sessions: 1 
                  })} 
                  className="mt-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] text-white text-sm font-bold shadow hover:opacity-90 transition-all"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
          
          {/* Pacotes */}
          {creditOptions[selectedService].pacotes.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {creditOptions[selectedService].pacotes.map((pkg) => (
                <div key={pkg.id} className="border border-emerald-500/20 rounded-xl p-4 bg-emerald-500/[0.03] relative overflow-hidden">
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    Economia R$ {pkg.economy}
                  </div>
                  <h3 className="text-white/90 font-semibold">{pkg.name}</h3>
                  <p className="text-white/50 text-sm mb-2">{pkg.sessions} sessões</p>
                  <p className="text-emerald-400 text-xl font-bold">R$ {pkg.price.toFixed(2)}</p>
                  <p className="text-white/40 text-xs">R$ {(pkg.price / pkg.sessions).toFixed(0)}/sessão</p>
                  <button 
                    onClick={() => addToCart({ 
                      name: `${creditOptions[selectedService].name} - ${pkg.name}`, 
                      price: pkg.price,
                      sessions: pkg.sessions 
                    })} 
                    className="mt-3 w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold shadow hover:bg-emerald-700 transition-all"
                  >
                    Adicionar ao carrinho
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>

      {/* ═══ Botão flutuante do carrinho ═══ */}
      <button
        onClick={() => setCartOpen(true)}
        className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-2xl transition-all duration-300 ${
          cart.length > 0
            ? 'bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] shadow-[#b76e79]/40 hover:shadow-[#b76e79]/60 hover:scale-105'
            : 'bg-white/10 backdrop-blur-xl border border-white/15 hover:bg-white/15'
        } ${cartBounce ? 'scale-110' : ''}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        {cart.length > 0 ? (
          <>
            <span className="text-white font-bold text-sm">{fmtCur(cartTotal)}</span>
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/25 text-white text-xs font-bold">{cart.length}</span>
          </>
        ) : (
          <span className="text-white/70 text-sm font-medium">Carrinho</span>
        )}
      </button>

      {/* ═══ Toast de feedback ═══ */}
      {toast && (
        <div className="fixed bottom-24 right-6 z-50 animate-[slideUp_0.3s_ease-out] flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-600/95 backdrop-blur-sm shadow-xl shadow-emerald-900/30 border border-emerald-500/30">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            <p className="text-white text-xs font-semibold">Adicionado ao carrinho!</p>
            <p className="text-emerald-200/70 text-[10px] truncate max-w-[200px]">{toast}</p>
          </div>
        </div>
      )}

      {/* ═══ Drawer lateral do carrinho ═══ */}
      {cartOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setCartOpen(false)}>
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
          
          {/* Drawer */}
          <div
            className="absolute top-0 right-0 h-full w-full max-w-md bg-[#0e0b10]/98 backdrop-blur-xl border-l border-white/10 shadow-2xl animate-[slideInRight_0.3s_ease-out] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a0a7]/20 to-[#b76e79]/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#d4a0a7]">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-white/90 font-semibold text-sm">Seu Carrinho</h3>
                  <p className="text-white/40 text-[10px]">{cart.length} item(s) · {cartSessions} sessão(ões)</p>
                </div>
              </div>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                  </div>
                  <p className="text-white/25 text-sm">Carrinho vazio</p>
                  <p className="text-white/15 text-xs mt-1">Adicione créditos para começar</p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="group relative bg-white/[0.03] hover:bg-white/[0.05] rounded-xl p-4 border border-white/[0.06] transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-white/90 text-sm font-medium truncate">{item.name}</p>
                        <p className="text-white/30 text-xs mt-0.5">{item.sessions} sessão(ões)</p>
                      </div>
                      <div className="flex items-center gap-2.5 ml-3">
                        <p className="text-white font-bold text-sm">{fmtCur(item.price)}</p>
                        <button
                          onClick={() => removeFromCart(idx)}
                          className="w-7 h-7 rounded-lg bg-red-500/0 hover:bg-red-500/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer com total e botão de compra */}
            {cart.length > 0 && (
              <div className="border-t border-white/10 px-6 py-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>Subtotal ({cart.length} item{cart.length > 1 ? 's' : ''})</span>
                    <span>{fmtCur(cartTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 font-semibold">Total</span>
                    <span className="text-white text-2xl font-bold">{fmtCur(cartTotal)}</span>
                  </div>
                </div>
                <button 
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] text-white font-bold shadow-lg shadow-[#b76e79]/25 hover:shadow-[#b76e79]/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2">
                  {checkoutLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processando...</>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Finalizar Compra
                    </>
                  )}
                </button>
                {checkoutError && (
                  <p className="text-red-400 text-[11px] text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{checkoutError}</p>
                )}
                <p className="text-white/25 text-[10px] text-center">PIX · Cartão de crédito · Boleto · Mercado Pago</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Header com Saldo */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-[#b76e79]/40 via-[#d4a0a7]/30 to-[#8b4a52]/20" />
        <div className="relative border border-white/15 rounded-3xl p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-1">Saldo de Créditos</h2>
              <h1 className="text-white/98 font-bold text-4xl lg:text-5xl">{totalSessions}</h1>
              <p className="text-white/60 text-sm mt-2">Sessões disponíveis para agendar</p>
            </div>
            <div className="flex gap-3">
              <a href="#comprar" className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] text-white text-sm font-bold shadow-lg shadow-[#b76e79]/25 hover:shadow-[#b76e79]/35 transition-all" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                Comprar mais créditos
              </a>
              <button onClick={() => setContactModal(true)} className="px-6 py-3 rounded-xl border border-white/20 text-white/80 hover:text-white text-sm font-medium transition-all">
                💬 Dúvida?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Meus Créditos */}
      <div className="space-y-3">
        <h3 className="text-white/90 text-sm font-semibold">Meus Créditos Ativos</h3>
        {activePackages.length === 0 ? (
          <div className="text-center py-8 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-white/25 text-sm">Nenhum crédito disponível</p>
            <a href="#comprar" className="text-[#d4a0a7] text-xs mt-2 inline-block hover:underline" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
              Adquirir créditos →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {activePackages.map(pkg => {
              const used = pkg.usedSessions
              const total = pkg.totalSessions
              const remaining = total - used
              const progress = Math.round((used / total) * 100)
              
              return (
                <div key={pkg.id} className="relative overflow-hidden rounded-2xl group hover:scale-[1.01] transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06]" />
                  <div className="relative border border-white/[0.06] rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-white/90 font-semibold text-sm">{pkg.packageOption.name}</h4>
                        <p className="text-white/25 text-xs mt-1">{pkg.packageOption.service.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-bold text-lg">{remaining}</div>
                        <div className="text-white/25 text-[10px]">de {total}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-2 bg-white/[0.05] rounded-full overflow-hidden mb-3">
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                        style={{ width: `${progress}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white/40">
                      <span>{used} usado{used !== 1 ? 's' : ''}</span>
                      <span>Válido até {fmtDate(pkg.expirationDate)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
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
