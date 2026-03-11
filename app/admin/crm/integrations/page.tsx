'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { playFeedback } from '@/lib/crm-feedback'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface IntegrationCard {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  status: ConnectionStatus
  comingSoon?: boolean
}

const WhatsAppIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

export default function IntegrationsPage() {
  const [waStatus, setWaStatus] = useState<ConnectionStatus>('disconnected')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  // Buscar status atual da integração WhatsApp
  const fetchStatus = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/integrations/whatsapp/status?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setWaStatus(data.status)
      setInstanceId(data.instanceId)
      if (data.status === 'connected') {
        playFeedback('won')
        stopPolling()
      }
    } catch {
      // silently fail
    }
  }, [token])

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  // Conectar WhatsApp — gerar QR Code
  const handleConnect = async () => {
    if (!token) return
    setWaStatus('connecting')

    try {
      const res = await fetch('/api/admin/crm/integrations/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      })
      if (!res.ok) {
        setWaStatus('error')
        return
      }
      const data = await res.json()
      setQrCode(data.qrCode)
      setInstanceId(data.instanceId)

      // Polling de status a cada 3s
      stopPolling()
      pollingRef.current = setInterval(fetchStatus, 3000)
    } catch {
      setWaStatus('error')
    }
  }

  useEffect(() => {
    fetchStatus()
    return stopPolling
  }, [fetchStatus])

  const integrations: IntegrationCard[] = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Conecte via Evolution API para mensagens bidirecionais em tempo real.',
      icon: <WhatsAppIcon />,
      status: waStatus,
    },
    {
      id: 'meta-ads',
      name: 'Meta Ads',
      description: 'Importe leads do Facebook e Instagram Ads automaticamente.',
      icon: <svg width="24" height="24" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
      status: 'disconnected',
      comingSoon: true,
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sincronize agendamentos com o Google Calendar da clínica.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="20" height="20" x="2" y="2" rx="3" fill="#4285F4"/><rect width="14" height="14" x="5" y="5" rx="1" fill="white"/><rect width="3" height="3" x="7" y="8" fill="#4285F4"/><rect width="3" height="3" x="11" y="8" fill="#4285F4"/><rect width="3" height="3" x="7" y="12" fill="#4285F4"/><rect width="3" height="3" x="11" y="12" fill="#4285F4"/></svg>,
      status: 'disconnected',
      comingSoon: true,
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Conecte com 5.000+ apps via Zapier webhooks.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF4A00"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3l2.5 4.5H14v5h-4v-5H7.5L12 5z"/></svg>,
      status: 'disconnected',
      comingSoon: true,
    },
  ]

  const statusBadge = (status: ConnectionStatus, comingSoon?: boolean) => {
    if (comingSoon) return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#1A1A1F', color: '#8B8A94' }}>Em breve</span>
    switch (status) {
      case 'connected': return (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: 'rgba(46,204,138,0.15)', color: '#2ECC8A' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2ECC8A' }} />
          Conectado
        </span>
      )
      case 'connecting': return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>Conectando...</span>
      case 'error': return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,107,74,0.15)', color: '#FF6B4A' }}>Erro</span>
      default: return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#1A1A1F', color: '#8B8A94' }}>Desconectado</span>
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: '#F0EDE8' }}>Integrações</h1>
      <p className="text-xs mb-6" style={{ color: '#8B8A94' }}>Conecte canais e serviços ao seu CRM</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <motion.div
            key={integration.id}
            className="rounded-xl border p-5 transition-all"
            style={{ background: '#111114', borderColor: '#2A2A32' }}
            whileHover={{ scale: 1.01, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#1A1A1F' }}>
                {integration.icon}
              </div>
              {statusBadge(integration.status, integration.comingSoon)}
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: '#F0EDE8' }}>{integration.name}</h3>
            <p className="text-xs mb-4" style={{ color: '#8B8A94' }}>{integration.description}</p>

            {integration.id === 'whatsapp' && !integration.comingSoon && (
              <>
                {waStatus === 'disconnected' && (
                  <button
                    onClick={handleConnect}
                    className="w-full py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
                    style={{ background: '#25D366', color: '#fff' }}
                  >
                    Conectar WhatsApp
                  </button>
                )}
                {waStatus === 'connecting' && qrCode && (
                  <div className="flex flex-col items-center">
                    <div className="p-3 rounded-xl mb-2" style={{ background: '#fff' }}>
                      <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-48 h-48" />
                    </div>
                    <p className="text-[10px] text-center" style={{ color: '#8B8A94' }}>
                      Abra o WhatsApp → Dispositivos conectados → Escanear QR Code
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
                      <span className="text-[10px]" style={{ color: '#D4AF37' }}>Aguardando conexão...</span>
                    </div>
                  </div>
                )}
                {waStatus === 'connected' && (
                  <div className="flex items-center gap-2 py-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#2ECC8A' }} />
                    <span className="text-xs" style={{ color: '#2ECC8A' }}>WhatsApp conectado</span>
                    {instanceId && (
                      <span className="text-[9px] ml-auto" style={{ color: '#8B8A94' }}>ID: {instanceId.slice(0, 8)}</span>
                    )}
                  </div>
                )}
                {waStatus === 'error' && (
                  <button
                    onClick={handleConnect}
                    className="w-full py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'rgba(255,107,74,0.15)', color: '#FF6B4A', border: '1px solid rgba(255,107,74,0.3)' }}
                  >
                    Tentar novamente
                  </button>
                )}
              </>
            )}
            {integration.comingSoon && (
              <button
                disabled
                className="w-full py-2 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
                style={{ background: '#1A1A1F', color: '#8B8A94', border: '1px solid #2A2A32' }}
              >
                Em breve
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
