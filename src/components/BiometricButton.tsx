'use client'

import { useState, useEffect } from 'react'
import { useWebAuthn } from '@/hooks/useWebAuthn'
import { haptic } from '@/hooks/useHaptic'

/**
 * BiometricButton — Premium biometric login/register UI
 * Shows Face ID / Touch ID / Fingerprint icon based on device
 * Only renders if WebAuthn is supported
 */

interface Props {
  userId?: string
  userName?: string
  mode: 'register' | 'login'
  onSuccess?: (result: any) => void
  onError?: (error: string) => void
  className?: string
}

export default function BiometricButton({ userId, userName, mode, onSuccess, onError, className = '' }: Props) {
  const { register, login, isSupported, checkPlatformAuthenticator, loading, error } = useWebAuthn()
  const [hasAuthenticator, setHasAuthenticator] = useState(false)

  useEffect(() => {
    checkPlatformAuthenticator().then(setHasAuthenticator)
  }, [checkPlatformAuthenticator])

  if (!isSupported || !hasAuthenticator) return null

  const handleClick = async () => {
    haptic('medium')
    try {
      let result
      if (mode === 'register') {
        result = await register(userId || '', userName || '', userName)
        haptic('success')
      } else {
        result = await login(userId || '')
        haptic('success')
      }
      onSuccess?.(result)
    } catch (err: any) {
      haptic('error')
      onError?.(err.message)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        relative group flex items-center justify-center gap-3
        px-6 py-3.5 rounded-2xl
        text-sm font-medium
        transition-all duration-300
        hover:scale-[1.02] active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-wait
        border
        ${className}
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(183,110,121,0.08), rgba(183,110,121,0.03))',
        borderColor: 'rgba(183,110,121,0.2)',
        color: '#b76e79',
      }}
    >
      {/* Fingerprint / Face ID icon */}
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a48.667 48.667 0 00-1.243 3.757M15.75 10.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>

      <span>
        {loading
          ? 'Verificando...'
          : mode === 'register'
            ? '🔐 Cadastrar Biometria'
            : '🔐 Entrar com Biometria'
        }
      </span>

      {/* Loading spinner */}
      {loading && (
        <svg className="w-4 h-4 animate-spin text-[#b76e79]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}

      {/* Shimmer effect */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(183,110,121,0.06), transparent)',
        }}
      />
    </button>
  )
}
