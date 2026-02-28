// src/components/Footer.tsx

export function Footer() {
  return (
    <footer className="bg-[#1a1a1a] text-white">
      {/* CTA Banner */}
      <div className="border-b border-white/[0.08]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-14 md:py-18">
          <div className="reveal-blur max-w-2xl">
            <span className="text-xs font-medium tracking-[0.3em] uppercase text-[#d4a0a7] block mb-8">
              Agendamentos e Avaliações
            </span>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-extralight leading-[1.12] text-white mb-10">
              Pronta para a sua
              <br /><span className="font-normal text-[#d4a0a7]">transformação?</span>
            </h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#agendamento"
                className="glow-pulse inline-flex items-center gap-4 px-7 py-3.5 bg-white text-[#1a1a1a] text-xs font-semibold tracking-[0.2em] uppercase hover:bg-[#b76e79] hover:text-white transition-all duration-500 rounded-sm">
                Agendar Avaliação
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </a>
              <a href="https://wa.me/5585999086924" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-7 py-3.5 text-xs font-medium tracking-[0.2em] uppercase text-white/70 border border-white/20 hover:border-white/40 hover:text-white transition-all duration-500 rounded-sm">
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer grid */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
        <div className="stagger-children grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <p className="text-base font-normal text-white/90 mb-3 tracking-wide">Mykaele Procópio Home Spa</p>
            <p className="text-sm text-white/50 font-light leading-relaxed max-w-sm">
              Fisioterapia e Estética de Alta Performance.
              Criadora do Método Exclusivo Mykaele Procópio.
              Atendimento em Clínica e Serviço Home Spa.
            </p>
          </div>

          {/* Protocolos */}
          <div>
            <h4 className="text-xs font-medium tracking-[0.2em] uppercase text-white/50 mb-5">Protocolos</h4>
            <ul className="space-y-3">
              {['Arquitetura Corporal', 'Remodelação', 'Redução de Medidas', 'Home Spa'].map(s => (
                <li key={s}>
                  <a href="#metodo" className="text-sm text-white/50 hover:text-[#d4a0a7] transition-colors font-light">{s}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-xs font-medium tracking-[0.2em] uppercase text-white/50 mb-5">Contato</h4>
            <ul className="space-y-3">
              <li>
                <a href="https://instagram.com/mykaeleprocopio" target="_blank" rel="noopener noreferrer"
                  className="text-sm text-white/50 hover:text-[#d4a0a7] transition-colors font-light flex items-center gap-2.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  Instagram
                </a>
              </li>
              <li>
                <a href="https://wa.me/5585999086924" target="_blank" rel="noopener noreferrer"
                  className="text-sm text-white/50 hover:text-[#d4a0a7] transition-colors font-light flex items-center gap-2.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              </li>
              <li className="pt-2">
                <p className="text-sm text-white/40 font-light">Fortaleza, Ceará</p>
              </li>
            </ul>
          </div>
        </div>

        {/* ═══ Marquee premium copyright ═══ */}
        <div className="reveal-fade pt-5 border-t border-white/[0.08]">
          {/* Marquee band */}
          <div className="overflow-hidden py-4 -mx-6 md:-mx-10">
            <div className="marquee-track">
              {[...Array(4)].map((_, i) => (
                <span key={i} className="flex items-center gap-8 px-8 whitespace-nowrap">
                  <span className="text-shimmer text-sm md:text-base font-extralight tracking-[0.4em] uppercase">
                    Mykaele Procópio Home Spa
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b76e79]/40" />
                  <span className="text-xs md:text-sm font-extralight tracking-[0.3em] uppercase text-white/25">
                    Fisioterapia Estética de Alta Performance
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b76e79]/40" />
                  <span className="text-xs md:text-sm font-extralight tracking-[0.3em] uppercase text-white/25">
                    Arquitetura Corporal Avançada
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b76e79]/40" />
                </span>
              ))}
            </div>
          </div>

          {/* Bottom legal */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 pb-4 border-t border-white/[0.04]">
            <p className="text-[11px] text-white/30 font-light tracking-wider">
              &copy; {new Date().getFullYear()} Mykaele Procópio Home Spa — Todos os direitos reservados
            </p>

            {/* Developer credit — inline */}
            <a
              href="https://www.instagram.com/emmanuelbezerra_"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 group"
            >
              <span className="text-[12px] text-white/30 font-light tracking-wider group-hover:text-white/50 transition-colors duration-300">
                Desenvolvido com
              </span>
              <svg className="w-3.5 h-3.5 text-rose-400/50 group-hover:text-rose-400/80 transition-colors duration-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="text-[12px] text-white/30 font-light tracking-wider group-hover:text-white/50 transition-colors duration-300">
                por
              </span>
              <img
                src="/media/logo-branding/logo-emmanuel.png"
                alt="Emmanuel Bezerra — Desenvolvedor Full Stack"
                className="h-8 w-auto object-contain brightness-200 opacity-65 group-hover:opacity-95 transition-all duration-500"
              />
            </a>

            <p className="text-[11px] text-white/20 font-light tracking-wider">
              Fortaleza, CE &nbsp;·&nbsp; CREFITO
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
