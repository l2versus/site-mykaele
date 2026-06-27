// src/components/Header.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { label: 'Método', href: '#metodo' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Resultados', href: '#resultados' },
  { label: 'Sobre', href: '#sobre' },
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
          scrolled || menuOpen ? 'bg-nude/90 backdrop-blur-xl' : 'bg-transparent'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Champagne hairline when scrolled */}
        <div className={`absolute bottom-0 left-0 right-0 h-px bg-champagne/25 transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />

        <div className="max-w-[1500px] mx-auto px-6 md:px-10">
          <div className="flex justify-between items-center h-[72px]">
            {/* Logo */}
            <Link href="/" onClick={() => setMenuOpen(false)} className="relative z-[70] group flex items-center gap-3">
              <span
                role="img"
                aria-label="Mykaele Procópio Home Spa"
                className="block h-10 w-9 shrink-0 bg-champagne transition-transform duration-500 group-hover:scale-105"
                style={{
                  WebkitMaskImage: "url('/media/logo-branding/logocorreta.png')",
                  maskImage: "url('/media/logo-branding/logocorreta.png')",
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
              />
              <div>
                <span className="block text-[15px] tracking-[0.08em] text-espresso font-[family-name:var(--font-display)]">
                  Mykaele Procópio
                </span>
                <span className="block text-[10px] tracking-[0.3em] uppercase font-medium text-champagne">
                  Home Spa
                </span>
              </div>
            </Link>

            {/* Nav desktop */}
            <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative text-[11px] font-medium tracking-[0.18em] uppercase text-taupe hover:text-espresso transition-colors duration-300 font-[family-name:var(--font-body)] py-1"
                >
                  {item.label}
                  <span className="absolute left-0 -bottom-0.5 h-px w-0 bg-champagne transition-all duration-500 group-hover:w-full" />
                </Link>
              ))}
            </nav>

            {/* Admin + Entrar + Agendar + Mobile */}
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 text-[10px] font-semibold tracking-[0.16em] uppercase rounded-[3px] text-espresso/80 hover:text-espresso border border-espresso/15 hover:border-espresso/35 bg-nude/55 backdrop-blur-md transition-all duration-500 font-[family-name:var(--font-body)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                Admin
              </Link>
              <Link
                href="/cliente"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 text-[10px] font-semibold tracking-[0.16em] uppercase rounded-[3px] text-[#8c6f42] hover:text-espresso border border-champagne/50 hover:border-champagne bg-nude/45 hover:bg-champagne/10 backdrop-blur-md transition-all duration-500 font-[family-name:var(--font-body)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Entrar
              </Link>
              <Link
                href="#agendamento"
                className="hidden sm:inline-flex items-center px-5 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase rounded-[3px] text-porcelain bg-espresso hover:bg-champagne transition-all duration-500 font-[family-name:var(--font-body)]"
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
                <span className={`block w-5 h-px bg-espresso transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[3px]' : ''}`} />
                <span className={`block w-5 h-px bg-espresso transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[3px]' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <nav aria-label="Menu mobile" className={`fixed inset-0 z-[55] bg-nude transition-all duration-500 md:hidden flex flex-col items-start px-10 gap-5 overflow-y-auto ${
        menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 90px)', paddingBottom: '2rem' }}
      >
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}
            onClick={() => setMenuOpen(false)}
            className="text-[2rem] font-[family-name:var(--font-display)] text-espresso hover:text-champagne transition-colors tracking-tight">
            {item.label}
          </Link>
        ))}
        <div className="mt-6 pt-6 border-t border-champagne/20 flex flex-col gap-3 w-full">
          <Link href="/cliente" onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-3 px-6 py-3 text-champagne text-[10px] font-semibold tracking-[0.25em] uppercase border border-champagne/30 hover:bg-champagne/5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Área do Cliente
          </Link>
          <Link href="/admin" onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-3 px-6 py-3 text-espresso text-[10px] font-semibold tracking-[0.25em] uppercase border border-espresso/20 hover:bg-espresso/5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            Painel Admin
          </Link>
          <Link href="#agendamento" onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-3 px-6 py-3 bg-espresso text-porcelain text-[10px] font-semibold tracking-[0.25em] uppercase">
            Agendar Avaliação
          </Link>
        </div>
      </nav>
    </>
  )
}
