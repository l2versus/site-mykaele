// src/components/EquipeAmbiente.tsx
'use client'

export default function EquipeAmbiente() {
  return (
    <section id="equipe" className="relative bg-white overflow-hidden">
      <div className="py-28 md:py-36">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          {/* Header */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
            <div className="reveal-blur">
              <span className="text-xs font-medium tracking-[0.3em] uppercase text-[#b76e79] block mb-8">
                Infraestrutura
              </span>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-extralight leading-[1.15] text-[#2d2d2d]">
                Projetado para
                <br /><span className="font-normal">excelência.</span>
              </h2>
            </div>
            <div className="reveal-blur delay-300 flex items-end">
              <p className="text-sm text-[#4a4a4a] font-light leading-[1.9] max-w-md">
                Cada detalhe do ambiente foi concebido para garantir
                privacidade absoluta, conforto e uma experiência
                que transcende o atendimento convencional.
              </p>
            </div>
          </div>

          {/* Video ambientes */}
          <div className="stagger-scale grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { src: '/media/videos/clinica-tour.mp4', titulo: 'Ambiente Clínico', desc: 'Elegância e privacidade em cada detalhe' },
              { src: '/media/videos/clinica-tour-2.mp4', titulo: 'Estrutura Completa', desc: 'Equipamentos e tecnologia de ponta' },
            ].map((item, idx) => (
              <div key={idx} className="group relative aspect-[16/10] overflow-hidden bg-[#f0ebe5]">
                <video
                  src={item.src}
                  muted autoPlay loop playsInline preload="metadata"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <p className="text-base font-light text-white mb-1">{item.titulo}</p>
                  <p className="text-sm text-white/60 font-light">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Features strip */}
          <div className="stagger-children grid grid-cols-3 gap-px bg-[#e8dfd6]/60 mt-4">
            {[
              { titulo: 'Privacidade', texto: 'Atendimento individual e exclusivo' },
              { titulo: 'Biossegurança', texto: 'Protocolos rigorosos de higienização' },
              { titulo: 'Home Spa', texto: 'Infraestrutura portátil de alto padrão' },
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 md:p-10 text-center">
                <p className="text-xs font-medium tracking-[0.15em] uppercase text-[#2d2d2d] mb-2">{f.titulo}</p>
                <p className="text-sm text-[#6a6560] font-light">{f.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
