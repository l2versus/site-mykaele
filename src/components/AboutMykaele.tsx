// src/components/AboutMykaele.tsx
// Server Component — sem 'use client' para reduzir bundle JS

export default function AboutMykaele() {
  return (
    <section id="sobre" className="relative bg-[#faf9f7] overflow-hidden">
      {/* Main content */}
      <div className="py-28 md:py-36">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">

            {/* Photo column */}
            <div className="lg:col-span-5 reveal-left">
              <div className="relative">
                <div className="aspect-[3/4] max-w-[420px] overflow-hidden bg-[#f0ebe5]">
                  <img
                    src="/media/profissionais/mykaele-principal.png"
                    alt="Mykaele Procópio — Diretora Clínica"
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                {/* Minimal caption */}
                <div className="mt-6 flex items-center gap-4">
                  <div className="w-8 h-[1px] bg-[#b76e79]" />
                  <span className="text-xs font-medium tracking-[0.25em] uppercase text-[#6a6560]">
                    Diretora Clínica e Fundadora
                  </span>
                </div>
              </div>
            </div>

            {/* Text column */}
            <div className="lg:col-span-6 lg:col-start-7">
              <div className="reveal-right lg:pt-12">
                <span className="text-xs font-medium tracking-[0.3em] uppercase text-[#b76e79] block mb-10">
                  Sobre a Especialista
                </span>

                <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-extralight leading-[1.15] tracking-[-0.02em] text-[#2d2d2d] mb-10">
                  Mykaele
                  <br />
                  <span className="font-normal">Procópio</span>
                </h2>

                <div className="space-y-6 text-[15px] text-[#5a5550] font-light leading-[1.9] mb-14">
                  <p>
                    Com sete anos de atuação dedicada à estética de resultados
                    e formação integral em Fisioterapia, Mykaele Procópio
                    representa o mais alto rigor técnico na remodelação corporal.
                  </p>
                  <p>
                    Inconformada com as limitações dos protocolos convencionais
                    do mercado, dedicou sua expertise clínica para desenvolver
                    uma intervenção 100% proprietária e exclusiva: o{' '}
                    <span className="text-[#2d2d2d] font-normal">Método Mykaele Procópio</span>.
                  </p>
                  <p>
                    A conduta clínica é pautada pela personalização extrema e
                    pelo respeito à fisiologia de cada paciente. Para garantir
                    um atendimento que transcende o convencional, oferece suas
                    intervenções tanto no ambiente refinado de sua clínica
                    quanto através do primoroso serviço de Home Spa.
                  </p>
                </div>

                {/* Credentials */}
                <div className="stagger-left space-y-4 pt-10 border-t border-[#e8dfd6]/80">
                  {[
                    'Fisioterapeuta — CREFITO',
                    'Criadora de Protocolo Autoral Exclusivo',
                    'Criadora do Método Mykaele Procópio',
                    '7 anos de atuação clínica',
                  ].map((cred, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#b76e79]" />
                      <span className="text-sm text-[#4a4a4a] font-light">{cred}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Numbers strip */}
      <div className="border-t border-[#e8dfd6]/80 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-16">
          <div className="stagger-children grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { valor: '7+', label: 'Anos de atuação', target: 7, suffix: '+' },
              { valor: '500+', label: 'Pacientes atendidos', target: 500, suffix: '+' },
              { valor: '1ª', label: 'Sessão com resultado', target: 1, suffix: 'ª' },
              { valor: '48h', label: 'Efeito metabólico', target: 48, suffix: 'h' },
            ].map((s, i) => (
              <div key={i}>
                <p className="text-2xl md:text-3xl font-extralight text-[#2d2d2d]">
                  <span data-counter data-target={s.target} data-suffix={s.suffix} className="counter-number">0</span>
                </p>
                <p className="text-xs text-[#6a6560] mt-2 tracking-[0.15em] uppercase font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
