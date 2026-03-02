'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../AdminContext'

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface ReportData {
  summary: { totalRevenue: number; totalExpenses: number; profit: number; totalAppointments: number; totalClients: number; retentionRate: number }
  serviceRevenue: { name: string; revenue: number; count: number }[]
  monthlyRevenue: Record<string, number>
  monthlyExpenses: Record<string, number>
  dailyRevenue: Record<string, number>
  expenseByCategory: Record<string, number>
  statusCount: Record<string, number>
  hourHeatmap: Record<string, number>
  newClientsPerMonth: Record<string, number>
  paymentMethods: Record<string, { count: number; total: number }>
}

export default function RelatoriosPage() {
  const { fetchWithAuth } = useAdmin()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split('T')[0] })
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/admin/reports?from=${from}&to=${to}`)
      if (res.ok) {
        const d = await res.json()
        setData({
          summary: d.summary || { totalRevenue: 0, totalExpenses: 0, profit: 0, totalAppointments: 0, totalClients: 0, retentionRate: 0 },
          serviceRevenue: Array.isArray(d.serviceRevenue) ? d.serviceRevenue : [],
          monthlyRevenue: d.monthlyRevenue || {},
          monthlyExpenses: d.monthlyExpenses || {},
          dailyRevenue: d.dailyRevenue || {},
          expenseByCategory: d.expenseByCategory || {},
          statusCount: d.statusCount || {},
          hourHeatmap: d.hourHeatmap || {},
          newClientsPerMonth: d.newClientsPerMonth || {},
          paymentMethods: d.paymentMethods || {},
        })
      }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth, from, to])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-3 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return <div className="text-stone-400 text-center py-12">Erro ao carregar relatorios</div>

  const { summary: s } = data
  const sortedSvcs = data.serviceRevenue.slice(0, 10)
  const maxSvcRev = Math.max(...sortedSvcs.map(x => x.revenue), 1)
  const catColors: Record<string, string> = { MATERIAL: '#8b5cf6', ALUGUEL: '#3b82f6', MARKETING: '#f59e0b', EQUIPAMENTO: '#10b981', PESSOAL: '#ef4444', IMPOSTO: '#6b7280', OUTRO: '#ec4899' }
  const statusLabels: Record<string, string> = { COMPLETED: 'Realizados', CONFIRMED: 'Confirmados', PENDING: 'Pendentes', CANCELLED: 'Cancelados', NO_SHOW: 'Faltas' }
  const statusColors: Record<string, string> = { COMPLETED: '#34d399', CONFIRMED: '#60a5fa', PENDING: '#fbbf24', CANCELLED: '#f87171', NO_SHOW: '#71717a' }

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Relatorios Avancados</h1>
          <p className="text-stone-400 text-sm mt-0.5">Analise detalhada do negocio</p>
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
          { label: 'Receita Total', value: fmtCur(s.totalRevenue), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Despesas', value: fmtCur(s.totalExpenses), color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Lucro', value: fmtCur(s.profit), color: s.profit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: s.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
          { label: 'Agendamentos', value: String(s.totalAppointments), color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Clientes', value: String(s.totalClients), color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Retencao', value: `${s.retentionRate}%`, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-stone-100 shadow-sm`}>
            <div className="text-stone-400 text-[9px] font-semibold uppercase tracking-wider">{k.label}</div>
            <div className={`${k.color} text-lg font-bold mt-1`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Service */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h3 className="text-stone-700 text-sm font-semibold mb-4">Receita por Servico</h3>
          <div className="space-y-3">
            {sortedSvcs.map((svc, i) => (
              <div key={svc.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-stone-600 font-medium">{svc.name}</span>
                  <span className="text-stone-400">{svc.count}x · {fmtCur(svc.revenue)}</span>
                </div>
                <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#b76e79] to-[#d4a0a7]" style={{ width: `${(svc.revenue / maxSvcRev) * 100}%`, transition: 'width 0.8s ease' }} />
                </div>
              </div>
            ))}
            {sortedSvcs.length === 0 && <p className="text-stone-300 text-xs text-center py-4">Sem dados no periodo</p>}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h3 className="text-stone-700 text-sm font-semibold mb-4">Despesas por Categoria</h3>
          <div className="space-y-3">
            {Object.entries(data.expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
              const total = Object.values(data.expenseByCategory).reduce((s, v) => s + v, 0)
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-600 font-medium flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catColors[cat] || '#9ca3af' }} />
                      {cat}
                    </span>
                    <span className="text-stone-400">{fmtCur(val)} ({total > 0 ? Math.round((val / total) * 100) : 0}%)</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${total > 0 ? (val / total) * 100 : 0}%`, backgroundColor: catColors[cat] || '#9ca3af' }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(data.expenseByCategory).length === 0 && <p className="text-stone-300 text-xs text-center py-4">Sem despesas</p>}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h3 className="text-stone-700 text-sm font-semibold mb-4">Distribuicao de Status</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(data.statusCount).map(([status, count]) => {
              const total = Object.values(data.statusCount).reduce((s, v) => s + v, 0)
              return (
                <div key={status} className="flex-1 min-w-[100px] bg-stone-50 rounded-xl p-3 text-center">
                  <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ backgroundColor: statusColors[status] || '#9ca3af' }} />
                  <div className="text-stone-700 text-lg font-bold">{count}</div>
                  <div className="text-stone-400 text-[10px]">{statusLabels[status] || status}</div>
                  <div className="text-stone-300 text-[9px]">{total > 0 ? Math.round((count / total) * 100) : 0}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h3 className="text-stone-700 text-sm font-semibold mb-4">Metodos de Pagamento</h3>
          <div className="space-y-3">
            {Object.entries(data.paymentMethods).sort((a, b) => b[1].total - a[1].total).map(([method, info]) => (
              <div key={method} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2.5">
                <div>
                  <div className="text-stone-700 text-xs font-semibold">{method}</div>
                  <div className="text-stone-400 text-[10px]">{info.count} transacoes</div>
                </div>
                <div className="text-emerald-600 text-sm font-bold">{fmtCur(info.total)}</div>
              </div>
            ))}
            {Object.keys(data.paymentMethods).length === 0 && <p className="text-stone-300 text-xs text-center py-4">Sem pagamentos</p>}
          </div>
        </div>

        {/* Hour Heatmap */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h3 className="text-stone-700 text-sm font-semibold mb-4">Horarios Mais Populares</h3>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 14 }, (_, i) => i + 7).map(h => {
              const count = data.hourHeatmap[h] || 0
              const max = Math.max(...Object.values(data.hourHeatmap), 1)
              const intensity = count / max
              return (
                <div key={h} className="text-center">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: count > 0 ? `rgba(183,110,121,${0.15 + intensity * 0.7})` : '#f5f5f4', color: intensity > 0.5 ? 'white' : '#78716c' }}>
                    {count}
                  </div>
                  <div className="text-stone-400 text-[9px] mt-0.5">{h}h</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* New Clients Per Month */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h3 className="text-stone-700 text-sm font-semibold mb-4">Novos Clientes/Mes</h3>
          <div className="flex items-end gap-2 h-32">
            {Object.entries(data.newClientsPerMonth).slice(-8).map(([month, count]) => {
              const max = Math.max(...Object.values(data.newClientsPerMonth), 1)
              return (
                <div key={month} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-stone-500 text-[9px] font-semibold mb-1">{count}</span>
                  <div className="w-full rounded-t-md bg-gradient-to-t from-[#b76e79] to-[#d4a0a7]" style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? '4px' : '0' }} />
                  <span className="text-stone-400 text-[8px] mt-1">{month}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
