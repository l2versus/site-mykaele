'use client'

import { useState, useEffect, ReactNode, useCallback, createContext, useContext } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ClientContextProvider, ClientContextType, ClientUser, useClient } from './ClientContext'
import { CartProvider, useCart } from './CartContext'
import PageTransition from '@/components/PageTransition'
import NotificationPrompt from '@/components/NotificationPrompt'
import { haptic } from '@/hooks/useHaptic'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

/* ─── SVG Icons ─── */
const Icons = {
  home: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/></svg>,
  journey: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  agenda: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  book: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14v4m-2-2h4"/></svg>,
  profile: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  whatsapp: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  bell: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  heart: <svg width="28" height="28" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
}

/* ─── Leaf Logo PNG ─── */
function LeafLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/media/logo-branding/logocorreta.png"
      alt="Mykaele Procópio"
      className={className}
      style={{ objectFit: 'contain' }}
      draggable={false}
    />
  )
}

const NAV_ITEMS = [
  { href: '/cliente', label: 'Início', icon: Icons.home },
  { href: '/cliente/anamnese', label: 'Anamnese', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> },
  { href: '/cliente/fidelidade', label: 'VIP', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
  { href: '/cliente/agendamentos', label: 'Agenda', icon: Icons.agenda },
  { href: '/cliente/perfil', label: 'Perfil', icon: Icons.profile },
]

/* ─── Email Verification Banner ─── */
function EmailVerificationBanner() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Verificar se já foi dispensado nesta sessão
  useEffect(() => {
    const was = sessionStorage.getItem('email_verification_dismissed')
    if (was) setDismissed(true)
  }, [])

  const handleResend = async () => {
    setSending(true)
    try {
      const token = localStorage.getItem('client_token')
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setSent(true)
        haptic('success')
      } else {
        alert(data.error || 'Erro ao enviar email')
        haptic('error')
      }
    } catch {
      alert('Erro de conexão')
    } finally {
      setSending(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('email_verification_dismissed', '1')
  }

  if (dismissed) return null

  return (
    <div className="mx-5 mt-3 mb-0">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4">
        {/* Dismiss button */}
        <button onClick={handleDismiss} className="absolute top-2 right-2 p-1.5 text-white/20 hover:text-white/40 transition-colors">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-amber-400">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-sm font-medium mb-1">Confirme seu email</p>
            <p className="text-white/40 text-xs leading-relaxed mb-3">
              {sent 
                ? 'Email enviado! Verifique sua caixa de entrada e spam.'
                : 'Para garantir acesso completo ao app, confirme seu email.'}
            </p>
            {!sent && (
              <button 
                onClick={handleResend} 
                disabled={sending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium transition-all disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <div className="w-3 h-3 border border-amber-300/40 border-t-amber-300 rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                    Reenviar email
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Auth Screen ─── */
function AuthScreen({ onLogin }: { onLogin: (token: string, user: ClientUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', referralCode: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)

  // Auto-fill referral code from URL ?ref=XXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const refCode = params.get('ref')
    if (refCode) {
      setForm(prev => ({ ...prev, referralCode: refCode.toUpperCase() }))
      setMode('register')
      // Clean URL
      window.history.replaceState({}, '', '/cliente')
    }
  }, [])

  // ═══ Biometric / Passkey state ═══
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)

  // Check if device supports biometric login
  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) return
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        // Show biometric button on any device that supports it
        setBiometricAvailable(available)
      } catch {}
    })()
  }, [])

  const hasBiometricCreds = typeof window !== 'undefined' && !!localStorage.getItem('myka_biometric_user')

  // Biometric login handler
  const handleBiometricLogin = async () => {
    setBiometricLoading(true)
    setError('')
    haptic('medium')
    try {
      const savedUser = localStorage.getItem('myka_biometric_user')
      if (!savedUser) {
        setError('Faça login uma vez com e-mail/senha para ativar a biometria no próximo acesso.')
        haptic('light')
        setBiometricLoading(false)
        return
      }
      const { email, token: savedToken } = JSON.parse(savedUser)
      
      // Verify the saved token is still valid
      const res = await fetch('/api/patient/profile', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        haptic('success')
        onLogin(savedToken, data.patient || data)
      } else {
        // Token expired, need to re-authenticate
        localStorage.removeItem('myka_biometric_user')
        setError('Sessão expirada. Faça login novamente para reativar a biometria.')
        haptic('error')
      }
    } catch (err: any) {
      haptic('error')
      setError(err.message || 'Erro na autenticação biométrica')
    } finally {
      setBiometricLoading(false)
    }
  }

  // Capturar OAuth callback da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthToken = params.get('oauth_token')
    const oauthUser = params.get('oauth_user')
    const authError = params.get('auth_error')
    const oauthProvider = params.get('oauth_provider')

    if (authError) {
      setError(decodeURIComponent(authError))
      // Limpar URL
      window.history.replaceState({}, '', '/cliente')
      return
    }

    if (oauthToken && oauthUser) {
      try {
        const user = JSON.parse(decodeURIComponent(oauthUser))
        // Limpar URL antes de fazer login
        window.history.replaceState({}, '', '/cliente')

        // Se veio do Instagram e precisa atualizar email, salvar e continuar
        if (user.needsEmailUpdate) {
          // Salvar token temporário e mostrar modal de email
          localStorage.setItem('_pending_oauth_token', oauthToken)
          localStorage.setItem('_pending_oauth_user', JSON.stringify(user))
          localStorage.setItem('_pending_oauth_provider', oauthProvider || '')
          setShowEmailLink(true)
          return
        }

        // Se veio do Google e não tem telefone, mostrar modal para vincular
        if (oauthProvider === 'google' && !user.phone) {
          localStorage.setItem('_pending_oauth_token', oauthToken)
          localStorage.setItem('_pending_oauth_user', JSON.stringify(user))
          setShowPhoneLink(true)
          return
        }

        onLogin(oauthToken, user)
      } catch {
        setError('Erro ao processar login social')
      }
    }
  }, [onLogin])

  // Modal para vincular email (Instagram não fornece email)
  const [showEmailLink, setShowEmailLink] = useState(false)
  const [linkForm, setLinkForm] = useState({ email: '', name: '', phone: '' })
  const [linkLoading, setLinkLoading] = useState(false)

  // Modal para vincular telefone (Google Auth sem telefone)
  const [showPhoneLink, setShowPhoneLink] = useState(false)
  const [phoneForm, setPhoneForm] = useState('')
  const [phoneLinkLoading, setPhoneLinkLoading] = useState(false)

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLinkLoading(true); setError('')
    try {
      const token = localStorage.getItem('_pending_oauth_token')!
      const res = await fetch('/api/auth/link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(linkForm),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao vincular email'); setLinkLoading(false); return }
      localStorage.removeItem('_pending_oauth_token')
      localStorage.removeItem('_pending_oauth_user')
      localStorage.removeItem('_pending_oauth_provider')
      setShowEmailLink(false)
      onLogin(data.token, data.user)
    } catch { setError('Erro de conexão') } finally { setLinkLoading(false) }
  }

  const skipEmailLink = () => {
    const token = localStorage.getItem('_pending_oauth_token')
    const userStr = localStorage.getItem('_pending_oauth_user')
    if (token && userStr) {
      const user = JSON.parse(userStr)
      localStorage.removeItem('_pending_oauth_token')
      localStorage.removeItem('_pending_oauth_user')
      localStorage.removeItem('_pending_oauth_provider')
      setShowEmailLink(false)
      onLogin(token, user)
    }
  }

  // Handler para vincular telefone
  const handleLinkPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhoneLinkLoading(true); setError('')
    try {
      const token = localStorage.getItem('_pending_oauth_token')!
      const res = await fetch('/api/auth/link-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ phone: phoneForm }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao vincular telefone'); setPhoneLinkLoading(false); return }
      
      localStorage.removeItem('_pending_oauth_token')
      localStorage.removeItem('_pending_oauth_user')
      setShowPhoneLink(false)
      
      // Se houve merge, usar o novo token e user
      if (data.merged) {
        onLogin(data.token, data.user)
      } else {
        onLogin(token, data.user)
      }
    } catch { setError('Erro de conexão') } finally { setPhoneLinkLoading(false) }
  }

  const skipPhoneLink = () => {
    const token = localStorage.getItem('_pending_oauth_token')
    const userStr = localStorage.getItem('_pending_oauth_user')
    if (token && userStr) {
      const user = JSON.parse(userStr)
      localStorage.removeItem('_pending_oauth_token')
      localStorage.removeItem('_pending_oauth_user')
      setShowPhoneLink(false)
      onLogin(token, user)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    haptic('light')
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login' ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password, confirmPassword: form.confirmPassword, phone: form.phone, referralCode: form.referralCode || undefined }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { haptic('error'); setError(data.error || data.issues?.[0]?.message || 'Erro'); return }
      haptic('success')
      // Save for biometric quick-login next time
      try {
        if (window.PublicKeyCredential) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          if (available) {
            localStorage.setItem('myka_biometric_user', JSON.stringify({
              email: form.email,
              token: data.token,
              name: data.user?.name || form.name,
            }))
          }
        }
      } catch {}
      onLogin(data.token, data.user)
    } catch { setError('Erro de conexão') } finally { setLoading(false) }
  }

  const handleSocial = (provider: 'google' | 'instagram') => {
    setSocialLoading(provider)
    window.location.href = `/api/auth/${provider}?mode=${mode}`
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-[100vw] bg-gradient-to-b from-[#0e0b10] via-[#100d14] to-[#0e0b10] flex relative overflow-hidden">
      {/* Pattern watermark — cor real + blur + degradê escuro */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] blur-[1px]" style={{ backgroundImage: 'url(/media/logo-branding/pattern-leaf.png)', backgroundSize: '280px', backgroundRepeat: 'repeat' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0e0b10]/80 via-[#0e0b10]/60 to-[#0e0b10]/90" />
      </div>

      {/* ── Left Panel: Arte visual abstrata (sem foto) ── */}
      <div className="hidden lg:flex w-[44%] relative items-center justify-center overflow-hidden">
        {/* Fundo gradiente artístico */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0e0b10] via-[#1a1018] to-[#0e0b10]" />

        {/* Orbes de luz rosé */}
        <div className="absolute top-1/4 left-1/3 w-[280px] h-[280px] bg-[#b76e79]/[0.06] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[200px] h-[200px] bg-[#d4a0a7]/[0.04] rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-[#c28a93]/[0.05] rounded-full blur-[60px]" />

        {/* Leaf grande central como arte */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <LeafLogo className="w-32 h-48 text-[#b76e79]/[0.12]" />
            <div className="absolute inset-0 blur-xl">
              <LeafLogo className="w-32 h-48 text-[#b76e79]/[0.06]" />
            </div>
          </div>

          {/* Linhas decorativas finas */}
          <div className="mt-8 flex items-center gap-4">
            <div className="w-12 h-[0.5px] bg-gradient-to-r from-transparent to-[#b76e79]/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#b76e79]/15" />
            <div className="w-12 h-[0.5px] bg-gradient-to-l from-transparent to-[#b76e79]/20" />
          </div>

          <p className="mt-6 text-white/15 text-[10px] tracking-[0.35em] uppercase font-light">
            Sua Jornada de Transformação
          </p>
          <p className="mt-2 text-white/8 text-[10px] tracking-[0.2em] uppercase">
            Começa Aqui
          </p>
        </div>

        {/* Leaf decorativas nos cantos */}
        <LeafLogo className="absolute top-12 left-10 w-[50px] h-[50px] text-[#b76e79]/[0.04] -rotate-30" />
        <LeafLogo className="absolute bottom-16 right-12 w-[40px] h-[40px] text-[#b76e79]/[0.035] rotate-15" />
        <LeafLogo className="absolute top-1/3 right-8 w-[30px] h-[30px] text-[#d4a0a7]/[0.03] rotate-45" />

        {/* Linhas verticais decorativas */}
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[#b76e79]/10 to-transparent" />
        <div className="absolute top-[20%] left-6 w-[0.5px] h-[30%] bg-gradient-to-b from-transparent via-[#b76e79]/5 to-transparent" />
      </div>

      {/* ── Right Panel: Auth Form ── */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-5 relative z-10 min-w-0">
        {/* Glow sutil */}
        <div className="absolute top-1/4 right-1/3 w-[180px] sm:w-[250px] h-[180px] sm:h-[250px] bg-[#b76e79]/[0.015] rounded-full blur-[110px] pointer-events-none" />

        <div className="w-full max-w-[min(28rem,100%)]">
          {/* Botão Voltar */}
          <a href="/" className="inline-flex items-center gap-2 text-white/30 hover:text-white/60 text-xs mb-6 transition-colors group">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:-translate-x-1 transition-transform">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Voltar ao site
          </a>

          {/* Brand */}
          <div className="text-center mb-10">
            <div className="mb-5 flex justify-center">
              <div className="relative">
                <LeafLogo className="w-10 h-15 text-[#b76e79]/45" />
                <div className="absolute inset-0 blur-sm"><LeafLogo className="w-10 h-15 text-[#b76e79]/10" /></div>
              </div>
            </div>
            <h1 className="text-[24px] font-extralight text-white/85 tracking-wide">Mykaele Procópio</h1>
            <p className="text-[#c28a93]/40 text-[9px] font-semibold tracking-[0.4em] uppercase mt-1.5">Home Spa · Arquitetura Corporal</p>
          </div>

        {/* Tabs */}
        <div className="flex bg-white/[0.03] border border-white/[0.05] rounded-2xl p-1 mb-7">
          <button onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'login' ? 'bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/15' : 'text-white/25 hover:text-white/40'}`}>
            Entrar
          </button>
          <button onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'register' ? 'bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/15' : 'text-white/25 hover:text-white/40'}`}>
            Criar Conta
          </button>
        </div>

        {/* ═══ Biometric Quick Login ═══ */}
        {mode === 'login' && biometricAvailable && (
          <div className="mb-5">
            <button
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 group"
              style={{
                background: hasBiometricCreds
                  ? 'linear-gradient(135deg, rgba(183,110,121,0.18), rgba(183,110,121,0.06))'
                  : 'linear-gradient(135deg, rgba(183,110,121,0.08), rgba(183,110,121,0.02))',
                borderColor: hasBiometricCreds ? 'rgba(183,110,121,0.35)' : 'rgba(183,110,121,0.15)',
              }}
            >
              {biometricLoading ? (
                <div className="w-6 h-6 border-2 border-[#b76e79]/40 border-t-[#b76e79] rounded-full animate-spin" />
              ) : (
                <svg className="w-7 h-7 text-[#d4a0a7] group-hover:text-[#b76e79] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a48.667 48.667 0 00-1.243 3.757M15.75 10.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
              <div className="text-left">
                <span className="text-[#d4a0a7] text-sm font-medium block group-hover:text-[#b76e79] transition-colors">
                  {biometricLoading ? 'Verificando...' : hasBiometricCreds ? 'Entrar com Biometria' : 'Login com Biometria'}
                </span>
                <span className="text-white/20 text-[10px]">
                  {hasBiometricCreds ? 'Face ID · Impressão Digital · PIN' : 'Faça login uma vez para ativar'}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-3 mt-5 mb-0">
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-white/10 text-[9px] font-medium tracking-wider uppercase">ou</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
          </div>
        )}

        {/* Social Buttons */}
        <div className="space-y-2.5 mb-6">
          <button onClick={() => handleSocial('google')} disabled={!!socialLoading}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl hover:bg-white/[0.06] hover:border-white/[0.1] transition-all group disabled:opacity-50">
            {socialLoading === 'google' ? (
              <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-transparent rounded-full animate-spin shrink-0" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="text-white/50 text-sm font-medium group-hover:text-white/70 transition-colors">
              {socialLoading === 'google' ? 'Conectando...' : mode === 'login' ? 'Entrar com Google' : 'Cadastrar com Google'}
            </span>
          </button>

          {/* Instagram login — desativado temporariamente
          <button onClick={() => handleSocial('instagram')} disabled={!!socialLoading}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl hover:bg-white/[0.06] hover:border-white/[0.1] transition-all group disabled:opacity-50">
            {socialLoading === 'instagram' ? (
              <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-transparent rounded-full animate-spin shrink-0" />
            ) : (
              <div className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </div>
            )}
            <span className="text-white/50 text-sm font-medium group-hover:text-white/70 transition-colors">
              {socialLoading === 'instagram' ? 'Conectando...' : mode === 'login' ? 'Entrar com Instagram' : 'Cadastrar com Instagram'}
            </span>
          </button>
          */}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/[0.04]" />
          <span className="text-white/10 text-[9px] font-medium tracking-wider uppercase">ou com e-mail</span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>

        <form onSubmit={handleSubmit} className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
          <div className="relative border border-white/[0.07] rounded-3xl p-7 space-y-4 backdrop-blur-xl">
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}
          {mode === 'register' && (
            <div>
              <label className="block text-white/35 text-[11px] mb-1.5 font-medium tracking-wide">Nome completo</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all"
                placeholder="Seu nome" />
            </div>
          )}
          <div>
            <label className="block text-white/35 text-[11px] mb-1.5 font-medium tracking-wide">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
              className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all"
              placeholder="seu@email.com" />
          </div>
          <div>
            <label className="block text-white/35 text-[11px] mb-1.5 font-medium tracking-wide">Senha</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
              className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all"
              placeholder="••••••••" />
            {mode === 'register' && form.password && (
              <p className="text-[10px] text-white/40 mt-1.5 font-light">
                ✓ Mínimo 6 caracteres {form.password.length >= 6 ? '✓' : ''}
              </p>
            )}
          </div>
          {mode === 'register' && (
            <div>
              <label className="block text-white/35 text-[11px] mb-1.5 font-medium tracking-wide">Confirmar Senha</label>
              <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} required
                className={`w-full px-4 py-3.5 bg-white/[0.03] border rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:ring-1 transition-all ${
                  form.confirmPassword && form.password !== form.confirmPassword 
                    ? 'border-red-500/30 focus:border-red-500/40 focus:ring-red-500/15'
                    : 'border-white/[0.06] focus:border-[#b76e79]/40 focus:ring-[#b76e79]/15'
                }`}
                placeholder="••••••••" />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-[10px] text-red-400/70 mt-1.5">✗ Senhas não conferem</p>
              )}
              {form.confirmPassword && form.password === form.confirmPassword && (
                <p className="text-[10px] text-emerald-400/70 mt-1.5">✓ Senhas conferem</p>
              )}
            </div>
          )}
          {mode === 'register' && (
            <div>
              <label className="block text-white/35 text-[11px] mb-1.5 font-medium tracking-wide">Telefone <span className="text-white/10">(opcional)</span></label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all"
                placeholder="(00) 00000-0000" />
            </div>
          )}
          {mode === 'register' && (
            <div>
              <label className="block text-white/35 text-[11px] mb-1.5 font-medium tracking-wide">Código de Indicação <span className="text-white/10">(opcional)</span></label>
              <input value={form.referralCode} onChange={e => setForm({ ...form, referralCode: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all uppercase tracking-wider"
                placeholder="Ex: MYKA-ANA2024" />
              <p className="text-[10px] text-[#b76e79]/50 mt-1">💎 Ganhe 100 pontos VIP ao usar um código de indicação</p>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white font-medium shadow-xl shadow-[#b76e79]/20 hover:shadow-[#b76e79]/35 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 mt-2">
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar minha conta'}
          </button>
          </div>
        </form>

        <p className="text-center text-white/8 text-[9px] mt-10 tracking-wider">Experiencia Exclusiva de Bem-Estar</p>
        </div>
      </div>

      {/* ── Modal: Vincular email (Instagram não fornece email) ── */}
      {showEmailLink && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.3s]">
          <div className="w-full max-w-md mx-4 relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1520] to-[#0e0b10]" />
            <div className="relative border border-white/[0.08] rounded-3xl p-7 space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                </div>
                <h2 className="text-lg font-light text-white/90">Conta Instagram conectada!</h2>
                <p className="text-white/30 text-xs mt-1.5">Informe seu email para completar o cadastro e receber notificações.</p>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

              <form onSubmit={handleLinkEmail} className="space-y-3">
                <div>
                  <label className="block text-white/35 text-[11px] mb-1.5 font-medium">Seu email *</label>
                  <input type="email" value={linkForm.email} onChange={e => setLinkForm({ ...linkForm, email: e.target.value })} required
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all"
                    placeholder="seu@email.com" />
                </div>
                <div>
                  <label className="block text-white/35 text-[11px] mb-1.5 font-medium">Nome completo</label>
                  <input value={linkForm.name} onChange={e => setLinkForm({ ...linkForm, name: e.target.value })}
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all"
                    placeholder="Seu nome" />
                </div>
                <div>
                  <label className="block text-white/35 text-[11px] mb-1.5 font-medium">Telefone</label>
                  <input value={linkForm.phone} onChange={e => setLinkForm({ ...linkForm, phone: e.target.value })}
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all"
                    placeholder="(00) 00000-0000" />
                </div>
                <button type="submit" disabled={linkLoading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white font-medium shadow-xl shadow-[#b76e79]/20 hover:shadow-[#b76e79]/35 transition-all disabled:opacity-50">
                  {linkLoading ? 'Salvando...' : 'Salvar e continuar'}
                </button>
              </form>

              <button onClick={skipEmailLink}
                className="w-full py-2.5 text-white/20 text-xs hover:text-white/40 transition-colors">
                Pular por enquanto →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Vincular telefone (Google Auth sem telefone cadastrado) ── */}
      {showPhoneLink && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.3s]">
          <div className="w-full max-w-md mx-4 relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1520] to-[#0e0b10]" />
            <div className="relative border border-white/[0.08] rounded-3xl p-7 space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center bg-white/10">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                </div>
                <h2 className="text-lg font-light text-white/90">Bem-vinda! 🌸</h2>
                <p className="text-white/30 text-xs mt-1.5">Já é cliente Mykaele Procópio?<br/>Informe seu telefone cadastrado para vincular sua conta.</p>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

              <form onSubmit={handleLinkPhone} className="space-y-3">
                <div>
                  <label className="block text-white/35 text-[11px] mb-1.5 font-medium">Seu telefone/WhatsApp</label>
                  <input type="tel" value={phoneForm} onChange={e => setPhoneForm(e.target.value)} required
                    className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-white/15 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-1 focus:ring-[#b76e79]/15 transition-all"
                    placeholder="(85) 98888-6319" />
                  <p className="text-[10px] text-white/20 mt-1.5">Se você já foi atendida, informe o mesmo número para manter seu histórico</p>
                </div>
                <button type="submit" disabled={phoneLinkLoading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white font-medium shadow-xl shadow-[#b76e79]/20 hover:shadow-[#b76e79]/35 transition-all disabled:opacity-50">
                  {phoneLinkLoading ? 'Verificando...' : 'Vincular conta'}
                </button>
              </form>

              <button onClick={skipPhoneLink}
                className="w-full py-2.5 text-white/20 text-xs hover:text-white/40 transition-colors">
                Sou cliente nova →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Force Password Change Screen ─── */
function ForcePasswordChangeScreen({ token, user, onComplete }: {
  token: string
  user: ClientUser
  onComplete: (updatedUser: ClientUser) => void
}) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao alterar senha')
        return
      }
      setSuccess(true)
      // Atualizar user sem forcePasswordChange
      setTimeout(() => {
        onComplete({ ...user, forcePasswordChange: false })
      }, 1500)
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf6f3] via-[#fff5f0] to-[#fce8e2] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#b76e79] to-[#c28a93] flex items-center justify-center shadow-lg shadow-[#b76e79]/20 mb-3">
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>
          </div>
          <h1 className="text-lg font-bold text-[#1a1a2e]">Bem-vinda, {user.name?.split(' ')[0]}! 🌸</h1>
          <p className="text-[#6b5b6e] text-sm mt-1">
            Por segurança, crie uma nova senha pessoal para acessar sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl shadow-[#b76e79]/10 border border-[#b76e79]/10 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span>✅</span> Senha alterada! Redirecionando...
            </div>
          )}

          <div>
            <label className="block text-[#6b5b6e] text-xs font-medium mb-1.5">Nova Senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              disabled={success}
              className="w-full px-4 py-3 bg-[#fdf6f3] border border-[#b76e79]/20 rounded-xl text-[#1a1a2e] text-sm placeholder-[#b76e79]/30 focus:outline-none focus:border-[#b76e79]/50 focus:ring-2 focus:ring-[#b76e79]/10 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-[#6b5b6e] text-xs font-medium mb-1.5">Confirmar Senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              required
              minLength={6}
              disabled={success}
              className="w-full px-4 py-3 bg-[#fdf6f3] border border-[#b76e79]/20 rounded-xl text-[#1a1a2e] text-sm placeholder-[#b76e79]/30 focus:outline-none focus:border-[#b76e79]/50 focus:ring-2 focus:ring-[#b76e79]/10 transition-all disabled:opacity-50"
            />
          </div>

          {newPassword && confirmPassword && newPassword === confirmPassword && (
            <div className="flex items-center gap-2 text-green-600 text-xs">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
              Senhas coincidem
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white font-semibold text-sm shadow-lg shadow-[#b76e79]/20 hover:shadow-[#b76e79]/30 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Alterando...
              </span>
            ) : success ? (
              '✅ Senha alterada!'
            ) : (
              'Criar Minha Senha'
            )}
          </button>

          <p className="text-center text-[#b76e79]/40 text-[10px]">
            Sua conta foi criada pela equipe Mykaele. Esta é uma etapa única de segurança.
          </p>
        </form>
      </div>
    </div>
  )
}

/* ─── Photo Drawer Context (mobile) ─── */
const PhotoDrawerContext = createContext({ open: false, toggle: () => {} })
function PhotoDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen(v => !v), [])
  return <PhotoDrawerContext.Provider value={{ open, toggle }}>{children}</PhotoDrawerContext.Provider>
}

/* ─── Cart Drawer Global ─── */
function CartDrawer() {
  const { items, removeItem, clearCart, total } = useCart()
  const { fetchWithAuth } = useClient()
  const [isOpen, setIsOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'payment_method' | 'loading' | 'success' | 'error'>('cart')
  const [checkoutError, setCheckoutError] = useState('')
  useBodyScrollLock(isOpen)

  const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const totalSessions = items.reduce((sum, i) => sum + i.sessions, 0)

  const handleOnlineCheckout = async () => {
    setCheckoutStep('loading')
    try {
      const cartItems = items.map(i => ({
        packageOptionId: i.packageOptionId,
        name: i.name,
        sessions: i.sessions,
        price: i.price,
        serviceName: i.serviceName,
      }))
      const res = await fetchWithAuth('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ items: cartItems }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCheckoutError(data.error || 'Erro ao processar pagamento')
        setCheckoutStep('error')
        return
      }
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
    } catch {
      setCheckoutError('Erro de conexão. Tente novamente.')
      setCheckoutStep('error')
    }
  }

  const handleInPersonCheckout = async () => {
    setCheckoutStep('loading')
    try {
      const cartItems = items.map(i => ({ name: i.name, sessions: i.sessions, price: i.price }))
      const res = await fetchWithAuth('/api/payments/order', {
        method: 'POST',
        body: JSON.stringify({ items: cartItems }),
      })
      if (!res.ok) {
        const data = await res.json()
        setCheckoutError(data.error || 'Erro ao registrar pedido')
        setCheckoutStep('error')
        return
      }
      clearCart()
      setCheckoutStep('success')
    } catch {
      setCheckoutError('Erro de conexão. Tente novamente.')
      setCheckoutStep('error')
    }
  }

  const closeCheckout = () => {
    const wasSuccess = checkoutStep === 'success'
    setCheckoutStep('cart')
    setCheckoutError('')
    if (wasSuccess) setIsOpen(false)
  }

  return (
    <>
      {/* Botão carrinho no header — renderizado via portal no ClientShell */}
      <button
        onClick={() => { setIsOpen(true); setCheckoutStep('cart') }}
        className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] transition-all group"
        aria-label="Abrir carrinho"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50 group-hover:text-white/80 transition-colors">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        {items.length > 0 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#b76e79] text-white text-[10px] font-bold">
            {items.length}
          </span>
        )}
      </button>

      {/* Drawer overlay + panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => { setIsOpen(false); setCheckoutStep('cart') }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
          <div
            className="absolute top-0 right-0 h-full w-[90vw] max-w-md bg-[#0e0b10] border-l border-white/10 shadow-2xl animate-[slideInRight_0.3s_ease-out] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a0a7]/20 to-[#b76e79]/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#d4a0a7]">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-white/90 font-semibold text-sm">Seu Carrinho</h3>
                  <p className="text-white/40 text-[10px]">{items.length} item(s) · {totalSessions} sessão(ões)</p>
                </div>
              </div>
              <button onClick={() => { setIsOpen(false); setCheckoutStep('cart') }} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* ═══ Cart items ═══ */}
            {checkoutStep === 'cart' && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 pb-48 space-y-3">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                      </div>
                      <p className="text-white/25 text-sm">Carrinho vazio</p>
                      <p className="text-white/15 text-xs mt-1">Adicione créditos para começar</p>
                    </div>
                  ) : (
                    items.map((item) => (
                      <div key={item.packageOptionId} className="group relative bg-white/[0.03] hover:bg-white/[0.05] rounded-xl p-4 border border-white/[0.06] transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white/90 text-sm font-medium truncate">{item.name}</p>
                            <p className="text-white/30 text-xs mt-0.5">{item.sessions} sessão(ões)</p>
                          </div>
                          <div className="flex items-center gap-2.5 ml-3">
                            <p className="text-white font-bold text-sm">{fmtCur(item.price)}</p>
                            <button onClick={() => removeItem(item.packageOptionId)} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-all opacity-40 hover:opacity-100">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {items.length > 0 && (
                  <div className="absolute bottom-0 left-0 w-full bg-[#0e0b10] p-4 border-t border-white/10 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-white/40">
                        <span>Subtotal ({items.length} item{items.length > 1 ? 's' : ''})</span>
                        <span>{fmtCur(total)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/80 font-semibold">Total</span>
                        <span className="text-white text-2xl font-bold">{fmtCur(total)}</span>
                      </div>
                    </div>
                    <button onClick={() => setCheckoutStep('payment_method')}
                      className="block w-full py-3.5 rounded-xl bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] text-white text-center font-bold shadow-lg shadow-[#b76e79]/25 hover:shadow-[#b76e79]/40 hover:scale-[1.02] active:scale-[0.98] transition-all">
                      Finalizar Compra
                    </button>
                    <button onClick={() => { clearCart(); setIsOpen(false) }}
                      className="w-full py-2 text-white/30 hover:text-red-400 text-xs font-medium transition-colors">
                      Limpar carrinho
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ═══ Payment method step ═══ */}
            {checkoutStep === 'payment_method' && (
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4a0a7]/20 to-[#b76e79]/10 flex items-center justify-center mx-auto mb-3">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#d4a0a7]"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  </div>
                  <h3 className="text-white/90 font-bold text-lg">Como deseja pagar?</h3>
                  <p className="text-white/30 text-xs mt-1">Total: {fmtCur(total)} · {totalSessions} sessão(ões)</p>
                </div>
                <div className="space-y-3">
                  <button onClick={handleOnlineCheckout}
                    className="w-full p-4 rounded-2xl border-2 border-[#b76e79]/30 bg-gradient-to-r from-[#b76e79]/10 to-[#d4a0a7]/5 hover:border-[#b76e79]/60 transition-all text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#b76e79]/20 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#d4a0a7]"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      </div>
                      <div>
                        <div className="text-white/90 font-semibold text-sm group-hover:text-white transition-colors">Pagar Agora</div>
                        <div className="text-white/30 text-[11px] mt-0.5">Online via Mercado Pago (Pix, Cartão, Boleto)</div>
                      </div>
                    </div>
                  </button>
                  <button onClick={handleInPersonCheckout}
                    className="w-full p-4 rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-500/40 transition-all text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      </div>
                      <div>
                        <div className="text-white/90 font-semibold text-sm group-hover:text-white transition-colors">Pagar no Atendimento</div>
                        <div className="text-white/30 text-[11px] mt-0.5">Pix, Cartão ou Dinheiro na Clínica/Home Spa</div>
                      </div>
                    </div>
                  </button>
                </div>
                <button onClick={() => setCheckoutStep('cart')} className="w-full py-2 text-white/25 hover:text-white/50 text-xs transition-colors">← Voltar ao carrinho</button>
              </div>
            )}

            {/* ═══ Loading ═══ */}
            {checkoutStep === 'loading' && (
              <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-4">
                <div className="w-10 h-10 border-[3px] border-[#b76e79]/30 border-t-[#b76e79] rounded-full animate-spin" />
                <p className="text-white/50 text-sm">Processando seu pedido...</p>
              </div>
            )}

            {/* ═══ Success ═══ */}
            {checkoutStep === 'success' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 px-6 py-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <h3 className="text-white/90 font-bold text-lg">Pedido Confirmado!</h3>
                  <p className="text-white/40 text-sm mt-2 leading-relaxed">Seu pedido foi registrado com sucesso.<br/>Realize o pagamento no dia do atendimento.</p>
                </div>
                <div className="p-3 bg-emerald-500/[0.06] rounded-xl border border-emerald-500/15">
                  <p className="text-emerald-400/70 text-[11px]">💡 Aceitamos Pix, Cartão de Crédito/Débito e Dinheiro</p>
                </div>
                <button onClick={closeCheckout} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4a0a7] to-[#b76e79] text-white font-semibold text-sm shadow-lg shadow-[#b76e79]/20">Entendido</button>
              </div>
            )}

            {/* ═══ Error ═══ */}
            {checkoutStep === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 px-6 py-4">
                <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <div>
                  <h3 className="text-white/90 font-bold">Ops, algo deu errado</h3>
                  <p className="text-white/40 text-sm mt-1">{checkoutError}</p>
                </div>
                <button onClick={() => setCheckoutStep('payment_method')} className="w-full py-3 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm font-medium transition-all">Tentar novamente</button>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  )
}

/* ─── Client Shell — Layout com foto lateral persistente ─── */
function UserAvatar({ src, name }: { src?: string | null; name?: string }) {
  const [imgError, setImgError] = useState(false)
  const initial = name?.charAt(0) || '?'

  if (!src || imgError) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c28a93] to-[#9e6670] flex items-center justify-center text-white text-sm font-light shadow-lg shadow-[#b76e79]/20 ring-2 ring-[#b76e79]/10">
        {initial}
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={name || ''}
      width={40}
      height={40}
      className="w-10 h-10 rounded-full object-cover shadow-lg shadow-[#b76e79]/20 ring-2 ring-[#b76e79]/10"
      onError={() => setImgError(true)}
      unoptimized={src.startsWith('data:')}
    />
  )
}

function ClientShell({ user, pathname, children }: { user: ClientUser; pathname: string; children: ReactNode }) {
  const { open, toggle } = useContext(PhotoDrawerContext)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0e0b10] via-[#100d14] to-[#0e0b10] relative flex">

      {/* ═══ DESKTOP: Painel lateral fixo com foto da Mykaele ═══ */}
      <aside className="hidden lg:block w-[320px] xl:w-[380px] shrink-0 fixed left-0 top-0 h-screen z-20">
        <div className="relative w-full h-full overflow-hidden">
          {/* Foto editorial */}
          <img
            src="/media/profissionais/mykaele-principal.png"
            alt="Mykaele Procópio"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: 'center 15%' }}
          />
          {/* Overlays de gradiente */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0b10]/20 via-transparent to-[#0e0b10]/95" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0b10]/90 via-[#0e0b10]/15 to-[#0e0b10]/40" />
          <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-[#b76e79]/8 to-transparent" />

          {/* Conteúdo sobre a foto */}
          <div className="absolute inset-0 flex flex-col justify-end p-8 pb-10">
            <LeafLogo className="w-6 h-9 text-white/25 mb-4" />
            <h2 className="text-2xl xl:text-3xl font-extralight text-white/90 tracking-[-0.01em] leading-tight">
              Mykaele<br/>Procópio
            </h2>
            <div className="mt-2.5 w-7 h-[1px] bg-[#b76e79]/35" />
            <p className="mt-2.5 text-white/30 text-[10px] tracking-[0.2em] uppercase font-light">
              Home Spa Premium
            </p>
            <p className="mt-1.5 text-white/18 text-[10px] leading-relaxed max-w-[220px]">
              Fisioterapeuta Dermatofuncional · Arquitetura Corporal
            </p>

            {/* WhatsApp + Dev credit */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <a href="https://wa.me/5585999086924" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/15 text-[#25D366]/70 text-[11px] font-medium hover:bg-[#25D366]/15 hover:text-[#25D366] transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Fale comigo
              </a>
              <a href="https://www.instagram.com/emmanuelbezerra_" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] group hover:bg-white/[0.08] transition-all">
                <span className="text-[9px] text-white/20 tracking-wider font-light group-hover:text-white/35 transition-colors">dev</span>
                <span className="text-[8px] text-rose-400/30">&#9829;</span>
                <img src="/media/logo-branding/logo-emmanuel.png" alt="Emmanuel Bezerra" className="h-5 w-auto object-contain brightness-200 opacity-35 group-hover:opacity-60 transition-opacity duration-300" />
              </a>
            </div>
          </div>

          {/* Linha decorativa vertical */}
          <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[#b76e79]/10 to-transparent" />
        </div>
      </aside>

      {/* ═══ Conteúdo principal ═══ */}
      <div className="flex-1 lg:ml-[320px] xl:ml-[380px] relative pb-32 lg:pb-16">

        {/* Global Background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <LeafLogo className="absolute top-12 right-6 w-[120px] h-[120px] text-[#b76e79]/[0.018] rotate-12" />
          <LeafLogo className="absolute bottom-36 left-4 w-[90px] h-[90px] text-[#b76e79]/[0.014] -rotate-30" />
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-[#b76e79]/[0.012] rounded-full blur-[140px]" />
          <div className="absolute bottom-1/4 left-1/3 w-[250px] h-[250px] bg-[#d4a0a7]/[0.008] rounded-full blur-[120px]" />
        </div>

        {/* ─── Header ─── */}
        <header className="sticky top-0 z-30 backdrop-blur-2xl border-b border-white/[0.04]" style={{ background: 'linear-gradient(180deg, rgba(14,11,16,0.97) 0%, rgba(14,11,16,0.85) 100%)' }}>
          <div className="px-5 py-4 flex items-center justify-between max-w-lg mx-auto lg:max-w-none">
            <div className="flex items-center gap-3.5">
              {/* MOBILE: Foto da Mykaele que abre drawer */}
              <button onClick={toggle} className="lg:hidden relative group">
                <img
                  src="/media/profissionais/mykaele-principal.png"
                  alt="Mykaele"
                  className="w-10 h-10 rounded-full object-cover shadow-lg shadow-[#b76e79]/20 ring-2 ring-[#b76e79]/15 group-hover:ring-[#b76e79]/30 transition-all"
                  style={{ objectPosition: 'center 15%' }}
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#b76e79] border-2 border-[#0e0b10] flex items-center justify-center">
                  <LeafLogo className="w-1.5 h-2 text-white" />
                </div>
              </button>

              {/* DESKTOP: Avatar do paciente */}
              <div className="hidden lg:block relative">
                <UserAvatar src={user.avatar} name={user.name} />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0e0b10]" />
              </div>

              <div>
                <div className="text-white/90 font-medium text-[15px] tracking-tight">{user.name?.split(' ')[0]}</div>
                <div className="text-[#c28a93]/50 text-[8px] font-semibold tracking-[0.25em] uppercase">Arquitetura Corporal</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <CartDrawer />
              <LeafLogo className="w-3 h-4.5 text-[#b76e79]/25" />
            </div>
          </div>
        </header>

        {/* ─── Banner: Verificar Email ─── */}
        {!user.emailVerified && (
          <EmailVerificationBanner />
        )}

        {/* ─── Content ─── */}
        <main className="px-5 py-6 max-w-lg mx-auto lg:max-w-4xl relative z-10">
          <PageTransition>{children}</PageTransition>
        </main>

        {/* ─── Bottom Nav (mobile) ─── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl border-t border-white/[0.05]" style={{ background: 'linear-gradient(0deg, rgba(14,11,16,0.98) 0%, rgba(14,11,16,0.92) 100%)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex justify-around items-center px-1 py-2.5 max-w-lg mx-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href}
                  onClick={() => haptic('selection')}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all ${
                    isActive ? 'text-[#d4a0a7] bg-[#b76e79]/8' : 'text-white/20 hover:text-white/40'
                  }`}>
                  <span className={`transition-all ${isActive ? 'scale-110 drop-shadow-[0_0_6px_rgba(183,110,121,0.3)]' : ''}`}>{item.icon}</span>
                  <span className={`text-[9px] font-medium tracking-wide ${isActive ? 'text-[#d4a0a7]' : ''}`}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* ─── Desktop Nav (bottom bar) ─── */}
        <nav className="hidden lg:block fixed bottom-0 left-[320px] xl:left-[380px] right-0 z-40 backdrop-blur-2xl border-t border-white/[0.05]" style={{ background: 'linear-gradient(0deg, rgba(14,11,16,0.98) 0%, rgba(14,11,16,0.92) 100%)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex justify-center items-center gap-1 px-4 py-2.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all ${
                    isActive ? 'text-[#d4a0a7] bg-[#b76e79]/10' : 'text-white/20 hover:text-white/40 hover:bg-white/[0.02]'
                  }`}>
                  <span className={`transition-all ${isActive ? 'drop-shadow-[0_0_6px_rgba(183,110,121,0.3)]' : ''}`}>{item.icon}</span>
                  <span className={`text-xs font-medium ${isActive ? 'text-[#d4a0a7]' : ''}`}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* ═══ MOBILE: Drawer com foto da Mykaele ═══ */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[60]" onClick={toggle}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
          <div className="absolute bottom-0 left-0 right-0 animate-[slideUp_0.35s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="bg-gradient-to-b from-[#13101a] to-[#0e0b10] rounded-t-3xl overflow-hidden border-t border-white/[0.06]">
              <div className="relative h-[55vh] overflow-hidden">
                <img src="/media/profissionais/mykaele-principal.png" alt="Mykaele Procópio"
                  className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'center 15%' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0b10] via-[#0e0b10]/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#b76e79]/5 via-transparent to-transparent" />
                <button onClick={toggle}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <LeafLogo className="absolute top-6 left-5 w-8 h-12 text-white/[0.08]" />
              </div>
              <div className="px-6 py-6 -mt-8 relative z-10">
                <h3 className="text-2xl font-extralight text-white/90 tracking-tight">Mykaele Procópio</h3>
                <div className="mt-2 w-8 h-[1px] bg-[#b76e79]/35" />
                <p className="mt-2.5 text-white/30 text-[10px] tracking-[0.2em] uppercase font-light">Home Spa Premium</p>
                <p className="mt-1.5 text-white/18 text-[11px] leading-relaxed">Fisioterapeuta Dermatofuncional · Arquitetura Corporal</p>
                <a href="https://wa.me/5585999086924" target="_blank" rel="noopener noreferrer"
                  className="mt-5 flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#25D366]/15 to-[#128C7E]/10 border border-[#25D366]/15 text-[#25D366]/80 text-sm font-medium hover:bg-[#25D366]/20 transition-all">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Falar com Mykaele
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  )
}

/* ─── Main Layout ─── */
export default function ClienteLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    const savedToken = localStorage.getItem('client_token')
    const savedUser = localStorage.getItem('client_user')
    if (savedToken && savedUser) {
      try { setToken(savedToken); setUser(JSON.parse(savedUser)) } catch { /* ignore */ }
    }
  }, [])

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    })
  }, [token])

  const handleLogin = (newToken: string, newUser: ClientUser) => {
    setToken(newToken); setUser(newUser)
    localStorage.setItem('client_token', newToken)
    localStorage.setItem('client_user', JSON.stringify(newUser))
    // Buscar perfil completo do servidor (avatar, endereço, etc.)
    setTimeout(async () => {
      try {
        const res = await fetch('/api/patient/profile', {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` },
        })
        if (res.ok) {
          const raw = await res.json()
          const data = raw.profile || raw
          setUser(data); localStorage.setItem('client_user', JSON.stringify(data))
        }
      } catch { /* silently ignore */ }
    }, 500)
  }

  const logout = () => {
    setToken(null); setUser(null)
    localStorage.removeItem('client_token'); localStorage.removeItem('client_user')
  }

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/patient/profile')
      if (res.ok) {
        const raw = await res.json()
        const data = raw.profile || raw
        setUser(data); localStorage.setItem('client_user', JSON.stringify(data))
      }
    } catch { /* */ }
  }, [fetchWithAuth])

  const handlePasswordChanged = (updatedUser: ClientUser) => {
    setUser(updatedUser)
    localStorage.setItem('client_user', JSON.stringify(updatedUser))
  }

  if (!mounted) return null
  if (!token || !user) return <AuthScreen onLogin={handleLogin} />

  // Interceptar troca de senha obrigatória
  if (user.forcePasswordChange) {
    return <ForcePasswordChangeScreen token={token} user={user} onComplete={handlePasswordChanged} />
  }

  return (
    <ClientContextProvider value={{ user, token, fetchWithAuth, logout, refreshUser }}>
      <CartProvider>
        <PhotoDrawerProvider>
          <ClientShell user={user} pathname={pathname}>
            {children}
          </ClientShell>
          <NotificationPrompt />
        </PhotoDrawerProvider>
      </CartProvider>
    </ClientContextProvider>
  )
}
