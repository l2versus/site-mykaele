// src/components/GaleriaDinamica.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface GalleryImage {
  id: string
  url: string
  alt: string | null
  order: number
}

export default function GaleriaDinamica() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/gallery')
      .then(r => r.json())
      .then(data => {
        if (data.images?.length) setImages(data.images)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (loaded && images.length === 0) return null

  return (
    <section id="galeria" className="relative bg-[#faf9f7] overflow-hidden">
      {/* ═══ Header ═══ */}
      <div className="py-20 md:py-28 border-b border-stone-200/60">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end">
            <div className="reveal-blur">
              <span className="text-[10px] font-medium tracking-[0.35em] uppercase text-[#b76e79]/60 block mb-6">
                Nosso Espaço & Resultados
              </span>
              <h2 className="text-[clamp(1.6rem,3vw,2.6rem)] font-extralight leading-[1.15] tracking-[-0.02em] text-[#2d2d2d]">
                Registros que traduzem
                <br />
                <span className="font-light text-[#b76e79]">excelência em cada detalhe</span>
              </h2>
            </div>
            <div className="reveal-blur delay-300">
              <p className="text-[15px] text-[#6a6560] font-light leading-[1.9] max-w-md lg:ml-auto">
                Cada imagem reflete o compromisso com resultados reais,
                ambientes cuidadosamente preparados e protocolos de alta performance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Grid de Fotos ═══ */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-16 md:py-20">
        {/* Loading skeleton */}
        {!loaded && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="aspect-[3/4] bg-stone-100 animate-pulse rounded-lg" />
            ))}
          </div>
        )}

        {/* Grid */}
        {loaded && images.length > 0 && selectedIdx === null && (
          <div ref={scrollRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setSelectedIdx(idx)}
                className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-stone-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#b76e79]/40"
              >
                <Image
                  src={img.url}
                  alt={img.alt || 'Galeria Mykaele Procópio'}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {img.alt && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <p className="text-sm font-light text-white truncate">{img.alt}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ═══ Lightbox ═══ */}
        {selectedIdx !== null && images[selectedIdx] && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-[fadeIn_0.2s_ease-out]">
            {/* Fechar */}
            <button
              onClick={() => setSelectedIdx(null)}
              className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Navegação */}
            {selectedIdx > 0 && (
              <button
                onClick={() => setSelectedIdx(selectedIdx - 1)}
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            {selectedIdx < images.length - 1 && (
              <button
                onClick={() => setSelectedIdx(selectedIdx + 1)}
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}

            {/* Imagem ampliada */}
            <div className="relative w-full max-w-4xl max-h-[85vh] aspect-[3/4]">
              <Image
                src={images[selectedIdx].url}
                alt={images[selectedIdx].alt || 'Galeria'}
                fill
                sizes="90vw"
                className="object-contain"
                priority
              />
            </div>

            {/* Info */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
              {images[selectedIdx].alt && (
                <p className="text-sm text-white/70 font-light mb-1">{images[selectedIdx].alt}</p>
              )}
              <p className="text-xs text-white/30">{selectedIdx + 1} / {images.length}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
