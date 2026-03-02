// src/components/FAQ.tsx

const FAQ_ITEMS = [
  {
    question: 'Como funciona o agendamento online?',
    answer: 'Você pode agendar pelo nosso site ou app a qualquer momento. Basta criar sua conta, escolher o procedimento desejado, selecionar data e horário disponíveis e confirmar. Você receberá confirmação por WhatsApp.',
  },
  {
    question: 'Quais formas de pagamento são aceitas?',
    answer: 'Aceitamos PIX (com desconto), cartão de crédito em até 12x, cartão de débito e dinheiro. O pagamento pode ser realizado na hora do atendimento ou antecipadamente pelo site.',
  },
  {
    question: 'Qual a diferença entre atendimento na clínica e Home Spa?',
    answer: 'No Home Spa, a Mykaele vai até você com todos os equipamentos necessários para realizar o procedimento no conforto da sua casa. O atendimento na clínica oferece toda a infraestrutura do espaço em Sapiranga, Fortaleza.',
  },
  {
    question: 'Quantas sessões são necessárias para ver resultados?',
    answer: 'Depende do protocolo e do objetivo. Muitos pacientes notam resultados visíveis desde a primeira sessão. Protocolos completos geralmente incluem entre 5 e 10 sessões para resultados duradouros.',
  },
  {
    question: 'Os procedimentos são seguros?',
    answer: 'Sim. Todos os protocolos são desenvolvidos por Mykaele Procópio, fisioterapeuta dermatofuncional com formação e experiência comprovadas. Utilizamos equipamentos de última geração com todas as certificações necessárias.',
  },
  {
    question: 'É necessário fazer avaliação antes do procedimento?',
    answer: 'Sim, a avaliação inicial é fundamental. Nela, a Mykaele analisa suas necessidades, define o melhor protocolo personalizado e estabelece expectativas realistas de resultados. A avaliação pode ser agendada online.',
  },
]

export default function FAQ() {
  return (
    <section id="faq" className="bg-[#faf9f7] py-20 md:py-28">
      <div className="max-w-[800px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div className="text-center mb-14 reveal-blur">
          <span className="text-[10px] font-medium tracking-[0.35em] uppercase text-[#b76e79]/60 block mb-4">
            Dúvidas Frequentes
          </span>
          <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] font-extralight tracking-[-0.02em] text-[#2d2d2d]">
            Perguntas frequentes
          </h2>
        </div>

        {/* FAQ Items */}
        <div className="space-y-0 divide-y divide-[#e8e4e0]">
          {FAQ_ITEMS.map((item, i) => (
            <details
              key={i}
              className="group py-5 cursor-pointer"
            >
              <summary className="flex items-center justify-between gap-4 list-none text-left">
                <h3 className="text-[15px] font-normal text-[#2d2d2d] group-open:text-[#b76e79] transition-colors duration-300">
                  {item.question}
                </h3>
                <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#b76e79]/50 transition-transform duration-300 group-open:rotate-45">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="7" y1="1" x2="7" y2="13" />
                    <line x1="1" y1="7" x2="13" y2="7" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-[14px] text-[#6a6560] font-light leading-[1.8] pr-8">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center reveal-blur">
          <p className="text-[13px] text-[#6a6560] font-light mb-4">
            Não encontrou sua dúvida?
          </p>
          <a
            href="https://wa.me/5585999086924?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20os%20procedimentos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-medium tracking-[0.2em] uppercase text-[#b76e79] border border-[#b76e79]/30 hover:bg-[#b76e79] hover:text-white transition-all duration-500 rounded-sm"
          >
            Fale no WhatsApp
          </a>
        </div>
      </div>
    </section>
  )
}

// Export FAQ data for JSON-LD schema
export { FAQ_ITEMS }
