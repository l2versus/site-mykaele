'use client'

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true
    setIsStandalone(standalone)

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(ios)

    // Desktop detection
    const desktop = window.innerWidth >= 1024 && !(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
    setIsDesktop(desktop)

    // Listen for install prompt (Android/Chrome/Edge)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show banner on first visit after 4s
      const dismissed = localStorage.getItem('myka_install_dismissed')
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 4000)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Also show iOS banner on first visit
    if (ios && !standalone) {
      const dismissed = localStorage.getItem('myka_install_dismissed')
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 4000)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        setShowInstallBanner(false)
      }
      setDeferredPrompt(null)
    }
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setShowInstallBanner(false)
      setClosing(false)
      localStorage.setItem('myka_install_dismissed', Date.now().toString())
    }, 300)
  }, [])

  // Don't show anything if already installed
  if (isStandalone || !showInstallBanner) return null

  return (
    <>
      {/* Overlay escuro */}
      <div
        className={`fixed inset-0 z-[9999] transition-opacity duration-300 ${closing ? 'opacity-0' : 'opacity-100'}`}
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={handleDismiss}
      />

      {/* Modal central */}
      <div
        className={`fixed z-[10000] transition-all duration-300 ${closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
        style={{
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) ${closing ? 'scale(0.95)' : 'scale(1)'}`,
          width: isDesktop ? '420px' : 'calc(100% - 32px)',
          maxWidth: '420px',
        }}
      >
        <div
          className="rounded-3xl shadow-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.99)' }}
        >
          {/* Header com gradiente */}
          <div
            className="relative px-6 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}
          >
            {/* Botão fechar */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
              aria-label="Fechar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Ícone do app */}
            <div className="mx-auto w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg border border-white/30">
              <img
                src="/icon-192x192.png"
                alt="Myka Spa"
                className="w-14 h-14 rounded-xl"
              />
            </div>

            <h2 className="text-white text-xl font-bold tracking-tight">
              Myka Spa
            </h2>
            <p className="text-white/80 text-sm mt-1">
              Estética Avançada & Arquitetura Corporal
            </p>
          </div>

          {/* Corpo */}
          <div className="px-6 py-5">
            {/* Benefícios */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#b76e7915' }}>
                  <svg className="w-5 h-5" style={{ color: '#b76e79' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">Acesso instantâneo</p>
                  <p className="text-xs text-gray-500">Abra direto da tela inicial{isDesktop ? ' ou Menu Iniciar' : ''}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#b76e7915' }}>
                  <svg className="w-5 h-5" style={{ color: '#b76e79' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">Notificações</p>
                  <p className="text-xs text-gray-500">Receba lembretes dos seus agendamentos</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#b76e7915' }}>
                  <svg className="w-5 h-5" style={{ color: '#b76e79' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">Funciona offline</p>
                  <p className="text-xs text-gray-500">Consulte seus dados mesmo sem internet</p>
                </div>
              </div>
            </div>

            {/* Botões */}
            {isIOS ? (
              <div className="text-center">
                <div className="bg-gray-50 rounded-2xl p-4 mb-3">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Toque no botão <span className="inline-flex items-center align-middle mx-1 px-2 py-0.5 bg-gray-200 rounded text-xs font-medium">
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Compartilhar
                    </span> do Safari e depois em <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-full py-3 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Agora não
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleInstall}
                  className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}
                >
                  📲 Instalar Aplicativo Grátis
                </button>
                <button
                  onClick={handleDismiss}
                  className="w-full py-3 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Agora não
                </button>
              </div>
            )}

            {isDesktop && !isIOS && (
              <p className="text-center text-[10px] text-gray-400 mt-3">
                ✓ Aparece no Menu Iniciar do Windows &bull; Sem ocupar espaço
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
