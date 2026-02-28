// src/components/ProfessionalsSection.tsx
const professionals = [
  {
    name: 'Dra. Isabella Silva',
    specialty: 'Dermatologia e Harmonização Facial',
    description: 'Mais de 15 anos de experiência em procedimentos estéticos minimamente invasivos',
    credentials: ['CRM-SP 123456', 'Especialista em Harmonização Facial', 'Speaker Internacional'],
    image: 'https://via.placeholder.com/300x400'
  },
  {
    name: 'Dr. Fernando Macedo',
    specialty: 'Laser e Rejuvenescimento',
    description: 'Pioneiro no uso de lasers avançados para rejuvenescimento cutâneo',
    credentials: ['CRM-SP 789012', 'Pesquisador em Tecnologias Estéticas', 'Docente Unifesp'],
    image: 'https://via.placeholder.com/300x400'
  },
  {
    name: 'Dra. Marina Costa',
    specialty: 'Cirurgia Plástica',
    description: 'Especialista em procedimentos corporais com foco em resultados naturais',
    credentials: ['CRM-SP 345678', 'Cirurgiã Plástica Certificada', 'Membro SBCP'],
    image: 'https://via.placeholder.com/300x400'
  },
]

export function ProfessionalsSection() {
  return (
    <section id="profissionais" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Profissionais de Excelência
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Um time de referência em medicina estética, ciência e resultados naturais
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {professionals.map((prof, idx) => (
            <div key={idx} className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
              {/* Placeholder para foto */}
              <div className="h-64 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                <span className="text-gray-400 text-sm">Foto do profissional</span>
              </div>
              
              <div className="p-6">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{prof.name}</h3>
                <p className="text-slate-600 text-sm font-medium mb-3">{prof.specialty}</p>
                <p className="text-slate-600 text-sm mb-4">{prof.description}</p>
                
                <div className="space-y-2 mb-6">
                  {prof.credentials.map((cred, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-slate-400 text-xs">✓</span>
                      <span className="text-xs text-slate-500">{cred}</span>
                    </div>
                  ))}
                </div>

                <a
                  href={`/agendamento?profissional=${prof.name}`}
                  className="block text-center px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium text-sm"
                >
                  Agendar com {prof.name.split(' ')[1]}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
