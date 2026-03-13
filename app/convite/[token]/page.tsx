'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface InviteData {
  valid: boolean
  name: string
  email: string
  role: string
  error?: string
}

export default function AcceptInvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/crm/invite/accept?token=${token}`)
        const data = await res.json()
        if (res.ok && data.valid) {
          setInvite(data)
        } else {
          setError(data.error || 'Convite inválido')
        }
      } catch {
        setError('Erro ao validar convite')
      } finally {
        setLoading(false)
      }
    }
    validateToken()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/crm/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/admin'), 2000)
      } else {
        setError(data.error || 'Erro ao criar conta')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabels: Record<string, string> = {
    owner: 'Proprietário(a)',
    admin: 'Administrador(a)',
    manager: 'Gerente',
    agent: 'Agente',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8B8A94', fontSize: '16px' }}>Validando convite...</div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#111114', border: '1px solid #2A2A32', borderRadius: '16px', padding: '40px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😔</div>
          <h1 style={{ color: '#F0EDE8', fontSize: '20px', fontWeight: 600, margin: '0 0 12px' }}>Convite Indisponível</h1>
          <p style={{ color: '#8B8A94', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{error}</p>
          <a href="/admin" style={{ display: 'inline-block', marginTop: '24px', color: '#D4AF37', fontSize: '14px', textDecoration: 'none' }}>
            Ir para o login →
          </a>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#111114', border: '1px solid #2A2A32', borderRadius: '16px', padding: '40px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h1 style={{ color: '#F0EDE8', fontSize: '20px', fontWeight: 600, margin: '0 0 12px' }}>Conta Criada!</h1>
          <p style={{ color: '#8B8A94', fontSize: '14px', margin: 0 }}>Redirecionando para o login...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#111114', border: '1px solid #2A2A32', borderRadius: '16px', padding: '40px', maxWidth: '420px', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: '#D4AF37', fontSize: '24px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '0.5px' }}>
            Colify CRM
          </h1>
          <p style={{ color: '#8B8A94', fontSize: '13px', margin: 0 }}>Aceitar convite da equipe</p>
        </div>

        {/* Invite info */}
        <div style={{ background: '#1A1A1F', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid #2A2A32' }}>
          <p style={{ color: '#F0EDE8', fontSize: '15px', fontWeight: 500, margin: '0 0 4px' }}>{invite.name}</p>
          <p style={{ color: '#8B8A94', fontSize: '13px', margin: '0 0 4px' }}>{invite.email}</p>
          <span style={{
            display: 'inline-block',
            background: 'rgba(212,175,55,0.12)',
            color: '#D4AF37',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {roleLabels[invite.role] || invite.role}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#8B8A94', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
              Criar senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              style={{
                width: '100%',
                background: '#1A1A1F',
                border: '1px solid #2A2A32',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#F0EDE8',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: '#8B8A94', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
              Confirmar senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              required
              minLength={6}
              style={{
                width: '100%',
                background: '#1A1A1F',
                border: '1px solid #2A2A32',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#F0EDE8',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,107,74,0.1)',
              border: '1px solid rgba(255,107,74,0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              color: '#FF6B4A',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              background: submitting ? '#8B8A94' : 'linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)',
              color: '#0A0A0B',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              letterSpacing: '0.3px',
            }}
          >
            {submitting ? 'Criando conta...' : 'Criar Conta e Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
