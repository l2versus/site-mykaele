// app/dashboard/agenda/page.tsx
'use client'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { useState } from 'react'

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())

  const hoursOfDay = Array.from({ length: 9 }, (_, i) => i + 9) // 9h - 18h
  const professionals = ['Dra. Isabella Silva', 'Dr. Fernando Macedo', 'Dra. Marina Costa']

  // Mock agendamentos
  const appointments: Record<string, { id: string; patient: string; duration: number; status: string }[]> = {
    'Dra. Isabella Silva': [
      { id: '1', patient: 'Ana Silva', duration: 60, status: 'CONFIRMED' },
      { id: '2', patient: 'Marina Santos', duration: 90, status: 'CONFIRMED' },
    ],
    'Dr. Fernando Macedo': [
      { id: '3', patient: 'Carlos Souza', duration: 45, status: 'PENDING' },
    ],
    'Dra. Marina Costa': [],
  }

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Data e Filtros */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Agenda de</h3>
            
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg mb-4"
            />

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Profissionais</h4>
              {professionals.map((prof) => (
                <label key={prof} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-slate-700">{prof}</span>
                </label>
              ))}
            </div>

            <button className="w-full mt-6 px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium text-sm">
              + Novo Agendamento
            </button>
          </div>
        </div>

        {/* Calendar View */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Header com horários */}
            <div className="grid grid-cols-10 divide-x divide-slate-200">
              <div className="p-4 font-semibold text-slate-900 bg-slate-50 col-span-1">Hora</div>
              {professionals.map((prof) => (
                <div key={prof} className="p-4 font-semibold text-slate-900 bg-slate-50 col-span-3 text-center">
                  <div className="text-sm">{prof}</div>
                </div>
              ))}
            </div>

            {/* Slots */}
            <div className="divide-y divide-slate-200">
              {hoursOfDay.map((hour) => (
                <div key={hour} className="grid grid-cols-10 divide-x divide-slate-200 min-h-20">
                  <div className="p-4 bg-slate-50 col-span-1 text-sm font-medium text-slate-700">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {professionals.map((prof) => (
                    <div
                      key={`${hour}-${prof}`}
                      className="p-2 col-span-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      {appointments[prof]
                        ?.filter(apt => true) // Aqui seria filtrado por hora
                        .map(apt => (
                          <div
                            key={apt.id}
                            className={`p-2 rounded text-xs font-medium text-white cursor-pointer hover:opacity-80 ${
                              apt.status === 'CONFIRMED' ? 'bg-green-500' : 'bg-amber-500'
                            }`}
                          >
                            <p className="truncate">{apt.patient}</p>
                            <p className="text-xs opacity-90">{apt.duration}min</p>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
