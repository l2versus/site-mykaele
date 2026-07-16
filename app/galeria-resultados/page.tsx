// app/galeria-resultados/page.tsx
'use client'

import Link from 'next/link'
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
            Registros de atendimentos reais, feitos a domicílio em Fortaleza. Use o slider para
            comparar antes e depois.
          </p>

          {/* Aviso obrigatório: Res. COFFITO 532/2021 (imagens autênticas, sem edição) e
              CDC Art. 37 (vedada publicidade enganosa, inclusive por omissão). */}
          <p className="text-sm text-slate-500 max-w-2xl mx-auto border border-slate-200 rounded-lg px-4 py-3">
            Imagens divulgadas mediante autorização prévia e por escrito de cada cliente, sem filtros
            ou edição. <strong>Resultados variam de pessoa para pessoa e não são garantidos</strong> —
            dependem do quadro individual, da adesão ao protocolo e do número de sessões.
          </p>
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
                icon: '🎓',
                titulo: 'Fisioterapeuta Dermatofuncional',
                descricao:
                  'Atendimento conduzido pela própria Mykaele, fisioterapeuta inscrita no CREFITO — do início ao fim, sempre a mesma profissional',
              },
              {
                icon: '🧳',
                titulo: 'Estrutura Portátil Completa',
                descricao:
                  'Maca profissional e todos os materiais chegam com ela, montados no seu espaço',
              },
              {
                icon: '✨',
                titulo: 'Sessões de 90 Minutos',
                descricao:
                  'O tempo necessário para o protocolo completo, sem a pressa de uma agenda de clínica',
              },
              {
                icon: '🛡️',
                titulo: 'Higiene e Segurança',
                descricao:
                  'Materiais esterilizados e protocolos rigorosos, aplicados na sua casa',
              },
              {
                icon: '💬',
                titulo: 'Protocolo Individualizado',
                descricao:
                  'Cada corpo tem uma história — o protocolo é definido a partir da sua avaliação',
              },
              {
                icon: '🏠',
                titulo: 'Você Não Precisa Sair de Casa',
                descricao:
                  'Atendimento a domicílio em Fortaleza — sem deslocamento, sem sala de espera, com privacidade total',
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
            Escolha o serviço, o dia e o horário. O spa vai até você, em Fortaleza.
          </p>
          <Link
            href="/#agendamento"
            className="inline-block bg-white text-amber-600 hover:bg-amber-50 px-8 py-4 rounded-xl font-semibold transition-colors duration-300"
          >
            Agendar minha sessão
          </Link>
        </div>
      </section>

      <Footer />
    </>
  )
}
