// app/patient/page.tsx
'use client'

import { PatientLayout } from '@/components/patient/PatientLayout'

export default function PatientDashboard() {
  const next_appointment = {
    date: '15 de Março de 2026',
    time: '14:00',
    professional: 'Dra. Isabella Silva',
    service: 'Harmonização Facial',
    clinic: 'São Paulo - Vila Nova Conceição',
  }

  const recent_procedures = [
    {
      id: 1,
      name: 'Harmonização Facial',
      date: '10 Jan 2026',
      status: 'Concluído',
      before: 'https://via.placeholder.com/150',
      after: 'https://via.placeholder.com/150',
    },
    {
      id: 2,
      name: 'Laser CO2',
      date: '5 Dez 2025',
      status: 'Concluído',
      before: 'https://via.placeholder.com/150',
      after: 'https://via.placeholder.com/150',
    },
  ]

  return (
    <PatientLayout>
      <div className="space-y-6">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-8 rounded-lg">
          <h1 className="text-3xl font-bold mb-2">Olá, Maria! 👋</h1>
          <p className="text-slate-300">
            Bem-vindo ao seu painel de paciente. Aqui você acompanha seus procedimentos e agendamentos.
          </p>
        </div>

        {/* Next Appointment Card */}
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Próximas Consultas</h2>
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Data & Hora</p>
                <p className="font-semibold text-slate-900">{next_appointment.date}</p>
                <p className="text-sm text-slate-700">{next_appointment.time}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Profissional</p>
                <p className="font-semibold text-slate-900">{next_appointment.professional}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Procedimento</p>
                <p className="font-semibold text-slate-900">{next_appointment.service}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Clínica</p>
                <p className="font-semibold text-slate-900">{next_appointment.clinic}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                ✓ Confirmar
              </button>
              <button className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50">
                Reagendar
              </button>
            </div>
          </div>
        </div>

        {/* Recent Procedures */}
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Procedimentos Recentes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recent_procedures.map((proc) => (
              <div key={proc.id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-40 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center relative">
                  <div className="flex gap-2 absolute inset-0">
                    <div className="flex-1 bg-slate-300 flex items-center justify-center">
                      <span className="text-xs text-slate-600">Antes</span>
                    </div>
                    <div className="flex-1 bg-slate-400 flex items-center justify-center">
                      <span className="text-xs text-white">Depois</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900">{proc.name}</h3>
                  <p className="text-sm text-slate-600">{proc.date}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {proc.status}
                  </span>
                  <a href="/patient/antes-depois" className="block mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Ver Comparação →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <a href="/patient/agendamentos" className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-center">
              <p className="text-2xl mb-2">📅</p>
              <p className="font-medium text-slate-900">Ver Agenda</p>
            </a>
            <a href="/" className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-center">
              <p className="text-2xl mb-2">🛍️</p>
              <p className="font-medium text-slate-900">Novos Procedimentos</p>
            </a>
            <a href="/patient/produtos-posvendas" className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-center">
              <p className="text-2xl mb-2">🧴</p>
              <p className="font-medium text-slate-900">Produtos Home Care</p>
            </a>
          </div>
        </div>
      </div>
    </PatientLayout>
  )
}
