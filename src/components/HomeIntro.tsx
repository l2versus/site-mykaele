// src/components/HomeIntro.tsx
// Método + Serviços reais + Marquee — design "Nude & Champagne"
const SERVICOS = [
  { idx: '01', nome: 'Massagem Relaxante', preco: 'R$ 280', dur: '90 min · na sua casa', desc: 'Imersão de 90 min com pressão lenta e firme — desconexão profunda para quem vive intensamente.' },
  { idx: '02', nome: 'Método Fluir by Mykaele', preco: 'R$ 280', dur: '90 min · na sua casa', desc: 'Mais que contorno, um reencontro com sua leveza. Protocolo exclusivo de 90 min.' },
  { idx: '03', nome: 'Despertar Sensorial', preco: 'R$ 300', dur: '90 min · na sua casa', desc: 'Especializado em lipedema — cada corpo carrega uma história; cada curva merece respeito.' },
]

const PASSOS = [
  { n: '01', t: 'Agende online', d: 'Escolha o serviço, o dia e o horário. Confirmação direta no seu WhatsApp.' },
  { n: '02', t: 'O spa vai até você', d: 'A Mykaele chega com toda a estrutura portátil de alto padrão, com discrição total.' },
  { n: '03', t: 'Seu ritual, em casa', d: 'Protocolo de precisão no conforto do seu lar. Resultado desde a 1ª sessão.' },
]

const MARQUEE = ['Fisioterapia Estética de Alta Performance', 'Arquitetura Corporal Avançada', 'Atendimento Exclusivo a Domicílio', 'Mykaele Procópio']

export default function HomeIntro() {
  return (
    <>
      {/* ════ MÉTODO ════ */}
      <section id="metodo" className="stack-panel md:sticky md:top-0 overflow-hidden min-h-[100svh] bg-nude">
        <div className="max-w-[1500px] mx-auto px-6 md:px-14 py-[clamp(80px,14vh,160px)]">
          <div className="max-w-[760px] mb-14 reveal-blur">
            <span className="text-[12px] font-semibold tracking-[0.42em] uppercase text-champagne font-[family-name:var(--font-body)]">O Método</span>
            <h2 className="mt-4 text-espresso font-[family-name:var(--font-display)] font-medium leading-[1.04] tracking-[-0.022em]" style={{ fontSize: 'clamp(2rem,5vw,3.8rem)' }}>
              Seu bem-estar não deve exigir <em className="italic text-champagne">deslocamento.</em>
            </h2>
          </div>
          <div className="grid gap-10 md:grid-cols-3 md:gap-12 stagger-children">
            {PASSOS.map((p) => (
              <div key={p.n} className="border-t border-champagne/30 pt-6">
                <span className="block mb-4 text-champagne font-[family-name:var(--font-display)] italic text-[18px]">{p.n}</span>
                <h4 className="font-[family-name:var(--font-display)] font-semibold text-[clamp(1.4rem,2.2vw,1.75rem)] leading-[1.15] text-espresso mb-3">{p.t}</h4>
                <p className="text-[16px] leading-[1.7] text-taupe font-[family-name:var(--font-body)]">{p.d}</p>
              </div>
            ))}
          </div>

          {/* ── Faixa de fechamento: preenche o respiro inferior e empurra o funil ── */}
          <div className="mt-[clamp(56px,10vh,120px)] border-t border-champagne/30 pt-[clamp(32px,5vh,56px)] grid gap-10 md:grid-cols-[1.5fr_1fr] md:items-end reveal-blur">
            <h3 className="text-espresso font-[family-name:var(--font-display)] font-medium leading-[1.02] tracking-[-0.02em]" style={{ fontSize: 'clamp(1.9rem,4.2vw,3.4rem)' }}>
              O spa de luxo,<br /><em className="italic text-champagne">montado na sua sala.</em>
            </h3>
            <div className="md:text-right">
              <a href="#agendamento" className="group inline-flex items-center gap-3 px-8 py-4 bg-espresso text-porcelain text-[11px] font-semibold uppercase tracking-[0.22em] rounded-[3px] transition-colors duration-500 hover:bg-champagne font-[family-name:var(--font-body)]">
                Agendar minha avaliação
                <span className="transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1">↗</span>
              </a>
              <p className="mt-4 text-[12px] uppercase tracking-[0.18em] text-champagne font-[family-name:var(--font-body)]">
                Atendimento em Fortaleza · agenda limitada
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════ SERVIÇOS ════ */}
      <section id="servicos" className="stack-panel md:sticky md:top-0 overflow-hidden min-h-[100svh]" style={{ background: 'var(--color-porcelain)' }}>
        <div className="max-w-[1500px] mx-auto px-6 md:px-14 py-[clamp(80px,14vh,160px)]">
          <div className="max-w-[760px] mb-12 reveal-blur">
            <span className="text-[12px] font-semibold tracking-[0.42em] uppercase text-champagne font-[family-name:var(--font-body)]">Serviços a domicílio</span>
            <h2 className="mt-4 text-espresso font-[family-name:var(--font-display)] font-medium leading-[1.04] tracking-[-0.022em]" style={{ fontSize: 'clamp(2rem,5vw,3.8rem)' }}>
              Cada sessão, um <em className="italic text-champagne">ritual</em> de precisão.
            </h2>
          </div>
          <div className="border-t border-champagne/25 stagger-left">
            {SERVICOS.map((s) => (
              <a key={s.idx} href="#agendamento" className="group grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 md:gap-12 py-6 md:py-7 px-2 border-b border-champagne/25 relative overflow-hidden transition-[padding] duration-500 hover:pl-7">
                <span aria-hidden className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-60 transition-opacity duration-500" style={{ background: 'linear-gradient(90deg,var(--color-blush),transparent 60%)' }} />
                <span className="font-[family-name:var(--font-display)] italic text-champagne text-[16px] min-w-[34px]">{s.idx}</span>
                <span className="font-[family-name:var(--font-display)] font-semibold tracking-[-0.015em] leading-[1.05] text-espresso" style={{ fontSize: 'clamp(1.5rem,3vw,2.4rem)' }}>{s.nome}</span>
                <span className="hidden md:block text-[15px] text-taupe max-w-[360px] leading-[1.65] font-[family-name:var(--font-body)]">{s.desc}</span>
                <span className="hidden md:block text-right text-[16px] text-espresso font-semibold whitespace-nowrap font-[family-name:var(--font-body)]">{s.preco}<small className="block text-taupe font-normal text-[12px] mt-0.5">{s.dur}</small></span>
                <span className="w-11 h-11 border border-champagne/40 rounded-full grid place-items-center text-champagne transition-all duration-500 group-hover:bg-espresso group-hover:text-porcelain group-hover:border-espresso group-hover:-rotate-45">↗</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ════ MARQUEE ════ */}
      <div className="relative overflow-hidden border-y border-champagne/25 bg-nude py-7" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0">
              {MARQUEE.map((m, i) => (
                <span key={`${dup}-${i}`} className="flex items-center whitespace-nowrap font-[family-name:var(--font-display)] italic text-espresso px-[0.6em]" style={{ fontSize: 'clamp(1.4rem,3vw,2.4rem)' }}>
                  {m}<span className="text-champagne not-italic px-[0.5em]">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
