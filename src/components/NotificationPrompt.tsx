'use client'

import { useState, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { haptic } from '@/hooks/useHaptic'

/**
 * NotificationPrompt — Elegant notification permission request
 * Shows after user has interacted with the app (not on first visit)
 * 
 * Much better UX than browser's default permission prompt:
 * - Context about WHY notifications are useful
 * - Custom styled to match brand
 * - Smart timing (not intrusive)
 */

export default function NotificationPrompt() {
  const { permission, isSupported, requestPermission, subscribeToPush } = useNotifications()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isSupported || permission !== 'default') return
    
    // Only show after user has been active for 60s and visited 2+ pages
    const dismissed = localStorage.getItem('myka_notif_dismissed')
    if (dismissed) return

    const timer = setTimeout(() => {
      const pageViews = parseInt(sessionStorage.getItem('myka_page_views') || '0', 10)
      if (pageViews >= 2) setShow(true)
    }, 60000)

    return () => clearTimeout(timer)
  }, [isSupported, permission])

  // Track page views
  useEffect(() => {
    const views = parseInt(sessionStorage.getItem('myka_page_views') || '0', 10)
    sessionStorage.setItem('myka_page_views', String(views + 1))
  }, [])

  const handleAllow = async () => {
    haptic('medium')
    const result = await requestPermission()
    if (result === 'granted') {
      haptic('success')
      await subscribeToPush()
    }
    setShow(false)
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('myka_notif_dismissed', Date.now().toString())
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm animate-fadeIn">
      <div
        className="mx-4 mb-4 sm:mb-0 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ background: '#faf9f7' }}
      >
        {/* Header illustration */}
        <div
          className="h-32 flex items-center justify-center relative"
          style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}
        >
          {/* Bell icon with pulse */}
          <div className="relative">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 animate-ping opacity-50" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-bold">!</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">
            Fique por dentro! 🔔
          </h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Receba lembretes dos seus agendamentos, promoções exclusivas e novidades da Myka Spa direto no celular.
          </p>

          <div className="space-y-2.5">
            <button
              onClick={handleAllow}
              className="w-full py-3 rounded-2xl text-white font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}
            >
              ✨ Sim, quero receber!
            </button>

            <button
              onClick={handleDismiss}
              className="w-full py-2.5 rounded-2xl text-gray-400 text-sm hover:text-gray-500 transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
