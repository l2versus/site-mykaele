'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { playFeedback } from '@/lib/crm-feedback'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
type IntegrationStatus = 'connected' | 'available' | 'coming_soon' | 'optional'

interface IntegrationCard {
  id: string
  name: string
  description: string
  category: 'channels' | 'services' | 'coming_soon'
  status: IntegrationStatus
  statusLabel: string
  icon: React.ReactNode
  accentColor: string
  isHero?: boolean
}

// --- Icons ---

const WhatsAppIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const EmailIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="#7C6AEF" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
)

const PaymentIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="#2ECC8A" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
)

const CalendarIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="#4A7BFF" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const AutomationIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="#F0A500" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
)

const AIIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22" />
    <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93" />
    <path d="M9 12h6" />
    <path d="M8 16h8" />
  </svg>
)

// --- Integration definitions ---

const INTEGRATIONS: IntegrationCard[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Mensagens bidirecionais em tempo real via Evolution API v2',
    category: 'channels',
    status: 'available',
    statusLabel: 'Disponível',
    icon: <WhatsAppIcon size={28} />,
    accentColor: '#25D366',
    isHero: true,
  },
  {
    id: 'email',
    name: 'E-mail (Resend)',
    description: 'Envio de e-mails transacionais e notificações para pacientes',
    category: 'channels',
    status: 'connected',
    statusLabel: 'Configurado',
    icon: <EmailIcon />,
    accentColor: '#7C6AEF',
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Processamento de pagamentos, cobranças e links de pagamento',
    category: 'services',
    status: 'connected',
    statusLabel: 'Configurado',
    icon: <PaymentIcon />,
    accentColor: '#2ECC8A',
  },
  {
    id: 'openai',
    name: 'OpenAI (IA)',
    description: 'Embeddings, pontuação inteligente e Concierge RAG',
    category: 'services',
    status: 'optional',
    statusLabel: 'Opcional',
    icon: <AIIcon />,
    accentColor: '#D4AF37',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sincronização bidirecional de agendamentos com Google Agenda',
    category: 'coming_soon',
    status: 'coming_soon',
    statusLabel: 'Em breve',
    icon: <CalendarIcon />,
    accentColor: '#4A7BFF',
  },
  {
    id: 'n8n',
    name: 'n8n (Automação)',
    description: 'Conecte fluxos de automação externos e webhooks customizados',
    category: 'coming_soon',
    status: 'optional',
    statusLabel: 'Opcional',
    icon: <AutomationIcon />,
    accentColor: '#F0A500',
  },
]

// --- Status badge component ---

function StatusBadge({ status, label }: { status: IntegrationStatus; label: string }) {
  const styles: Record<IntegrationStatus, { bg: string; color: string; dot?: string }> = {
    connected: { bg: 'rgba(46,204,138,0.12)', color: '#2ECC8A', dot: '#2ECC8A' },
    available: { bg: 'rgba(212,175,55,0.12)', color: '#D4AF37' },
    coming_soon: { bg: 'rgba(74,123,255,0.12)', color: '#4A7BFF' },
    optional: { bg: '#1A1A1F', color: '#8B8A94' },
  }
  const s = styles[status]

  return (
    <span
      className="text-[10px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 select-none"
      style={{ background: s.bg, color: s.color }}
    >
      {s.dot && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: s.dot }} />
      )}
      {label}
    </span>
  )
}

// --- Stat pill ---

function StatPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold" style={{ color }}>{count}</span>
      <span className="text-xs" style={{ color: '#8B8A94' }}>{label}</span>
    </div>
  )
}

// --- Integration card (non-hero) ---

function IntegrationCardDisplay({ card, index }: { card: IntegrationCard; index: number }) {
  return (
    <motion.div
      className="group rounded-2xl border p-5 relative overflow-hidden cursor-default"
      style={{
        background: 'var(--crm-surface)',
        borderColor: card.status === 'connected' ? `${card.accentColor}22` : 'var(--crm-border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}
    >
      {/* Accent glow for connected */}
      {card.status === 'connected' && (
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ background: `radial-gradient(circle at 80% 20%, ${card.accentColor}, transparent 60%)` }}
        />
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
            style={{ background: 'var(--crm-surface-2)' }}
          >
            {card.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#F0EDE8' }}>{card.name}</h3>
          </div>
        </div>
        <StatusBadge status={card.status} label={card.statusLabel} />
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: '#8B8A94' }}>
        {card.description}
      </p>

      {/* Subtle bottom line accent */}
      {card.status === 'connected' && (
        <div
          className="absolute bottom-0 left-4 right-4 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${card.accentColor}33, transparent)` }}
        />
      )}
    </motion.div>
  )
}

// --- Section header ---

function SectionHeader({ title, icon, delay }: { title: string; icon: React.ReactNode; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-2.5 mb-4 mt-8"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(212,175,55,0.08)' }}
      >
        {icon}
      </div>
      <h2 className="text-sm font-semibold tracking-wide" style={{ color: '#F0EDE8' }}>
        {title}
      </h2>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, var(--crm-border), transparent)' }} />
    </motion.div>
  )
}

// =============================================
// MAIN PAGE
// =============================================

export default function IntegrationsPage() {
  const [waStatus, setWaStatus] = useState<ConnectionStatus>('disconnected')
  const [waError, setWaError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const addToast = useToastStore(s => s.addToast)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/evolution`
    : '/api/webhooks/evolution'

  // Compute stats
  const connectedCount = INTEGRATIONS.filter(i => i.status === 'connected').length + (waStatus === 'connected' ? 1 : 0)
  const availableCount = INTEGRATIONS.filter(i => i.status === 'available' || i.status === 'optional').length - (waStatus === 'connected' ? 1 : 0)
  const comingSoonCount = INTEGRATIONS.filter(i => i.status === 'coming_soon').length

  const channelIntegrations = INTEGRATIONS.filter(i => i.category === 'channels' && !i.isHero)
  const serviceIntegrations = INTEGRATIONS.filter(i => i.category === 'services')
  const comingSoonIntegrations = INTEGRATIONS.filter(i => i.category === 'coming_soon')

  // --- WhatsApp logic (preserved) ---

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    if (!token) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)
    try {
      const res = await fetch(`/api/admin/crm/integrations/whatsapp/status?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      if (!res.ok) return
      const data: { status: ConnectionStatus; instanceId?: string } = await res.json()
      setWaStatus(data.status)
      if (data.instanceId) setInstanceId(data.instanceId)
      if (data.status === 'connected') {
        playFeedback('won')
        addToast('WhatsApp conectado com sucesso!')
        stopPolling()
      }
    } catch {
      // silently fail — SSE or next poll will retry
    } finally {
      clearTimeout(timeout)
    }
  }, [token, addToast, stopPolling])

  const handleConnect = async () => {
    if (!token) return
    setWaStatus('connecting')
    setWaError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    try {
      const res = await fetch('/api/admin/crm/integrations/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: TENANT_ID }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) {
        setWaStatus('error')
        setWaError(data.error || `Erro ${res.status}`)
        return
      }
      if (data.qrCode) setQrCode(data.qrCode)
      if (data.instanceId) setInstanceId(data.instanceId)
      stopPolling()
      pollingRef.current = setInterval(fetchStatus, 3000)
    } catch (err) {
      setWaStatus('error')
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      setWaError(isTimeout ? 'Evolution API não respondeu (timeout). Verifique se o serviço está rodando.' : 'Sem conexão com o servidor')
    } finally {
      clearTimeout(timeout)
    }
  }

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard fallback not available
    }
  }

  useEffect(() => {
    fetchStatus()
    return stopPolling
  }, [fetchStatus, stopPolling])

  // WhatsApp status badge for hero card
  const waStatusConfig: Record<ConnectionStatus, { label: string; bg: string; color: string; dot?: boolean }> = {
    connected: { label: 'Conectado', bg: 'rgba(46,204,138,0.15)', color: '#2ECC8A', dot: true },
    connecting: { label: 'Conectando...', bg: 'rgba(212,175,55,0.15)', color: '#D4AF37' },
    error: { label: 'Erro', bg: 'rgba(255,107,74,0.15)', color: '#FF6B4A' },
    disconnected: { label: 'Desconectado', bg: '#1A1A1F', color: '#8B8A94' },
  }
  const currentWaBadge = waStatusConfig[waStatus]

  return (
    <div className="max-w-4xl">
      {/* ===== PAGE HEADER ===== */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1
          className="text-xl font-bold tracking-tight flex items-center gap-2.5 mb-1"
          style={{ color: 'var(--crm-text)' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(212,175,55,0.08)' }}
          >
            <svg width="16" height="16" fill="none" stroke="var(--crm-gold)" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11a9 9 0 0 1 9 9" />
              <path d="M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" />
            </svg>
          </div>
          Integrações
        </h1>
        <p className="text-xs mb-5 ml-[42px]" style={{ color: 'var(--crm-text-muted)' }}>
          Conecte canais e serviços externos ao seu CRM
        </p>
      </motion.div>

      {/* ===== STATS BAR ===== */}
      <motion.div
        className="rounded-xl border px-5 py-3 flex items-center gap-6 mb-6"
        style={{
          background: 'var(--crm-surface)',
          borderColor: 'var(--crm-border)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5 }}
      >
        <StatPill count={connectedCount} label="conectadas" color="#2ECC8A" />
        <div className="w-px h-4" style={{ background: 'var(--crm-border)' }} />
        <StatPill count={availableCount} label="disponíveis" color="#D4AF37" />
        <div className="w-px h-4" style={{ background: 'var(--crm-border)' }} />
        <StatPill count={comingSoonCount} label="em breve" color="#4A7BFF" />
      </motion.div>

      {/* ===== HERO: WHATSAPP CARD ===== */}
      <motion.div
        className="rounded-2xl border p-6 relative overflow-hidden"
        style={{
          background: 'var(--crm-surface)',
          borderColor: waStatus === 'connected' ? 'rgba(37,211,102,0.25)' : 'var(--crm-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        whileHover={{ y: -1, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
      >
        {/* Glow effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: waStatus === 'connected' ? 0.06 : 0.03,
            background: 'radial-gradient(circle at 85% 15%, #25D366, transparent 55%)',
          }}
        />

        {/* Hero badge */}
        <div className="absolute top-4 right-4">
          <span
            className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest"
            style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}
          >
            Principal
          </span>
        </div>

        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.15)' }}
          >
            <WhatsAppIcon size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <h3 className="text-base font-bold" style={{ color: '#F0EDE8' }}>WhatsApp Business</h3>
              <span
                className="text-[10px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5"
                style={{ background: currentWaBadge.bg, color: currentWaBadge.color }}
              >
                {currentWaBadge.dot && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: currentWaBadge.color }} />
                )}
                {currentWaBadge.label}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#8B8A94' }}>
              Conecte via Evolution API v2 para envio e recebimento de mensagens em tempo real.
              Suporta texto, imagens, áudio, vídeo e documentos.
            </p>
          </div>
        </div>

        {/* Features list */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Mensagens bidirecionais', icon: '↔' },
            { label: 'QR Code instantâneo', icon: '⎕' },
            { label: 'Webhook em tempo real', icon: '⚡' },
          ].map((feat) => (
            <div
              key={feat.label}
              className="rounded-lg px-3 py-2 text-center"
              style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)' }}
            >
              <span className="text-xs" style={{ color: '#8B8A94' }}>
                <span className="mr-1.5">{feat.icon}</span>{feat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Connection actions */}
        {waStatus === 'disconnected' && (
          <button
            onClick={handleConnect}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: '#25D366', color: '#fff', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}
          >
            Conectar WhatsApp
          </button>
        )}

        {waStatus === 'connecting' && qrCode && (
          <div className="flex flex-col items-center">
            <div className="p-3 rounded-xl mb-3" style={{ background: '#fff' }}>
              <img src={`data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="w-52 h-52" />
            </div>
            <p className="text-[11px] text-center mb-2" style={{ color: '#8B8A94' }}>
              Abra o WhatsApp &rarr; Dispositivos conectados &rarr; Escanear QR Code
            </p>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
              <span className="text-[11px] font-medium" style={{ color: '#D4AF37' }}>Aguardando conexão...</span>
            </div>
          </div>
        )}

        {waStatus === 'connecting' && !qrCode && (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
            <span className="text-xs font-medium" style={{ color: '#D4AF37' }}>Gerando QR Code...</span>
          </div>
        )}

        {waStatus === 'connected' && (
          <div
            className="flex items-center gap-3 py-3 px-4 rounded-xl"
            style={{ background: 'rgba(46,204,138,0.06)', border: '1px solid rgba(46,204,138,0.15)' }}
          >
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#2ECC8A' }} />
            <span className="text-sm font-semibold" style={{ color: '#2ECC8A' }}>WhatsApp conectado e funcionando</span>
            {instanceId && (
              <span className="text-[10px] ml-auto font-mono" style={{ color: '#8B8A94' }}>
                ID: {instanceId.slice(0, 16)}
              </span>
            )}
          </div>
        )}

        {waStatus === 'error' && (
          <div className="space-y-3">
            {waError && (
              <div
                className="px-4 py-3 rounded-xl text-xs leading-relaxed"
                style={{ background: 'rgba(255,107,74,0.08)', border: '1px solid rgba(255,107,74,0.15)', color: '#FF6B4A' }}
              >
                {waError}
              </div>
            )}
            <button
              onClick={handleConnect}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(255,107,74,0.12)', color: '#FF6B4A', border: '1px solid rgba(255,107,74,0.25)' }}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </motion.div>

      {/* ===== CANAIS DE COMUNICAÇÃO ===== */}
      <SectionHeader
        title="Canais de Comunicação"
        delay={0.25}
        icon={
          <svg width="12" height="12" fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {channelIntegrations.map((card, i) => (
          <IntegrationCardDisplay key={card.id} card={card} index={i} />
        ))}
      </div>

      {/* ===== SERVIÇOS CONECTADOS ===== */}
      <SectionHeader
        title="Serviços Conectados"
        delay={0.35}
        icon={
          <svg width="12" height="12" fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {serviceIntegrations.map((card, i) => (
          <IntegrationCardDisplay key={card.id} card={card} index={i + channelIntegrations.length} />
        ))}
      </div>

      {/* ===== EM BREVE ===== */}
      <SectionHeader
        title="Em Breve"
        delay={0.45}
        icon={
          <svg width="12" height="12" fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {comingSoonIntegrations.map((card, i) => (
          <IntegrationCardDisplay
            key={card.id}
            card={card}
            index={i + channelIntegrations.length + serviceIntegrations.length}
          />
        ))}
      </div>

      {/* ===== WEBHOOK URL SECTION ===== */}
      <motion.div
        className="rounded-2xl border p-5 mt-8"
        style={{
          background: 'var(--crm-surface)',
          borderColor: 'var(--crm-border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(212,175,55,0.08)' }}
          >
            <svg width="13" height="13" fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#F0EDE8' }}>Webhook URL</h3>
            <p className="text-[10px]" style={{ color: '#8B8A94' }}>
              Configure este endpoint na Evolution API para receber mensagens
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <code
            className="flex-1 text-[11px] font-mono px-4 py-2.5 rounded-xl truncate select-all"
            style={{
              background: '#0A0A0B',
              color: '#D4AF37',
              border: '1px solid #2A2A32',
            }}
          >
            {webhookUrl}
          </code>
          <button
            onClick={handleCopyWebhook}
            className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: copied ? 'rgba(46,204,138,0.12)' : 'var(--crm-surface-2)',
              color: copied ? '#2ECC8A' : '#8B8A94',
              border: `1px solid ${copied ? 'rgba(46,204,138,0.25)' : 'var(--crm-border)'}`,
            }}
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </motion.div>

      {/* Bottom spacer */}
      <div className="h-8" />
    </div>
  )
}
