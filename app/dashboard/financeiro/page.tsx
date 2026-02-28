// app/dashboard/financeiro/page.tsx
'use client'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { StatCard } from '@/components/dashboard/StatCard'
import { SimpleBarChart } from '@/components/dashboard/SimpleBarChart'

export default function FinanceiroPage() {
  const stats = [
    { label: 'Faturamento', value: 'R$ 234.500', icon: '📈', color: 'green' as const },
    { label: 'Taxas', value: '-R$ 7.035', icon: '📉', color: 'red' as const },
    { label: 'Impostos', value: '-R$ 7.035', icon: '📉', color: 'red' as const },
    { label: 'Lucro Líquido', value: 'R$ 220.430', icon: '✅', color: 'green' as const },
  ]

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SimpleBarChart
          title="Faturamento por Profissional"
          series={[
            { name: 'Receita', data: [45, 52, 48, 61, 70, 85] }
          ]}
          categories={['Isabella', 'Fernando', 'Marina', 'João', 'Paula', 'Carlos']}
        />

        <SimpleBarChart
          title="Crescimento Mensal"
          series={[
            { name: 'Faturamento', data: [65, 78, 82, 75, 88, 92] }
          ]}
          categories={['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']}
        />
      </div>

      {/* Split Detalhado */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Análise de Split - Últimos 30 dias</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Entrada */}
          <div>
            <h4 className="font-medium text-slate-700 mb-4">Origem da Receita</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Receita Bruta</span>
                <span className="font-semibold">R$ 234.500,00</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-600">• Cartão (2.99%)</span>
                <span className="text-red-600">-R$ 7.016,83</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-600">• Impostos (3%)</span>
                <span className="text-red-600">-R$ 7.035,00</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-600">• Custo Produtos</span>
                <span className="text-red-600">-R$ 9.780,00</span>
              </div>
              <div className="flex justify-between items-center pt-3">
                <span className="font-semibold text-slate-900">Base para Split</span>
                <span className="font-bold text-slate-900">R$ 210.668,17</span>
              </div>
            </div>
          </div>

          {/* Distribuição */}
          <div>
            <h4 className="font-medium text-slate-700 mb-4">Distribuição (Split)</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-600">• Comissão Profissionais (40%)</span>
                <span className="font-semibold text-slate-900">R$ 84.267,27</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-600">• Clínica (60%)</span>
                <span className="font-semibold text-green-600">R$ 126.400,90</span>
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Nota:</strong> Profissionais recebem 40% da base após deduções. Saldo disponível para transferência: <strong>R$ 84.267,27</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
