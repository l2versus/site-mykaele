// app/dashboard/page.tsx
'use client'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { StatCard } from '@/components/dashboard/StatCard'
import { SimpleBarChart } from '@/components/dashboard/SimpleBarChart'
import { AppointmentsList } from '@/components/dashboard/AppointmentsList'

export default function DashboardPage() {
  // Mock data - será substituído por dados reais via API
  const stats = [
    { label: 'Agendamentos Hoje', value: 12, icon: '📅', trend: { value: 15, direction: 'up' as const }, color: 'blue' as const },
    { label: 'Faturamento Mês', value: 'R$ 45.890', icon: '💰', trend: { value: 8, direction: 'up' as const }, color: 'green' as const },
    { label: 'Pacientes Ativos', value: 342, icon: '👥', trend: { value: 3, direction: 'up' as const }, color: 'slate' as const },
    { label: 'Taxa Ocupação', value: '85%', icon: '🎯', trend: { value: 5, direction: 'down' as const }, color: 'amber' as const },
  ]

  const appointmentsMock = [
    {
      id: '1',
      patient: { name: 'Ana Silva' },
      professional: { name: 'Dra. Isabella Silva' },
      service: 'Harmonização Facial',
      scheduledAt: new Date().toISOString(),
      status: 'CONFIRMED' as const,
    },
    {
      id: '2',
      patient: { name: 'Carlos Santos' },
      professional: { name: 'Dr. Fernando Macedo' },
      service: 'Laser CO2',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'PENDING' as const,
    },
  ]

  const chartData = {
    categories: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'],
    series: [
      { name: 'Agendamentos', data: [65, 78, 82, 75, 88, 92] },
      { name: 'Receita', data: [45, 52, 48, 61, 70, 85] },
    ],
  }

  return (
    <DashboardLayout>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SimpleBarChart
          title="Agendamentos vs Faturamento"
          series={chartData.series}
          categories={chartData.categories}
        />
        
        <div className="p-6 bg-white rounded-lg border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumo Financeiro</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="text-slate-600">Receita Total</span>
              <span className="font-semibold text-slate-900">R$ 45.890,00</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="text-slate-600">Taxa de Cartão</span>
              <span className="font-semibold text-red-600">-R$ 1.373,00</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="text-slate-600">Impostos</span>
              <span className="font-semibold text-red-600">-R$ 1.376,70</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="text-slate-600">Custo de Produtos</span>
              <span className="font-semibold text-red-600">-R$ 2.294,50</span>
            </div>
            <div className="flex justify-between items-center pt-3">
              <span className="text-slate-900 font-semibold">Lucro Líquido</span>
              <span className="font-bold text-green-600 text-lg">R$ 40.845,80</span>
            </div>
          </div>
        </div>
      </div>

      {/* Appointments */}
      <AppointmentsList appointments={appointmentsMock} />
    </DashboardLayout>
  )
}
