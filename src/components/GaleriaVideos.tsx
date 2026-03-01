// src/components/GaleriaVideos.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

const VIDEOS = [
  { id: 'v1', titulo: 'Procedimento em Ação', src: '/media/videos/procedimento-1.mp4', tag: 'Método' },
  { id: 'v2', titulo: 'Resultado Imediato', src: '/media/videos/procedimento-2.mp4', tag: 'Método' },
  { id: 'v3', titulo: 'Massagem Terapêutica', src: '/media/videos/procedimento-3.mp4', tag: 'Método' },
  { id: 'v4', titulo: 'Ambiente Clínico', src: '/media/videos/clinica-tour.mp4', tag: 'Espaço' },
  { id: 'v5', titulo: 'Estrutura Premium', src: '/media/videos/clinica-tour-2.mp4', tag: 'Espaço' },
]

function VideoThumb({ video, onClick }: { video: typeof VIDEOS[0]; onClick: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    if (hovered) ref.current.play().catch(() => {})
    else { ref.current.pause(); ref.current.currentTime = 0 }
  }, [hovered])

  return (
    <div className="group cursor-pointer" onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="relative overflow-hidden bg-[#1a1a1a] aspect-[9/14] transition-all duration-700 group-hover:-translate-y-1">
        <video ref={ref} src={video.src} muted loop playsInline preload="none"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Play */}
        <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-[#b76e79] block mb-2">{video.tag}</span>
          <p className="text-sm font-light text-white">{video.titulo}</p>
        </div>
      </div>
    </div>
  )
}

export default function GaleriaVideos() {
  const [videoAberto, setVideoAberto] = useState<string | null>(null)
  const videoAtual = VIDEOS.find(v => v.id === videoAberto)

  return (
    <section id="galeria" className="relative bg-[#161616] overflow-hidden">
      <div className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          {/* Header */}
          <div className="reveal-blur flex items-end justify-between mb-14">
            <div>
              <span className="text-xs font-medium tracking-[0.3em] uppercase text-[#b76e79] block mb-6">
                Galeria
              </span>
              <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-extralight text-white">
                O método <span className="font-normal text-[#d4a0a7]">em movimento.</span>
              </h2>
            </div>
          </div>

          {/* Grid */}
          <div className="stagger-scale grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {VIDEOS.map(v => (
              <VideoThumb key={v.id} video={v} onClick={() => setVideoAberto(v.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {videoAberto && videoAtual && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4"
          onClick={() => setVideoAberto(null)}>
          <div className="relative w-full max-w-5xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setVideoAberto(null)}
              className="absolute -top-10 right-0 text-white/40 hover:text-white text-[11px] tracking-[0.15em] uppercase flex items-center gap-2 transition-colors">
              Fechar
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="overflow-hidden bg-black">
              <video src={videoAtual.src} controls autoPlay className="w-full aspect-video" />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
