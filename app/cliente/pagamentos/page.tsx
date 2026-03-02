'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useClient } from '../ClientContext'

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface PaymentRecord {
  id: number; date: string; time: string; status: string; price: number
  paymentMethod: string | null; paymentStatus: string | null; serviceName: string
}

export default function PagamentosPage() {
  const { fetchWithAuth } = useClient()
  const [appointments, setAppointments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/patient/appointments')
      if (res.ok) {
        const data = await res.json()
        const list = (Array.isArray(data) ? data : data.appointments || []) as PaymentRecord[]
        setAppointments(list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  const filtered = appointments.filter(a => {
    if (filter === 'paid') return a.paymentStatus === 'PAID' || a.status === 'COMPLETED'
    if (filter === 'pending') return a.paymentStatus !== 'PAID' && a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
    return true
  })

  const totalPaid = appointments.filter(a => a.paymentStatus === 'PAID' || a.status === 'COMPLETED').reduce((s, a) => s + a.price, 0)
  const totalPending = appointments.filter(a => a.paymentStatus !== 'PAID' && a.status !== 'COMPLETED' && a.status !== 'CANCELLED').reduce((s, a) => s + a.price, 0)

  const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
    COMPLETED: { label: 'Concluido', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    CONFIRMED: { label: 'Confirmado', bg: 'bg-blue-50', text: 'text-blue-600' },
    PENDING: { label: 'Pendente', bg: 'bg-amber-50', text: 'text-amber-600' },
    CANCELLED: { label: 'Cancelado', bg: 'bg-stone-100', text: 'text-stone-400' },
    NO_SHOW: { label: 'Falta', bg: 'bg-red-50', text: 'text-red-500' },
  }

  const methodLabels: Record<string, string> = {
    PIX: 'Pix', CASH: 'Dinheiro', CREDIT_CARD: 'Credito', DEBIT_CARD: 'Debito',
    CREDIT: 'Credito', DEBIT: 'Debito', TRANSFER: 'Transf.', PACKAGE: 'Pacote'
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Meus Pagamentos</h1>
        <p className="text-stone-400 text-xs mt-0.5">Historico financeiro dos seus atendimentos</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <div className="text-stone-400 text-[10px] font-semibold uppercase tracking-wider">Total Pago</div>
          <div className="text-emerald-600 text-lg font-bold mt-0.5">{fmtCur(totalPaid)}</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="text-stone-400 text-[10px] font-semibold uppercase tracking-wider">Pendente</div>
          <div className="text-amber-600 text-lg font-bold mt-0.5">{fmtCur(totalPending)}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: 'all' as const, label: 'Todos' },
          { key: 'paid' as const, label: 'Pagos' },
          { key: 'pending' as const, label: 'Pendentes' }
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === f.key ? 'bg-[#b76e79] text-white' : 'bg-white text-stone-500 border border-stone-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-100">
          <div className="text-2xl mb-2">💳</div>
          <p className="text-stone-400 text-sm">Nenhum pagamento encontrado</p>
          <Link href="/cliente/agendar" className="text-[#b76e79] text-sm font-medium mt-2 inline-block hover:underline">
            Agendar agora
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const st = statusLabels[a.status] || statusLabels.PENDING
            return (
              <div key={a.id} className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-stone-800 font-semibold text-sm">{a.serviceName}</div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {a.time && ` · ${a.time}`}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                      {a.paymentMethod && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 font-medium">
                          {methodLabels[a.paymentMethod] || a.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-stone-800 font-bold text-sm">{fmtCur(a.price)}</div>
                    {(a.paymentStatus === 'PAID' || a.status === 'COMPLETED') && (
                      <div className="text-emerald-500 text-[10px] font-semibold mt-0.5">PAGO</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
