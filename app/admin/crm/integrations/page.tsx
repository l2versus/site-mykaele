'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { playFeedback } from '@/lib/crm-feedback'
import { useToastStore } from '@/stores/toast-store'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const WhatsAppIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

export default function IntegrationsPage() {
  const [waStatus, setWaStatus] = useState<ConnectionStatus>('disconnected')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const addToast = useToastStore(s => s.addToast)

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/evolution`
    : '/api/webhooks/evolution'

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
        addToast('WhatsApp conectado com sucesso!')
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
      stopPolling()
      pollingRef.current = setInterval(fetchStatus, 3000)
    } catch {
      setWaStatus('error')
      addToast('Erro ao conectar WhatsApp', 'error')
    }
  }

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  useEffect(() => {
    fetchStatus()
    return stopPolling
  }, [fetchStatus])

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: '#F0EDE8' }}>Integrações</h1>
      <p className="text-xs mb-6" style={{ color: '#8B8A94' }}>Conecte canais e serviços ao seu CRM</p>

      {/* WhatsApp Card */}
      <div className="max-w-lg">
        <motion.div
          className="rounded-xl border p-5"
          style={{ background: '#111114', borderColor: waStatus === 'connected' ? 'rgba(46,204,138,0.3)' : '#2A2A32' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#1A1A1F' }}>
                <WhatsAppIcon />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: '#F0EDE8' }}>WhatsApp</h3>
                <p className="text-[11px]" style={{ color: '#8B8A94' }}>Evolution API v2</p>
              </div>
            </div>
            {waStatus === 'connected' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: 'rgba(46,204,138,0.15)', color: '#2ECC8A' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2ECC8A' }} />
                Conectado
              </span>
            )}
            {waStatus === 'connecting' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>Conectando...</span>
            )}
            {waStatus === 'error' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,107,74,0.15)', color: '#FF6B4A' }}>Erro</span>
            )}
            {waStatus === 'disconnected' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#1A1A1F', color: '#8B8A94' }}>Desconectado</span>
            )}
          </div>

          <p className="text-xs mb-4" style={{ color: '#8B8A94' }}>
            Conecte via Evolution API para mensagens bidirecionais em tempo real.
          </p>

          {waStatus === 'disconnected' && (
            <button
              onClick={handleConnect}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
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
                Abra o WhatsApp &rarr; Dispositivos conectados &rarr; Escanear QR Code
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
              <span className="text-xs font-medium" style={{ color: '#2ECC8A' }}>WhatsApp conectado</span>
              {instanceId && (
                <span className="text-[9px] ml-auto font-mono" style={{ color: '#8B8A94' }}>ID: {instanceId.slice(0, 12)}</span>
              )}
            </div>
          )}

          {waStatus === 'error' && (
            <button
              onClick={handleConnect}
              className="w-full py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(255,107,74,0.15)', color: '#FF6B4A', border: '1px solid rgba(255,107,74,0.3)' }}
            >
              Tentar novamente
            </button>
          )}
        </motion.div>

        {/* Webhook URL */}
        <motion.div
          className="rounded-xl border p-4 mt-4"
          style={{ background: '#111114', borderColor: '#2A2A32' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" fill="none" stroke="#8B8A94" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="text-xs font-medium" style={{ color: '#F0EDE8' }}>Webhook URL</span>
          </div>
          <p className="text-[10px] mb-2" style={{ color: '#8B8A94' }}>
            Configure este endpoint na Evolution API para receber mensagens:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono px-3 py-2 rounded-lg truncate"
              style={{ background: '#0A0A0B', color: '#D4AF37', border: '1px solid #2A2A32' }}
            >
              {webhookUrl}
            </code>
            <button
              onClick={handleCopyWebhook}
              className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: copied ? 'rgba(46,204,138,0.15)' : '#1A1A1F',
                color: copied ? '#2ECC8A' : '#8B8A94',
                border: `1px solid ${copied ? 'rgba(46,204,138,0.3)' : '#2A2A32'}`,
              }}
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
