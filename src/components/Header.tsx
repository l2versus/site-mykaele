// src/components/Header.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
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
        className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-700 ${
          scrolled || menuOpen
            ? 'bg-[#faf9f7]/90 backdrop-blur-xl'
            : 'bg-transparent'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Subtle bottom line when scrolled */}
        <div className={`absolute bottom-0 left-0 right-0 h-[0.5px] bg-[#2d2d2d]/[0.06] transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />

        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="flex justify-between items-center h-[72px]">
            {/* Logo */}
            <Link href="/" onClick={() => setMenuOpen(false)} className="relative z-[70] group flex items-center gap-3">
              <Image
                src="/media/logo-branding/logocorreta.png"
                alt="Mykaele Procópio Home Spa"
                width={40}
                height={40}
                className={`h-10 w-auto object-contain transition-all duration-500 ${
                  scrolled ? 'brightness-0' : 'invert brightness-200'
                }`}
                priority
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
            <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-8">
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

            {/* CTA + Login + Admin + Mobile */}
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className={`hidden md:inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-[0.1em] uppercase rounded-sm transition-all duration-500 ${
                  scrolled
                    ? 'text-[#6a6560] hover:text-[#2d2d2d] border border-[#6a6560]/20 hover:border-[#2d2d2d]/40'
                    : 'text-white/60 hover:text-white border border-white/20 hover:border-white/40'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                Admin
              </Link>
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
                aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu de navegação'}
                aria-expanded={menuOpen}
                className="md:hidden relative z-[70] w-8 h-8 flex flex-col items-center justify-center gap-[5px]"
              >
                <span className={`block w-5 h-[1px] transition-all duration-300 ${
                  menuOpen ? 'rotate-45 translate-y-[3px] bg-[#2d2d2d]' : ''
                } ${!menuOpen && scrolled ? 'bg-[#2d2d2d]' : !menuOpen ? 'bg-white' : ''}`} />
                <span className={`block w-5 h-[1px] transition-all duration-300 ${
                  menuOpen ? '-rotate-45 -translate-y-[3px] bg-[#2d2d2d]' : ''
                } ${!menuOpen && scrolled ? 'bg-[#2d2d2d]' : !menuOpen ? 'bg-white' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <nav aria-label="Menu mobile" className={`fixed inset-0 z-[55] bg-[#faf9f7] transition-all duration-500 md:hidden flex flex-col items-start px-10 gap-5 overflow-y-auto ${
        menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 90px)', paddingBottom: '2rem' }}
      >
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}
            onClick={() => setMenuOpen(false)}
            className="text-2xl font-extralight text-[#2d2d2d] hover:text-[#b76e79] transition-colors tracking-tight">
            {item.label}
          </Link>
        ))}
        <div className="mt-6 pt-6 border-t border-[#e8dfd6] flex flex-col gap-3 w-full">
          <Link href="/cliente" onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-3 px-6 py-3 text-[#b76e79] text-[10px] font-semibold tracking-[0.25em] uppercase border border-[#b76e79]/20 hover:bg-[#b76e79]/5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Área do Cliente
          </Link>
          <Link href="/admin" onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-3 px-6 py-3 text-[#2d2d2d] text-[10px] font-semibold tracking-[0.25em] uppercase border border-[#2d2d2d]/20 hover:bg-[#2d2d2d]/5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            Painel Admin
          </Link>
          <Link href="#agendamento" onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-3 px-6 py-3 bg-[#2d2d2d] text-white text-[10px] font-semibold tracking-[0.25em] uppercase">
            Agendar Avaliação
          </Link>
        </div>
      </nav>
    </>
  )
}
