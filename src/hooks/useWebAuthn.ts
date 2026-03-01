'use client'

import { useState, useCallback } from 'react'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

/**
 * useWebAuthn — Hook for biometric/passkey authentication
 * 
 * Usage:
 *   const { register, login, isSupported, loading, error } = useWebAuthn()
 *   await register(userId, userName)  // Cadastra biometria
 *   await login(userId)               // Login com biometria
 */

export function useWebAuthn() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if WebAuthn is supported
  const isSupported = typeof window !== 'undefined'
    && !!window.PublicKeyCredential
    && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'

  const checkPlatformAuthenticator = useCallback(async () => {
    if (!isSupported) return false
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch {
      return false
    }
  }, [isSupported])

  // Register new biometric credential
  const register = useCallback(async (userId: string, userName: string, displayName?: string) => {
    setLoading(true)
    setError(null)
    try {
      // 1. Get registration options from server  
      const optionsRes = await fetch('/api/auth/webauthn?action=register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName, userDisplayName: displayName }),
      })
      const options = await optionsRes.json()
      if (!optionsRes.ok) throw new Error(options.error || 'Erro ao gerar opções')

      // 2. Start WebAuthn registration (triggers biometric prompt)
      const attResp = await startRegistration({ optionsJSON: options })

      // 3. Verify with server
      const verifyRes = await fetch('/api/auth/webauthn?action=register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, response: attResp }),
      })
      const result = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(result.error || 'Falha na verificação')

      return result
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Biometria cancelada pelo usuário'
        : err.message || 'Erro no cadastro biométrico'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Login with biometric
  const login = useCallback(async (userId: string) => {
    setLoading(true)
    setError(null)
    try {
      // 1. Get authentication options
      const optionsRes = await fetch('/api/auth/webauthn?action=login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const options = await optionsRes.json()
      if (!optionsRes.ok) throw new Error(options.error || 'Erro ao gerar opções')

      // 2. Start authentication (triggers biometric prompt)
      const authResp = await startAuthentication({ optionsJSON: options })

      // 3. Verify with server
      const verifyRes = await fetch('/api/auth/webauthn?action=login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, response: authResp }),
      })
      const result = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(result.error || 'Falha na autenticação')

      return result
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Autenticação cancelada'
        : err.message || 'Erro na autenticação biométrica'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    register,
    login,
    isSupported,
    checkPlatformAuthenticator,
    loading,
    error,
  }
}
