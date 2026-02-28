// src/components/Testimoniais.tsx
'use client'

const DEPOIMENTOS = [
  {
    id: '1',
    nome: 'Marina S.',
    cidade: 'Fortaleza, CE',
    texto: 'Resultado incontestável desde a primeira sessão. A precisão técnica e o profissionalismo da Mykaele são incomparáveis. Redução real de medidas.',
    procedimento: 'Método Mykaele Procópio',
  },
  {
    id: '2',
    nome: 'Carolina O.',
    cidade: 'Fortaleza, CE',
    texto: 'A excelência do atendimento Home Spa transcendeu qualquer expectativa. Conforto absoluto e resultados que se mantêm. Recomendo sem reservas.',
    procedimento: 'Home Spa',
  },
  {
    id: '3',
    nome: 'Beatriz C.',
    cidade: 'Fortaleza, CE',
    texto: 'Transformação documentada e mensurável. O Método é diferente de tudo que já experimentei — sério, técnico e com resultados reais desde o primeiro dia.',
    procedimento: 'Arquitetura Corporal',
  },
  {
    id: '4',
    nome: 'Amanda F.',
    cidade: 'Fortaleza, CE',
    texto: 'O nível de personalização do protocolo é impressionante. Cada detalhe é pensado para a minha fisiologia. Resultado permanente e natural.',
    procedimento: 'Remodelação Corporal',
  },
]

export default function Testimoniais() {
  return (
    <section id="depoimentos" className="relative bg-[#f5f0eb] overflow-hidden">
      <div className="py-28 md:py-36">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          {/* Header */}
          <div className="reveal-blur mb-20 max-w-2xl">
            <span className="text-xs font-medium tracking-[0.3em] uppercase text-[#b76e79] block mb-8">
              Depoimentos
            </span>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-extralight leading-[1.15] text-[#2d2d2d]">
              A confiança de quem
              <br />vivenciou os resultados.
            </h2>
          </div>

          {/* Grid — asymmetric editorial */}
          <div className="stagger-scale grid grid-cols-1 md:grid-cols-2 gap-px bg-[#e8dfd6]/60">
            {DEPOIMENTOS.map((t, idx) => (
              <div key={t.id}
                className="bg-[#f5f0eb] p-10 md:p-14 group hover:bg-white transition-colors duration-700">
                {/* Quote mark */}
                <div className="text-[#b76e79]/20 text-6xl font-serif leading-none mb-6 select-none">&ldquo;</div>

                <blockquote className="text-[15px] text-[#4a4a4a] font-light leading-[1.85] mb-10">
                  {t.texto}
                </blockquote>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#2d2d2d]">{t.nome}</p>
                    <p className="text-[11px] text-[#6a6560] mt-0.5">{t.cidade}</p>
                  </div>
                  <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#b76e79]/70 border border-[#b76e79]/20 px-3 py-1.5 rounded-sm">
                    {t.procedimento}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
