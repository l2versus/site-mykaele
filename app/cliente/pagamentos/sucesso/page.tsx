'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading')
  const [message, setMessage] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const preferenceId = searchParams.get('preference_id')
  const mpStatus = searchParams.get('status')

  useEffect(() => {
    const processPayment = async () => {
      try {
        if (!preferenceId) {
          setStatus('error')
          setMessage('Preference ID não encontrado')
          return
        }

        const response = await fetch(
          `/api/payments/success?preference_id=${encodeURIComponent(preferenceId)}`,
          { method: 'GET', credentials: 'include' }
        )

        if (response.ok) {
          setStatus('success')
          setMessage('Seus créditos foram ativados!')
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 4000)
        } else {
          const error = await response.json()
          setStatus('error')
          setMessage(error.error || 'Erro ao processar pagamento')
        }
      } catch {
        setStatus('error')
        setMessage('Erro ao conectar ao servidor')
      }
    }

    if (mpStatus === 'approved' || mpStatus === 'pending') {
      processPayment()
    } else if (mpStatus === 'failure') {
      setStatus('error')
      setMessage('Pagamento rejeitado. Tente novamente.')
    } else {
      setStatus('pending')
      setMessage('Processando pagamento...')
      processPayment()
    }
  }, [preferenceId, mpStatus, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0e0b10] to-[#0a0a0a] relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] bg-[#b76e79]/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[250px] h-[250px] bg-[#d4a0a7]/[0.02] rounded-full blur-[100px] pointer-events-none" />

      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: '-8px',
                backgroundColor: ['#b76e79', '#d4a0a7', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'][i % 6],
                animation: `confetti-fall ${2 + Math.random() * 2}s ease-in ${Math.random() * 1.5}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-lg w-full mx-4">
        {/* Loading */}
        {status === 'loading' && (
          <div className="text-center space-y-5">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-[#b76e79]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-[#b76e79] border-t-transparent animate-spin" />
            </div>
            <div>
              <p className="text-white/80 font-medium">Processando seu pagamento...</p>
              <p className="text-white/30 text-xs mt-1">Isso pode levar alguns segundos</p>
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="text-center space-y-6 animate-[fadeIn_0.6s_ease-out]">
            {/* Success icon */}
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping opacity-20" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                <svg width="40" height="40" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-light text-white/95 tracking-tight">Compra Confirmada! 🎉</h1>
              <p className="text-white/40 text-sm mt-2">{message}</p>
            </div>

            {/* What to do next */}
            <div className="relative overflow-hidden rounded-3xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
              <div className="relative border border-white/[0.08] rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">✨</span>
                  <h3 className="text-white/80 text-sm font-medium">O que deseja fazer agora?</h3>
                </div>

                {/* Primary CTA: Agendar */}
                <Link href="/cliente/agendar"
                  className="group relative w-full flex items-center gap-4 p-4 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#b76e79] to-[#c28a93] opacity-90 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <div className="relative flex items-center gap-4 w-full">
                    <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <svg width="24" height="24" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <path d="M12 14v4m-2-2h4" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-semibold text-sm">Agendar minha sessão agora</div>
                      <div className="text-white/70 text-xs mt-0.5">Use seus créditos recém-adquiridos</div>
                    </div>
                    <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0 group-hover:translate-x-1 transition-transform">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                {/* Secondary: Ver créditos */}
                <Link href="/cliente/creditos"
                  className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <svg width="22" height="22" fill="none" stroke="#10b981" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-white/80 font-medium text-sm">Ver meus créditos</div>
                    <div className="text-white/30 text-xs mt-0.5">Confira seu saldo atualizado</div>
                  </div>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-white/20 shrink-0">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>

                {/* Tertiary: Voltar ao início */}
                <Link href="/cliente"
                  className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-white/50">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-white/80 font-medium text-sm">Voltar ao início</div>
                    <div className="text-white/30 text-xs mt-0.5">Ir para o painel do cliente</div>
                  </div>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-white/20 shrink-0">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* WhatsApp badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/10 border border-[#25D366]/20">
              <svg width="14" height="14" fill="#25D366" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span className="text-[#25D366] text-[11px] font-medium">Mykaele foi notificada da sua compra</span>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="text-center space-y-6 animate-[fadeIn_0.5s_ease-out]">
            <div className="relative w-20 h-20 mx-auto">
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-red-500/15 to-red-600/10 border border-red-500/20 flex items-center justify-center">
                <svg width="32" height="32" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-light text-white/90">Erro no Pagamento</h1>
              <p className="text-white/40 text-sm mt-2">{message}</p>
            </div>
            <div className="space-y-3">
              <Link href="/cliente/creditos"
                className="block w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-sm font-medium text-center shadow-lg shadow-[#b76e79]/15 hover:shadow-[#b76e79]/25 transition-all">
                Tentar Novamente
              </Link>
              <a href="https://wa.me/5585999086924?text=Ol%C3%A1%20Mykaele!%20Tive%20um%20problema%20no%20pagamento"
                target="_blank" rel="noopener noreferrer"
                className="block w-full py-3.5 rounded-2xl border border-white/[0.08] text-white/60 text-sm font-medium text-center hover:bg-white/[0.03] transition-all">
                Falar com Mykaele no WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Pending */}
        {status === 'pending' && (
          <div className="text-center space-y-5 animate-[fadeIn_0.5s_ease-out]">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            </div>
            <div>
              <h1 className="text-lg font-light text-white/90">Aguardando Confirmação</h1>
              <p className="text-white/40 text-sm mt-2">Seu pagamento está sendo processado...</p>
              <p className="text-white/25 text-xs mt-1">Isso pode levar alguns minutos para PIX/boleto</p>
            </div>
            <Link href="/cliente"
              className="inline-block px-6 py-3 rounded-2xl border border-white/[0.08] text-white/50 text-sm font-medium hover:bg-white/[0.03] transition-all">
              Ir para o Painel
            </Link>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
