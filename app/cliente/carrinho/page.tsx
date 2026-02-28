'use client'

import { useCart } from '../CartContext'
import { useRouter } from 'next/navigation'
import { useClient } from '../ClientContext'
import { useState } from 'react'
import Link from 'next/link'

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function CarrinhoPage() {
  const { items, removeItem, clearCart, total } = useCart()
  const { fetchWithAuth } = useClient()
  const router = useRouter()
  const [processing, setProcessing] = useState(false)

  const handleCheckout = async () => {
    if (items.length === 0) return
    
    setProcessing(true)
    try {
      // Create checkout for multiple items
      const checkoutRes = await fetchWithAuth('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ 
          packageOptionIds: items.map(i => i.packageOptionId),
          items: items,
        }),
      })
      
      if (checkoutRes.ok) {
        const { checkoutUrl } = await checkoutRes.json()
        if (checkoutUrl) {
          window.location.href = checkoutUrl
          return
        }
      }
      
      alert('Erro ao processar carrinho. Tente novamente.')
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Erro ao processar carrinho.')
    } finally {
      setProcessing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="space-y-5 animate-[fadeIn_0.5s_ease-out]">
        <h1 className="text-xl font-light text-white/90 tracking-tight">Carrinho</h1>
        <div className="text-center py-16">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-white/15">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </div>
          <p className="text-white/25 text-sm">Seu carrinho está vazio</p>
          <Link href="/cliente/pacotes" className="mt-2 inline-block text-[#d4a0a7] text-xs hover:underline">
            Continuar comprando
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-[fadeIn_0.5s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light text-white/90 tracking-tight">Carrinho</h1>
          <p className="text-[#c28a93]/40 text-[10px] mt-0.5 tracking-wide">{items.length} protocolo(s)</p>
        </div>
        <button
          onClick={clearCart}
          className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
        >
          Limpar carrinho
        </button>
      </div>

      {/* Cart Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.packageOptionId} className="relative overflow-hidden rounded-2xl group hover:scale-[1.01] transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06] group-hover:to-white/[0.02] transition-all" />
            <div className="relative border border-white/[0.06] group-hover:border-white/[0.10] rounded-2xl p-5 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-white/90 font-medium text-sm tracking-tight">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/25 text-[11px]">{item.serviceName}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-white/25 text-[11px]">{item.sessions} sessões</span>
                  </div>
                  <div className="text-white/15 text-[10px] mt-1">{fmtCur(item.price / item.sessions)} por sessão</div>
                </div>
                <div className="text-right space-y-2">
                  <div className="text-[#d4a0a7] font-bold text-lg">{fmtCur(item.price)}</div>
                  <button
                    onClick={() => removeItem(item.packageOptionId)}
                    className="text-red-400/60 hover:text-red-400 text-[10px] transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="border-t border-white/[0.06] pt-5 space-y-3">
        <div className="flex justify-between text-white/60 text-sm">
          <span>Subtotal</span>
          <span>{fmtCur(total)}</span>
        </div>
        <div className="flex justify-between text-white/60 text-sm">
          <span>Taxas</span>
          <span>{fmtCur(0)}</span>
        </div>
        <div className="flex justify-between text-white/90 text-base font-medium border-t border-white/[0.06] pt-3">
          <span>Total</span>
          <span>{fmtCur(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={handleCheckout}
          disabled={processing}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-sm font-medium shadow-lg shadow-[#b76e79]/10 hover:shadow-[#b76e79]/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Ir para Pagamento
            </>
          )}
        </button>
        <Link
          href="/cliente/pacotes"
          className="block w-full py-3 rounded-xl border border-white/[0.06] text-white/60 hover:text-white/90 text-sm font-medium text-center transition-colors"
        >
          Continuar Comprando
        </Link>
      </div>
    </div>
  )
}
