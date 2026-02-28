// src/components/dashboard/AppointmentsList.tsx
import { formatDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Appointment {
  id: string
  patient: { name: string }
  professional: { name: string }
  service: string
  scheduledAt: string
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED'
}

interface AppointmentsListProps {
  appointments: Appointment[]
  title?: string
}

export function AppointmentsList({
  appointments,
  title = 'Próximos Agendamentos'
}: AppointmentsListProps) {
  const statusBg = {
    PENDING: 'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  }

  const statusLabel = {
    PENDING: 'Pendente',
    CONFIRMED: 'Confirmado',
    COMPLETED: 'Realizado',
  }

  return (
    <div className="p-6 bg-white rounded-lg border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Paciente</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Procedimento</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Profissional</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Data/Hora</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  Nenhum agendamento
                </td>
              </tr>
            ) : (
              appointments.map((apt) => (
                <tr key={apt.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm text-slate-900 font-medium">
                    {apt.patient?.name}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-700">{apt.service}</td>
                  <td className="py-3 px-4 text-sm text-slate-700">
                    {apt.professional?.name}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-700">
                    {formatDate(
                      new Date(apt.scheduledAt),
                      'dd/MM/yyyy HH:mm',
                      { locale: ptBR }
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        statusBg[apt.status]
                      }`}
                    >
                      {statusLabel[apt.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
