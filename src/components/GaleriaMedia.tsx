// src/components/GaleriaMedia.tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ANTES_DEPOIS } from '@/lib/media-catalog'

interface GaleriaMediaProps {
  tipo?: 'antes-depois' | 'profissionais' | 'procedimentos'
  titulo?: string
  descricao?: string
}

export default function GaleriaMedia({
  tipo = 'antes-depois',
  titulo = 'Galeria de Resultados',
  descricao = 'Veja os resultados reais dos nossos procedimentos',
}: GaleriaMediaProps) {
  const [selectedImage, setSelectedImage] = useState<(typeof ANTES_DEPOIS)[0] | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openModal = (item: (typeof ANTES_DEPOIS)[0]) => {
    setSelectedImage(item)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  return (
    <>
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{titulo}</h2>
            {descricao && (
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">{descricao}</p>
            )}
          </div>

          {/* Grid de Galerias */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ANTES_DEPOIS.map((item) => (
              <div
                key={item.id}
                className="group cursor-pointer"
                onClick={() => openModal(item)}
              >
                {/* Card Antes/Depois */}
                <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300">
                  {/* Container de Imagens */}
                  <div className="relative h-80 bg-slate-200 overflow-hidden">
                    {/* Antes */}
                    <div className="absolute inset-0">
                      <img
                        src={item.antes}
                        alt={`Antes - ${item.procedimento}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        ANTES
                      </div>
                    </div>

                    {/* Overlay Verde no Hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button className="bg-white text-slate-900 px-6 py-2 rounded-lg font-semibold hover:bg-slate-100">
                        Ver Comparação
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {item.procedimento}
                    </h3>
                    <p className="text-sm text-slate-600 mb-3">{item.resultado}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">👨‍⚕️ {item.profissional}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modal de Comparação Antes/Depois */}
      {isModalOpen && selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {selectedImage.procedimento}
                </h2>
                <p className="text-slate-600">👨‍⚕️ {selectedImage.profissional}</p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-slate-900 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Comparação Antes/Depois */}
            <div className="p-6">
              <BeforeAfterSlider
                beforeImage={selectedImage.antes}
                afterImage={selectedImage.depois}
                beforeLabel="Antes"
                afterLabel="Depois"
              />

              {/* Resultado */}
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">✨ Resultado</h3>
                <p className="text-green-800">{selectedImage.resultado}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Componente slider interativo antes/depois
 */
interface BeforeAfterSliderProps {
  beforeImage: string
  afterImage: string
  beforeLabel?: string
  afterLabel?: string
}

function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)

  return (
    <div
      className="relative w-full max-w-2xl mx-auto h-96 overflow-hidden rounded-lg group cursor-ew-resize"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const percentage = ((e.clientX - rect.left) / rect.width) * 100
        setSliderPosition(Math.max(0, Math.min(100, percentage)))
      }}
    >
      {/* Imagem Do (Depois) */}
      <img
        src={afterImage}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Imagem Antes (Antes) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={beforeImage}
          alt={beforeLabel}
          className="w-screen h-full object-cover"
          style={{ width: `${(100 / sliderPosition) * 100}%` }}
        />
      </div>

      {/* Handle do Slider */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Botões nas laterais */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full p-3 shadow-lg">
          <svg
            className="w-4 h-4 text-slate-900"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M8.5 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold pointer-events-none">
        {beforeLabel}
      </div>
      <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold pointer-events-none">
        {afterLabel}
      </div>
    </div>
  )
}
