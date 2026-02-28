// src/components/SectionNav.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'

const SECTIONS = [
  { id: 'hero', label: 'Início' },
  { id: 'metodo', label: 'Método' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'sobre', label: 'Sobre' },
  { id: 'depoimentos', label: 'Depoimentos' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'galeria', label: 'Galeria' },
  { id: 'tecnologias', label: 'Tecnologias' },
  { id: 'agendamento', label: 'Agendar' },
]

export function SectionNav() {
  const [active, setActive] = useState('hero')
  const [visible, setVisible] = useState(false)

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY
    // Só mostra depois do hero (após ~50vh)
    setVisible(scrollY > window.innerHeight * 0.5)

    // Detecta a seção ativa
    let current = 'hero'
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id)
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= window.innerHeight * 0.4) {
          current = section.id
        }
      }
    }
    setActive(current)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav
      className={`fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-end gap-3 transition-all duration-700 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
      }`}
    >
      {SECTIONS.map((section) => {
        const isActive = active === section.id
        return (
          <button
            key={section.id}
            onClick={() => scrollTo(section.id)}
            className="group flex items-center gap-3 py-0.5"
            aria-label={`Ir para ${section.label}`}
          >
            {/* Label — aparece no hover */}
            <span
              className={`text-[10px] font-medium tracking-[0.15em] uppercase transition-all duration-300 ${
                isActive
                  ? 'text-[#b76e79] opacity-100 translate-x-0'
                  : 'text-[#6a6560] opacity-0 translate-x-2 group-hover:opacity-70 group-hover:translate-x-0'
              }`}
            >
              {section.label}
            </span>

            {/* Dot */}
            <span className="relative flex items-center justify-center w-4 h-4">
              {/* Ring ativo */}
              <span
                className={`absolute inset-0 rounded-full border transition-all duration-500 ${
                  isActive
                    ? 'border-[#b76e79]/50 scale-100 opacity-100'
                    : 'border-transparent scale-50 opacity-0'
                }`}
              />
              {/* Dot central */}
              <span
                className={`rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-2 h-2 bg-[#b76e79] shadow-sm shadow-[#b76e79]/30'
                    : 'w-1.5 h-1.5 bg-[#9a9590]/30 group-hover:bg-[#b76e79]/50 group-hover:scale-125'
                }`}
              />
            </span>
          </button>
        )
      })}

      {/* Linha decorativa vertical */}
      <div className="absolute right-[7px] top-2 bottom-2 w-[1px] bg-[#9a9590]/10 -z-10" />
    </nav>
  )
}
