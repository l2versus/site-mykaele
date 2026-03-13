'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../../AdminContext'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'

const WEBHOOK_EVENTS = [
  { value: 'lead.created', label: 'Lead criado' },
  { value: 'lead.won', label: 'Lead ganho' },
  { value: 'lead.lost', label: 'Lead perdido' },
  { value: 'lead.stage_changed', label: 'Lead mudou de estágio' },
  { value: 'message.received', label: 'Mensagem recebida' },
  { value: 'proposal.accepted', label: 'Proposta aceita' },
  { value: 'nps.responded', label: 'NPS respondido' },
]

const ACTION_TYPES = [
  { value: 'create_lead', label: 'Criar lead' },
  { value: 'update_lead', label: 'Atualizar lead' },
  { value: 'custom', label: 'Customizado (só registra log)' },
]

interface OutgoingWebhook {
  id: string
  name: string
  url: string
  events: string[]
  headers: Record<string, string> | null
  isActive: boolean
  createdAt: string
}

interface IncomingWebhook {
  id: string
  name: string
  token: string
  actionType: string
  actionConfig: Record<string, unknown> | null
  isActive: boolean
  createdAt: string
}

interface WebhookLog {
  id: string
  webhookId: string
  direction: string
  event: string
  payload: unknown
  responseStatus: number | null
  attempts: number
  lastAttemptAt: string
  createdAt: string
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function WebhooksPage() {
  const { fetchWithAuth } = useAdmin()
  const [tab, setTab] = useState<'outgoing' | 'incoming' | 'logs'>('outgoing')
  const [loading, setLoading] = useState(true)

  // Outgoing state
  const [outgoing, setOutgoing] = useState<OutgoingWebhook[]>([])
  const [showOutForm, setShowOutForm] = useState(false)
  const [outName, setOutName] = useState('')
  const [outUrl, setOutUrl] = useState('')
  const [outEvents, setOutEvents] = useState<string[]>([])
  const [outHeaders, setOutHeaders] = useState('')
  const [outSaving, setOutSaving] = useState(false)
  const [outError, setOutError] = useState('')

  // Incoming state
  const [incoming, setIncoming] = useState<IncomingWebhook[]>([])
  const [showInForm, setShowInForm] = useState(false)
  const [inName, setInName] = useState('')
  const [inAction, setInAction] = useState('create_lead')
  const [inSource, setInSource] = useState('')
  const [inTags, setInTags] = useState('')
  const [inSaving, setInSaving] = useState(false)
  const [inError, setInError] = useState('')

  // Logs state
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [logsFilter, setLogsFilter] = useState<'all' | 'in' | 'out'>('all')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  // ─── Load data ─────────────────────────────────────────────

  const loadOutgoing = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/admin/crm/webhooks/outgoing?tenantId=${TENANT_ID}`)
      if (res.ok) {
        const data = await res.json()
        setOutgoing(data.webhooks ?? [])
      }
    } catch {}
  }, [fetchWithAuth])

  const loadIncoming = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/admin/crm/webhooks/incoming?tenantId=${TENANT_ID}`)
      if (res.ok) {
        const data = await res.json()
        setIncoming(data.webhooks ?? [])
      }
    } catch {}
  }, [fetchWithAuth])

  const loadLogs = useCallback(async () => {
    try {
      const direction = logsFilter !== 'all' ? `&direction=${logsFilter}` : ''
      const res = await fetchWithAuth(`/api/admin/crm/webhooks/logs?tenantId=${TENANT_ID}&limit=100${direction}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs ?? [])
      }
    } catch {}
  }, [fetchWithAuth, logsFilter])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadOutgoing(), loadIncoming(), loadLogs()]).finally(() => setLoading(false))
  }, [loadOutgoing, loadIncoming, loadLogs])

  // ─── Outgoing CRUD ────────────────────────────────────────

  const createOutgoing = async () => {
    if (!outName || !outUrl || outEvents.length === 0) {
      setOutError('Preencha nome, URL e selecione ao menos um evento')
      return
    }
    setOutSaving(true)
    setOutError('')
    try {
      let headers: Record<string, string> | null = null
      if (outHeaders.trim()) {
        try {
          headers = JSON.parse(outHeaders)
        } catch {
          setOutError('Headers JSON inválido')
          setOutSaving(false)
          return
        }
      }
      const res = await fetchWithAuth('/api/admin/crm/webhooks/outgoing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, name: outName, url: outUrl, events: outEvents, headers }),
      })
      if (res.ok) {
        setShowOutForm(false)
        setOutName('')
        setOutUrl('')
        setOutEvents([])
        setOutHeaders('')
        loadOutgoing()
      } else {
        const data = await res.json()
        setOutError(data.error ?? 'Erro ao criar')
      }
    } catch {
      setOutError('Erro de conexão')
    }
    setOutSaving(false)
  }

  const toggleOutgoing = async (id: string, active: boolean) => {
    await fetchWithAuth(`/api/admin/crm/webhooks/outgoing/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !active }),
    })
    loadOutgoing()
  }

  const deleteOutgoing = async (id: string) => {
    if (!confirm('Excluir este webhook?')) return
    await fetchWithAuth(`/api/admin/crm/webhooks/outgoing/${id}`, { method: 'DELETE' })
    loadOutgoing()
  }

  // ─── Incoming CRUD ────────────────────────────────────────

  const createIncoming = async () => {
    if (!inName) {
      setInError('Preencha o nome')
      return
    }
    setInSaving(true)
    setInError('')
    try {
      const actionConfig: Record<string, unknown> = {}
      if (inSource) actionConfig.defaultSource = inSource
      if (inTags) actionConfig.defaultTags = inTags.split(',').map((t) => t.trim()).filter(Boolean)

      const res = await fetchWithAuth('/api/admin/crm/webhooks/incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, name: inName, actionType: inAction, actionConfig }),
      })
      if (res.ok) {
        setShowInForm(false)
        setInName('')
        setInAction('create_lead')
        setInSource('')
        setInTags('')
        loadIncoming()
      } else {
        const data = await res.json()
        setInError(data.error ?? 'Erro ao criar')
      }
    } catch {
      setInError('Erro de conexão')
    }
    setInSaving(false)
  }

  const toggleIncoming = async (id: string, active: boolean) => {
    await fetchWithAuth(`/api/admin/crm/webhooks/incoming/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !active }),
    })
    loadIncoming()
  }

  const deleteIncoming = async (id: string) => {
    if (!confirm('Excluir este webhook?')) return
    await fetchWithAuth(`/api/admin/crm/webhooks/incoming/${id}`, { method: 'DELETE' })
    loadIncoming()
  }

  const toggleEvent = (event: string) => {
    setOutEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--crm-text)', fontFamily: 'var(--font-display, "Cormorant Garamond", serif)' }}>
          Webhooks
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--crm-text-muted)' }}>
          Envie e receba dados automaticamente de serviços externos
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--crm-surface)' }}>
        {[
          { key: 'outgoing' as const, label: 'Saída', count: outgoing.length, icon: '↗' },
          { key: 'incoming' as const, label: 'Entrada', count: incoming.length, icon: '↙' },
          { key: 'logs' as const, label: 'Logs', count: logs.length, icon: '☰' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === t.key ? 'var(--crm-surface-2)' : 'transparent',
              color: tab === t.key ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
            }}
          >
            <span>{t.icon}</span>
            {t.label}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-pulse"
              style={{ background: 'var(--crm-surface)' }}
            />
          ))}
        </div>
      ) : (
        <>
          {/* ══════════ TAB: SAÍDA ══════════ */}
          {tab === 'outgoing' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>
                  Webhooks de saída enviam dados do CRM para URLs externas quando eventos ocorrem
                </p>
                <button
                  onClick={() => { setShowOutForm(!showOutForm); setOutError('') }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: showOutForm ? 'var(--crm-surface-2)' : 'var(--crm-gold)',
                    color: showOutForm ? 'var(--crm-text-muted)' : '#000',
                  }}
                >
                  {showOutForm ? 'Cancelar' : '+ Novo Webhook'}
                </button>
              </div>

              {/* Form criar outgoing */}
              {showOutForm && (
                <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
                  {outError && (
                    <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(255,107,74,0.1)', color: 'var(--crm-hot)', border: '1px solid rgba(255,107,74,0.2)' }}>
                      {outError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>Nome *</label>
                      <input
                        value={outName}
                        onChange={(e) => setOutName(e.target.value)}
                        placeholder="Ex: Hotmart Notificações"
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>URL de destino *</label>
                      <input
                        value={outUrl}
                        onChange={(e) => setOutUrl(e.target.value)}
                        placeholder="https://exemplo.com/webhook"
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>Eventos *</label>
                    <div className="flex flex-wrap gap-2">
                      {WEBHOOK_EVENTS.map((evt) => (
                        <button
                          key={evt.value}
                          onClick={() => toggleEvent(evt.value)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: outEvents.includes(evt.value) ? 'var(--crm-gold-subtle)' : 'var(--crm-bg)',
                            color: outEvents.includes(evt.value) ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                            border: `1px solid ${outEvents.includes(evt.value) ? 'var(--crm-gold)' : 'var(--crm-border)'}`,
                          }}
                        >
                          {evt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                      Headers customizados (JSON, opcional)
                    </label>
                    <input
                      value={outHeaders}
                      onChange={(e) => setOutHeaders(e.target.value)}
                      placeholder='{"X-Api-Key": "sua-chave"}'
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-mono"
                      style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={createOutgoing}
                      disabled={outSaving}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-all flex items-center gap-2"
                      style={{ background: 'var(--crm-gold)', color: '#000' }}
                    >
                      {outSaving && <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                      Criar Webhook
                    </button>
                  </div>
                </div>
              )}

              {/* Lista outgoing */}
              {outgoing.length === 0 ? (
                <div className="text-center py-16 rounded-xl" style={{ background: 'var(--crm-surface)' }}>
                  <div className="text-4xl mb-3 opacity-40">↗</div>
                  <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>Nenhum webhook de saída configurado</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>
                    Crie um para enviar dados do CRM para serviços externos
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {outgoing.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-xl p-4 transition-all"
                      style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--crm-text)' }}>{w.name}</h3>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{
                                background: w.isActive ? 'rgba(46,204,138,0.1)' : 'rgba(139,138,148,0.1)',
                                color: w.isActive ? 'var(--crm-won)' : 'var(--crm-text-muted)',
                              }}
                            >
                              {w.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <p className="text-xs mt-1 truncate font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                            {w.url}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(w.events ?? []).map((evt) => (
                              <span
                                key={evt}
                                className="text-[10px] px-2 py-0.5 rounded"
                                style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}
                              >
                                {WEBHOOK_EVENTS.find((e) => e.value === evt)?.label ?? evt}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] mt-2" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }}>
                            Criado em {fmtDate(w.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleOutgoing(w.id, w.isActive)}
                            className="p-2 rounded-lg transition-all"
                            style={{ background: 'var(--crm-surface-2)' }}
                            title={w.isActive ? 'Desativar' : 'Ativar'}
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: w.isActive ? 'var(--crm-won)' : 'var(--crm-text-muted)' }}>
                              {w.isActive
                                ? <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                                : <circle cx="12" cy="12" r="10" />}
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteOutgoing(w.id)}
                            className="p-2 rounded-lg transition-all"
                            style={{ background: 'var(--crm-surface-2)' }}
                            title="Excluir"
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--crm-hot)' }}>
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════ TAB: ENTRADA ══════════ */}
          {tab === 'incoming' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>
                  URLs únicas para serviços externos (Hotmart, Calendly, etc.) enviarem dados ao CRM
                </p>
                <button
                  onClick={() => { setShowInForm(!showInForm); setInError('') }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: showInForm ? 'var(--crm-surface-2)' : 'var(--crm-gold)',
                    color: showInForm ? 'var(--crm-text-muted)' : '#000',
                  }}
                >
                  {showInForm ? 'Cancelar' : '+ Novo Webhook'}
                </button>
              </div>

              {/* Form criar incoming */}
              {showInForm && (
                <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}>
                  {inError && (
                    <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(255,107,74,0.1)', color: 'var(--crm-hot)', border: '1px solid rgba(255,107,74,0.2)' }}>
                      {inError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>Nome *</label>
                    <input
                      value={inName}
                      onChange={(e) => setInName(e.target.value)}
                      placeholder="Ex: Hotmart Compras"
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: 'var(--crm-text-muted)' }}>Ação ao receber dados *</label>
                    <div className="flex gap-2">
                      {ACTION_TYPES.map((a) => (
                        <button
                          key={a.value}
                          onClick={() => setInAction(a.value)}
                          className="flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: inAction === a.value ? 'var(--crm-gold-subtle)' : 'var(--crm-bg)',
                            color: inAction === a.value ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                            border: `1px solid ${inAction === a.value ? 'var(--crm-gold)' : 'var(--crm-border)'}`,
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(inAction === 'create_lead' || inAction === 'update_lead') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                          Fonte padrão (source)
                        </label>
                        <input
                          value={inSource}
                          onChange={(e) => setInSource(e.target.value)}
                          placeholder="Ex: hotmart, calendly"
                          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--crm-text-muted)' }}>
                          Tags padrão (separadas por vírgula)
                        </label>
                        <input
                          value={inTags}
                          onChange={(e) => setInTags(e.target.value)}
                          placeholder="Ex: hotmart, comprador"
                          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', color: 'var(--crm-text-muted)' }}>
                    <strong style={{ color: 'var(--crm-text)' }}>Campos automáticos:</strong> O webhook procura automaticamente nos campos do JSON recebido:
                    <code className="block mt-1 font-mono text-[11px]" style={{ color: 'var(--crm-gold)' }}>
                      name/nome, phone/telefone, email, value/valor/price, source
                    </code>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={createIncoming}
                      disabled={inSaving}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-all flex items-center gap-2"
                      style={{ background: 'var(--crm-gold)', color: '#000' }}
                    >
                      {inSaving && <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                      Criar Webhook
                    </button>
                  </div>
                </div>
              )}

              {/* Lista incoming */}
              {incoming.length === 0 ? (
                <div className="text-center py-16 rounded-xl" style={{ background: 'var(--crm-surface)' }}>
                  <div className="text-4xl mb-3 opacity-40">↙</div>
                  <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>Nenhum webhook de entrada configurado</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>
                    Crie um para receber dados de Hotmart, Calendly, etc.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {incoming.map((w) => {
                    const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/crm/${w.token}`
                    return (
                      <div
                        key={w.id}
                        className="rounded-xl p-4 space-y-3 transition-all"
                        style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--crm-text)' }}>{w.name}</h3>
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  background: w.isActive ? 'rgba(46,204,138,0.1)' : 'rgba(139,138,148,0.1)',
                                  color: w.isActive ? 'var(--crm-won)' : 'var(--crm-text-muted)',
                                }}
                              >
                                {w.isActive ? 'Ativo' : 'Inativo'}
                              </span>
                              <span
                                className="text-[10px] px-2 py-0.5 rounded font-medium"
                                style={{ background: 'var(--crm-surface-2)', color: 'var(--crm-text-muted)' }}
                              >
                                {ACTION_TYPES.find((a) => a.value === w.actionType)?.label ?? w.actionType}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => toggleIncoming(w.id, w.isActive)}
                              className="p-2 rounded-lg transition-all"
                              style={{ background: 'var(--crm-surface-2)' }}
                              title={w.isActive ? 'Desativar' : 'Ativar'}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: w.isActive ? 'var(--crm-won)' : 'var(--crm-text-muted)' }}>
                                {w.isActive
                                  ? <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                                  : <circle cx="12" cy="12" r="10" />}
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteIncoming(w.id)}
                              className="p-2 rounded-lg transition-all"
                              style={{ background: 'var(--crm-surface-2)' }}
                              title="Excluir"
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--crm-hot)' }}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* URL copiável */}
                        <div className="flex items-center gap-2">
                          <div
                            className="flex-1 px-3 py-2 rounded-lg font-mono text-xs truncate"
                            style={{ background: 'var(--crm-bg)', color: 'var(--crm-text)', border: '1px solid var(--crm-border)' }}
                          >
                            {fullUrl}
                          </div>
                          <button
                            onClick={() => copyToClipboard(fullUrl)}
                            className="px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0"
                            style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}
                          >
                            Copiar URL
                          </button>
                        </div>

                        <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }}>
                          Criado em {fmtDate(w.createdAt)} · Envie POST com JSON para a URL acima
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════ TAB: LOGS ══════════ */}
          {tab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[
                    { key: 'all' as const, label: 'Todos' },
                    { key: 'out' as const, label: 'Saída' },
                    { key: 'in' as const, label: 'Entrada' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setLogsFilter(f.key)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: logsFilter === f.key ? 'var(--crm-gold-subtle)' : 'var(--crm-surface)',
                        color: logsFilter === f.key ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={loadLogs}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: 'var(--crm-surface)', color: 'var(--crm-text-muted)' }}
                >
                  Atualizar
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-16 rounded-xl" style={{ background: 'var(--crm-surface)' }}>
                  <div className="text-4xl mb-3 opacity-40">☰</div>
                  <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>Nenhum log encontrado</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log) => {
                    const isSuccess = log.responseStatus !== null && log.responseStatus >= 200 && log.responseStatus < 300
                    const isExpanded = expandedLog === log.id
                    return (
                      <div key={log.id}>
                        <button
                          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                          className="w-full text-left rounded-lg px-4 py-3 transition-all flex items-center gap-3"
                          style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
                        >
                          {/* Direção */}
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-bold shrink-0"
                            style={{
                              background: log.direction === 'out' ? 'rgba(74,123,255,0.1)' : 'rgba(212,175,55,0.1)',
                              color: log.direction === 'out' ? 'var(--crm-cold)' : 'var(--crm-gold)',
                            }}
                          >
                            {log.direction === 'out' ? 'SAÍDA' : 'ENTRADA'}
                          </span>

                          {/* Evento */}
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--crm-text)' }}>
                            {log.event}
                          </span>

                          {/* Status */}
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-medium shrink-0"
                            style={{
                              background: isSuccess ? 'rgba(46,204,138,0.1)' : 'rgba(255,107,74,0.1)',
                              color: isSuccess ? 'var(--crm-won)' : 'var(--crm-hot)',
                            }}
                          >
                            {log.responseStatus ?? '—'}
                          </span>

                          {/* Tentativas */}
                          {log.attempts > 1 && (
                            <span className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                              {log.attempts}x
                            </span>
                          )}

                          <span className="ml-auto text-[10px] shrink-0" style={{ color: 'var(--crm-text-muted)' }}>
                            {fmtDate(log.createdAt)}
                          </span>

                          <svg
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--crm-text-muted)' }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div
                            className="mx-2 mt-0.5 p-3 rounded-lg font-mono text-[11px] overflow-auto max-h-64"
                            style={{ background: 'var(--crm-bg)', color: 'var(--crm-text-muted)', border: '1px solid var(--crm-border)' }}
                          >
                            <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
