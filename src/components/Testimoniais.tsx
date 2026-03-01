// src/components/Testimoniais.tsx
'use client'
import { useEffect, useState } from 'react'

interface Review {
  id: string
  nome: string
  cidade: string
  texto: string
  procedimento: string
  score: number
}

const DEPOIMENTOS_FALLBACK: Review[] = [
  {
    id: '1',
    nome: 'Marina S.',
    cidade: 'Fortaleza, CE',
    texto: 'Resultado incontestável desde a primeira sessão. A precisão técnica e o profissionalismo da Mykaele são incomparáveis. Redução real de medidas.',
    procedimento: 'Método Mykaele Procópio',
    score: 10,
  },
  {
    id: '2',
    nome: 'Carolina O.',
    cidade: 'Fortaleza, CE',
    texto: 'A excelência do atendimento Home Spa transcendeu qualquer expectativa. Conforto absoluto e resultados que se mantêm. Recomendo sem reservas.',
    procedimento: 'Home Spa',
    score: 10,
  },
  {
    id: '3',
    nome: 'Beatriz C.',
    cidade: 'Fortaleza, CE',
    texto: 'Transformação documentada e mensurável. O Método é diferente de tudo que já experimentei — sério, técnico e com resultados reais desde o primeiro dia.',
    procedimento: 'Arquitetura Corporal',
    score: 9,
  },
  {
    id: '4',
    nome: 'Amanda F.',
    cidade: 'Fortaleza, CE',
    texto: 'O nível de personalização do protocolo é impressionante. Cada detalhe é pensado para a minha fisiologia. Resultado permanente e natural.',
    procedimento: 'Remodelação Corporal',
    score: 10,
  },
]

function StarRating({ score }: { score: number }) {
  const stars = Math.round(score / 2) // 1-10 → 1-5 stars
  return (
    <div className="flex gap-0.5 mb-4">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= stars ? 'text-[#b76e79]' : 'text-[#e8dfd6]'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function Testimoniais() {
  const [reviews, setReviews] = useState<Review[]>(DEPOIMENTOS_FALLBACK)

  useEffect(() => {
    fetch('/api/reviews?limit=8')
      .then(r => r.json())
      .then(data => {
        if (data.reviews && data.reviews.length >= 2) {
          setReviews(data.reviews.slice(0, 8))
        }
      })
      .catch(() => {}) // Keep fallback on error
  }, [])

  // Aggregate rating for JSON-LD
  const avgScore = reviews.reduce((a, r) => a + r.score, 0) / reviews.length

  return (
    <section id="depoimentos" className="relative bg-[#f5f0eb] overflow-hidden">
      {/* Aggregate Rating JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'HealthAndBeautyBusiness',
        name: 'Mykaele Procópio Home Spa',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: (avgScore / 2).toFixed(1),
          bestRating: '5',
          worstRating: '1',
          ratingCount: reviews.length,
        }
      })}} />

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
            <div className="flex items-center gap-3 mt-6">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <svg key={i} className="w-4 h-4 text-[#b76e79]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm text-[#6a6560]">
                {(avgScore / 2).toFixed(1)} de 5 · {reviews.length} avaliações
              </span>
            </div>
          </div>

          {/* Grid — asymmetric editorial */}
          <div className="stagger-scale grid grid-cols-1 md:grid-cols-2 gap-px bg-[#e8dfd6]/60">
            {reviews.map((t) => (
              <div key={t.id}
                className="bg-[#f5f0eb] p-10 md:p-14 group hover:bg-white transition-colors duration-700">
                {/* Stars */}
                <StarRating score={t.score} />

                {/* Quote mark */}
                <div className="text-[#b76e79]/20 text-6xl font-serif leading-none mb-6 select-none">&ldquo;</div>

                <blockquote className="text-[15px] text-[#4a4a4a] font-light leading-[1.85] mb-10">
                  {t.texto}
                </blockquote>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-[#2d2d2d]">{t.nome}</p>
                      <svg className="w-3.5 h-3.5 text-[#b76e79]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    </div>
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
