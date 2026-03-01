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

    // Listen for install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show banner only after 30s of first visit, or after 2nd visit
      const visits = parseInt(localStorage.getItem('myka_visits') || '0', 10) + 1
      localStorage.setItem('myka_visits', String(visits))
      const dismissed = localStorage.getItem('myka_install_dismissed')
      if (!dismissed && visits >= 2) {
        setTimeout(() => setShowInstallBanner(true), 3000)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
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
    setShowInstallBanner(false)
    localStorage.setItem('myka_install_dismissed', Date.now().toString())
  }, [])

  // Don't show anything if already installed
  if (isStandalone || !showInstallBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[10000] safe-area-bottom animate-slide-up">
      <div
        className="mx-3 mb-3 rounded-2xl shadow-2xl border p-4 backdrop-blur-xl"
        style={{
          background: 'rgba(255,255,255,0.97)',
          borderColor: '#b76e7930',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}
          >
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
              <path d="M50 8C50 8 20 30 20 55C20 72 33 88 50 92C67 88 80 72 80 55C80 30 50 8 50 8Z" fill="white" fillOpacity="0.95" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#1a1a1a]">Instale o Myka Spa</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isIOS
                ? 'Toque em Compartilhar ⬆ e "Adicionar à Tela Início"'
                : 'Acesso rápido, notificações e modo offline'}
            </p>
          </div>

          {!isIOS && (
            <button
              onClick={handleInstall}
              className="px-4 py-2 rounded-full text-white text-xs font-semibold whitespace-nowrap transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}
            >
              Instalar
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Fechar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
