// src/components/Header.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { label: 'Método', href: '#metodo' },
  { label: 'Resultados', href: '#resultados' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Galeria', href: '#galeria' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          scrolled
            ? 'bg-[#faf9f7]/90 backdrop-blur-xl'
            : 'bg-transparent'
        }`}
      >
        {/* Subtle bottom line when scrolled */}
        <div className={`absolute bottom-0 left-0 right-0 h-[0.5px] bg-[#2d2d2d]/[0.06] transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />

        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="flex justify-between items-center h-[72px]">
            {/* Logo */}
            <Link href="/" className="relative z-10 group flex items-center gap-3">
              <img
                src="/media/logo-branding/logocorreta.png"
                alt=""
                className={`h-10 w-auto object-contain transition-all duration-500 ${
                  scrolled ? 'brightness-0' : 'invert brightness-200'
                }`}
              />
              <div>
                <span className={`text-base font-normal tracking-[0.06em] transition-colors duration-500 ${
                  scrolled ? 'text-[#2d2d2d]' : 'text-white'
                }`}>
                  Mykaele Procópio
                </span>
                <span className={`block text-[11px] tracking-[0.3em] uppercase font-medium transition-colors duration-500 ${
                  scrolled ? 'text-[#b76e79]' : 'text-[#d4a0a7]'
                }`}>
                  Home Spa
                </span>
              </div>
            </Link>

            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-8">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-xs font-medium tracking-[0.12em] uppercase transition-colors duration-300 ${
                    scrolled
                      ? 'text-[#6a6560] hover:text-[#2d2d2d]'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* CTA + Login + Mobile */}
            <div className="flex items-center gap-3">
              <Link
                href="/cliente"
                className={`hidden sm:inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-[0.1em] uppercase rounded-sm transition-all duration-500 ${
                  scrolled
                    ? 'text-[#b76e79] hover:text-[#8b4a52] border border-[#b76e79]/30 hover:border-[#b76e79]/60'
                    : 'text-white/90 hover:text-white border border-white/30 hover:border-white/60'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Entrar
              </Link>
              <Link
                href="#agendamento"
                className={`hidden sm:inline-flex items-center px-5 py-2.5 text-xs font-bold tracking-[0.15em] uppercase rounded-sm transition-all duration-500 ${
                  scrolled
                    ? 'text-white bg-[#2d2d2d] hover:bg-[#b76e79]'
                    : 'text-[#1a1a1a] bg-white hover:bg-[#b76e79] hover:text-white'
                }`}
              >
                Agendar
              </Link>

              {/* Hamburger */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden relative z-10 w-8 h-8 flex flex-col items-center justify-center gap-[5px]"
              >
                <span className={`block w-5 h-[1px] transition-all duration-300 ${
                  menuOpen ? 'rotate-45 translate-y-[3px]' : ''
                } ${scrolled ? 'bg-[#2d2d2d]' : 'bg-white'}`} />
                <span className={`block w-5 h-[1px] transition-all duration-300 ${
                  menuOpen ? '-rotate-45 -translate-y-[3px]' : ''
                } ${scrolled ? 'bg-[#2d2d2d]' : 'bg-white'}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div className={`fixed inset-0 z-40 bg-[#faf9f7] transition-all duration-500 md:hidden flex flex-col items-start justify-center px-10 gap-6 ${
        menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}
            onClick={() => setMenuOpen(false)}
            className="text-2xl font-extralight text-[#2d2d2d] hover:text-[#b76e79] transition-colors tracking-tight">
            {item.label}
          </Link>
        ))}
        <div className="mt-8 pt-8 border-t border-[#e8dfd6] flex flex-col gap-3">
          <Link href="/cliente" onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-3 px-6 py-3 text-[#b76e79] text-[10px] font-semibold tracking-[0.25em] uppercase border border-[#b76e79]/20 hover:bg-[#b76e79]/5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Área do Cliente
          </Link>
          <Link href="#agendamento" onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-3 px-6 py-3 bg-[#2d2d2d] text-white text-[10px] font-semibold tracking-[0.25em] uppercase">
            Agendar Avaliação
          </Link>
        </div>
      </div>
    </>
  )
}
