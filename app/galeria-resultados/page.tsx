// app/galeria-resultados/page.tsx
'use client'

import { ANTES_DEPOIS } from '@/lib/media-catalog'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import ResultadosReais from '@/components/ResultadosReais'

export default function GaleriaResultados() {
  return (
    <>
      <Header />
      
      <div className="bg-gradient-to-b from-slate-50 to-white pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            Galeria de Resultados
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            Transformações reais de pacientes satisfeitos. Use o slider para comparar antes e depois.
          </p>
          
          {/* Mini Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div>
              <p className="text-3xl font-bold text-amber-600">{ANTES_DEPOIS.length}+</p>
              <p className="text-sm text-slate-600">Resultados Exibidos</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-600">100%</p>
              <p className="text-sm text-slate-600">Satisfeitos</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-600">Reais</p>
              <p className="text-sm text-slate-600">Sem Filtros</p>
            </div>
          </div>
        </div>
      </div>

      <ResultadosReais />

      {/* Grid complementar */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-slate-900 text-center mb-12">
            Por Que Escolher Mykaele?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '👨‍⚕️',
                titulo: 'Profissionais Certificados',
                descricao:
                  'Médicos especializados com anos de experiência em estética avançada',
              },
              {
                icon: '🏥',
                titulo: 'Equipamentos Premium',
                descricao:
                  'Tecnologia de ponta para resultados seguros e eficientes',
              },
              {
                icon: '✨',
                titulo: 'Resultados Comprovados',
                descricao:
                  'Fotos reais de antes e depois dos nossos pacientes satisfeitos',
              },
              {
                icon: '🛡️',
                titulo: 'Segurança em Primeiro',
                descricao:
                  'Protocolos rigorosos de segurança e higiene',
              },
              {
                icon: '💬',
                titulo: 'Atendimento Personalizado',
                descricao:
                  'Consulta individual elaborando um plano customizado',
              },
              {
                icon: '📍',
                titulo: 'Localização Privilegiada',
                descricao:
                  'Clínica moderna e acessível no coração da cidade',
              },
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="text-5xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {item.titulo}
                </h3>
                <p className="text-slate-600">{item.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-r from-amber-500 to-amber-600">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Pronto para Sua Transformação?
          </h2>
          <p className="text-xl text-amber-50 mb-8">
            Agende uma consulta gratuita e descubra o procedimento ideal para você
          </p>
          <button className="bg-white text-amber-600 hover:bg-amber-50 px-8 py-4 rounded-xl font-semibold transition-colors duration-300">
            Agendar Consulta Agora
          </button>
        </div>
      </section>

      <Footer />
    </>
  )
}
