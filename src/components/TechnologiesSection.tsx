// src/components/TechnologiesSection.tsx

export function TechnologiesSection() {
  return (
    <section id="tecnologias" className="relative bg-[#faf9f7] overflow-hidden">
      <div className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          {/* Header */}
          <div className="reveal-blur mb-16 max-w-2xl">
            <span className="text-xs font-medium tracking-[0.3em] uppercase text-[#b76e79] block mb-8">
              Fundamentação Científica
            </span>
            <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-extralight leading-[1.15] text-[#2d2d2d]">
              Bases do protocolo.
            </h2>
          </div>

          {/* Horizontal list */}
          <div className="stagger-left border-t border-[#e8dfd6]/80">
            {[
              { titulo: 'Fisioterapia Dermato-Funcional', texto: 'Formação especializada que garante o entendimento profundo da anatomia, fisiologia da pele e tecidos subcutâneos para intervenções precisas.' },
              { titulo: 'Protocolo Autoral Exclusivo', texto: 'Metodologia 100% proprietária, desenvolvida e refinada ao longo de 7 anos de prática clínica intensiva em remodelação corporal e redução de medidas.' },
              { titulo: 'Estimulação Metabólica', texto: 'Técnicas manuais de alta performance que ativam o metabolismo celular, promovendo lipólise e drenagem por até 48 horas contínuas.' },
              { titulo: 'Personalização Clínica', texto: 'Cada protocolo é desenhado individualmente, respeitando a fisiologia, o biotipo e os objetivos específicos de cada paciente.' },
            ].map((item, idx) => (
              <div key={idx}
                className={`grid grid-cols-1 md:grid-cols-12 gap-6 py-10 md:py-12 ${
                  idx < 3 ? 'border-b border-[#e8dfd6]/60' : ''
                }`}>
                <div className="md:col-span-1">
                  <span className="text-xs text-[#b76e79] font-medium tracking-wider">0{idx + 1}</span>
                </div>
                <div className="md:col-span-4">
                  <h3 className="text-base font-normal text-[#2d2d2d]">{item.titulo}</h3>
                </div>
                <div className="md:col-span-6 md:col-start-7">
                  <p className="text-[14px] text-[#6a6560] font-light leading-[1.85]">{item.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
