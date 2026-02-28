// app/patient/antes-depois/page.tsx
'use client'

import { PatientLayout } from '@/components/patient/PatientLayout'
import { BeforeAfterSlider } from '@/components/patient/BeforeAfterSlider'

export default function AntesDepoisPage() {
  const photos = [
    {
      id: 1,
      procedure: 'Harmonização Facial',
      date: '10 de Janeiro de 2026',
      beforeImage: 'https://via.placeholder.com/600x400?text=Antes',
      afterImage: 'https://via.placeholder.com/600x400?text=Depois',
      area: 'Rosto',
    },
    {
      id: 2,
      procedure: 'Laser CO2 Facial',
      date: '15 de Dezembro de 2025',
      beforeImage: 'https://via.placeholder.com/600x400?text=Antes',
      afterImage: 'https://via.placeholder.com/600x400?text=Depois',
      area: 'Rosto',
    },
    {
      id: 3,
      procedure: 'Lipoaspiração Corporal',
      date: '10 de Novembro de 2025',
      beforeImage: 'https://via.placeholder.com/600x400?text=Antes',
      afterImage: 'https://via.placeholder.com/600x400?text=Depois',
      area: 'Corpo',
    },
  ]

  return (
    <PatientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Meus Resultados</h1>
          <p className="text-slate-600">
            Acompanhe a evolução de seus procedimentos. Deslize as imagens para comparar antes e depois.
          </p>
        </div>

        <div className="space-y-8">
          {photos.map((photo) => (
            <div key={photo.id} className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{photo.procedure}</h2>
                  <p className="text-sm text-slate-600">{photo.date}</p>
                </div>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                  {photo.area}
                </span>
              </div>

              <BeforeAfterSlider
                beforeImage={photo.beforeImage}
                afterImage={photo.afterImage}
                procedure={photo.procedure}
              />

              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <h3 className="font-medium text-slate-900 mb-2">Resultado do Procedimento</h3>
                <p className="text-sm text-slate-600">
                  ✓ Procedimento realizado com sucesso.
                  <br />✓ Paciente apresenta resultado satisfatório.
                  <br />✓ Recomendações pós-procedimento: evite sol direto por 7 dias e mantenha hidratação.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PatientLayout>
  )
}
