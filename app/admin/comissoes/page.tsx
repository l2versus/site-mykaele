'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../AdminContext'
import { formatPaymentMethod } from '@/utils/format'

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface Appointment {
  id: number; date: string; time: string; status: string; price: number; paymentMethod: string | null
  serviceName: string; userName: string
}

export default function ComissoesPage() {
  const { fetchWithAuth } = useAdmin()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])

  // Commission config
  const PROFESSIONAL_RATE = 0.40 // 40% para profissional
  const CARD_FEE_RATE = 0.0499    // 4.99% taxa cartao
  const TAX_RATE = 0.06           // 6% imposto

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/admin/appointments?from=${from}&to=${to}&status=COMPLETED`)
      if (res.ok) {
        const data = await res.json()
        setAppointments(Array.isArray(data) ? data : data.appointments || [])
      }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth, from, to])

  useEffect(() => { load() }, [load])

  const calcCommission = (price: number, method: string | null) => {
    const isCard = method && ['CREDIT_CARD', 'DEBIT_CARD', 'CREDIT', 'DEBIT'].includes(method)
    const cardFee = isCard ? price * CARD_FEE_RATE : 0
    const tax = price * TAX_RATE
    const net = price - cardFee - tax
    const professional = net * PROFESSIONAL_RATE
    const clinic = net - professional
    return { cardFee, tax, net, professional, clinic }
  }

  const totalRevenue = appointments.reduce((s, a) => s + a.price, 0)
  const totalCardFees = appointments.reduce((s, a) => s + calcCommission(a.price, a.paymentMethod).cardFee, 0)
  const totalTax = appointments.reduce((s, a) => s + calcCommission(a.price, a.paymentMethod).tax, 0)
  const totalNet = totalRevenue - totalCardFees - totalTax
  const totalProfessional = appointments.reduce((s, a) => s + calcCommission(a.price, a.paymentMethod).professional, 0)
  const totalClinic = appointments.reduce((s, a) => s + calcCommission(a.price, a.paymentMethod).clinic, 0)

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Comissoes</h1>
          <p className="text-stone-400 text-sm mt-0.5">Calculo automatico de comissoes e taxas</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-700 text-sm focus:outline-none focus:border-[#b76e79]/40 shadow-sm" />
          <span className="text-stone-300 text-sm">ate</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-700 text-sm focus:outline-none focus:border-[#b76e79]/40 shadow-sm" />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Receita Bruta', value: fmtCur(totalRevenue), color: 'text-stone-700', bg: 'bg-stone-50' },
          { label: 'Taxa Cartao', value: `-${fmtCur(totalCardFees)}`, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Impostos', value: `-${fmtCur(totalTax)}`, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Receita Liquida', value: fmtCur(totalNet), color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: `Profissional (${PROFESSIONAL_RATE * 100}%)`, value: fmtCur(totalProfessional), color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Clinica', value: fmtCur(totalClinic), color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-stone-100 shadow-sm`}>
            <div className="text-stone-400 text-[9px] font-semibold uppercase tracking-wider">{k.label}</div>
            <div className={`${k.color} text-lg font-bold mt-1`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Waterfall */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        <h3 className="text-stone-700 text-sm font-semibold mb-4">Decomposicao da Receita</h3>
        <div className="flex items-end gap-3 h-40">
          {[
            { label: 'Bruta', val: totalRevenue, color: '#78716c' },
            { label: 'Taxa Cartao', val: -totalCardFees, color: '#f59e0b' },
            { label: 'Impostos', val: -totalTax, color: '#ef4444' },
            { label: 'Liquida', val: totalNet, color: '#3b82f6' },
            { label: 'Profissional', val: totalProfessional, color: '#8b5cf6' },
            { label: 'Clinica', val: totalClinic, color: '#10b981' }
          ].map(item => {
            const maxVal = Math.max(totalRevenue, 1)
            const h = Math.abs(item.val) / maxVal * 100
            return (
              <div key={item.label} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-stone-500 text-[9px] font-semibold mb-1">{fmtCur(Math.abs(item.val))}</span>
                <div className="w-full rounded-t-lg" style={{ height: `${Math.max(h, 2)}%`, backgroundColor: item.color }} />
                <span className="text-stone-400 text-[8px] mt-1 text-center">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail Table */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="w-7 h-7 border-3 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-stone-100 shadow-sm">
          <p className="text-stone-400 text-sm">Nenhum atendimento concluido no periodo</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-3 text-stone-500 font-semibold">Data</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-semibold">Cliente</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-semibold">Servico</th>
                  <th className="text-right px-4 py-3 text-stone-500 font-semibold">Valor</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-semibold">Pgto</th>
                  <th className="text-right px-4 py-3 text-stone-500 font-semibold">Taxa</th>
                  <th className="text-right px-4 py-3 text-stone-500 font-semibold">Imposto</th>
                  <th className="text-right px-4 py-3 text-stone-500 font-semibold text-violet-600">Prof.</th>
                  <th className="text-right px-4 py-3 text-stone-500 font-semibold text-emerald-600">Clinica</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => {
                  const c = calcCommission(a.price, a.paymentMethod)
                  return (
                    <tr key={a.id} className="border-t border-stone-50 hover:bg-stone-50/50">
                      <td className="px-4 py-2.5 text-stone-600">{new Date(a.date).toLocaleDateString('pt-BR')} {a.time}</td>
                      <td className="px-4 py-2.5 text-stone-700 font-medium">{a.userName}</td>
                      <td className="px-4 py-2.5 text-stone-500">{a.serviceName}</td>
                      <td className="px-4 py-2.5 text-right text-stone-700 font-medium">{fmtCur(a.price)}</td>
                      <td className="px-4 py-2.5 text-stone-400">{formatPaymentMethod(a.paymentMethod)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-600">{c.cardFee > 0 ? `-${fmtCur(c.cardFee)}` : '-'}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">-{fmtCur(c.tax)}</td>
                      <td className="px-4 py-2.5 text-right text-violet-600 font-semibold">{fmtCur(c.professional)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">{fmtCur(c.clinic)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-stone-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-stone-700">TOTAL ({appointments.length} atendimentos)</td>
                  <td className="px-4 py-3 text-right text-stone-700">{fmtCur(totalRevenue)}</td>
                  <td />
                  <td className="px-4 py-3 text-right text-amber-600">-{fmtCur(totalCardFees)}</td>
                  <td className="px-4 py-3 text-right text-red-500">-{fmtCur(totalTax)}</td>
                  <td className="px-4 py-3 text-right text-violet-600">{fmtCur(totalProfessional)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{fmtCur(totalClinic)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
