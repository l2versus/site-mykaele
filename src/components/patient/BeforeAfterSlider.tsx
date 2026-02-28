// src/components/patient/BeforeAfterSlider.tsx
'use client'

import { useState } from 'react'

interface BeforeAfterSliderProps {
  beforeImage: string
  afterImage: string
  procedure: string
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  procedure,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50)

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
      <div className="relative h-96 overflow-hidden">
        {/* After Image */}
        <div className="absolute inset-0">
          <img
            src={afterImage}
            alt="Depois"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Before Image (with position slider) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${100 - position}%` }}
        >
          <img
            src={beforeImage}
            alt="Antes"
            className="w-screen h-full object-cover"
            style={{ width: `${100 * (100 / (100 - position))}%` }}
          />
        </div>

        {/* Divider Line */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize"
          style={{ left: `${100 - position}%` }}
          draggable
          onDrag={(e) => {
            if (e.clientX > 0) {
              const container = e.currentTarget.parentElement
              if (container) {
                const rect = container.getBoundingClientRect()
                const newPos = Math.max(
                  0,
                  Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
                )
                setPosition(100 - newPos)
              }
            }
          }}
        >
          {/* Labels */}
          <div className="absolute -left-8 top-4 text-white text-xs font-medium bg-slate-900 px-2 py-1 rounded">
            ANTES
          </div>
          <div className="absolute -right-8 top-4 text-white text-xs font-medium bg-slate-900 px-2 py-1 rounded">
            DEPOIS
          </div>
        </div>

        {/* Slider Input */}
        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="absolute bottom-4 left-4 right-4 z-10 cursor-pointer"
        />
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-slate-900">{procedure}</h3>
        <p className="text-sm text-slate-600 mt-1">
          Deslize para comparar antes e depois
        </p>
      </div>
    </div>
  )
}
