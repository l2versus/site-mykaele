'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAdmin } from '../AdminContext'

interface BroadcastClient {
  id: string
  name: string
  phone: string
  email: string
  createdAt: string
  _count: { appointments: number }
}

function openWhatsApp(phone: string, msg: string) {
  const clean = phone.replace(/\D/g, '')
  const num = clean.startsWith('55') ? clean : `55${clean}`
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
}

function personalizeMsg(template: string, client: BroadcastClient): string {
  const firstName = client.name.split(' ')[0]
  return template
    .replace(/\{nome\}/gi, client.name)
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{email\}/gi, client.email)
    .replace(/\{telefone\}/gi, client.phone || '')
}

const TEMPLATES = [
  {
    label: '💆 Promoção',
    msg: 'Olá {primeiro_nome}! 🌸\n\nTenho uma promoção especial para você!\n\nQuer saber mais? Me chama aqui! 💕\n\n— Mykaele Procópio',
  },
  {
    label: '📅 Agendamento',
    msg: 'Olá {primeiro_nome}! 💛\n\nFaz um tempinho que não nos vemos! Que tal agendar uma sessão?\n\nEstou com horários disponíveis esta semana. Vamos marcar? 🗓️\n\n— Mykaele Procópio',
  },
  {
    label: '🎉 Novidade',
    msg: 'Oi {primeiro_nome}! ✨\n\nTenho novidades incríveis no Home Spa que você vai amar!\n\nVem conferir? Me chama para saber mais! 🌟\n\n— Mykaele Procópio',
  },
  {
    label: '🎄 Data especial',
    msg: 'Olá {primeiro_nome}! 🌺\n\nNessa data especial, quero te desejar tudo de melhor!\n\nE claro, preparei algo especial para você. Vamos conversar? 💝\n\n— Mykaele Procópio',
  },
  {
    label: '⭐ Fidelidade',
    msg: 'Oi {primeiro_nome}! 🌸\n\nVocê é uma cliente muito especial e quero te agradecer por confiar no meu trabalho!\n\nPreparei um mimo exclusivo para você. Quer saber? 💕\n\n— Mykaele Procópio',
  },
]

export default function MensagensPage() {
  const { fetchWithAuth } = useAdmin()
  const [clients, setClients] = useState<BroadcastClient[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ sent: 0, total: 0 })
  const [showPreview, setShowPreview] = useState(false)
  const [sendHistory, setSendHistory] = useState<string[]>([])
  const [intervalSec, setIntervalSec] = useState(5)

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/broadcast')
      if (res.ok) {
        const d = await res.json()
        setClients(d.clients || [])
      }
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(c => c.id)))
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const startBroadcast = async () => {
    if (!message.trim() || selected.size === 0) return

    const targets = clients.filter(c => selected.has(c.id))
    setSending(true)
    setProgress({ sent: 0, total: targets.length })
    const history: string[] = []

    for (let i = 0; i < targets.length; i++) {
      const c = targets[i]
      const personalizedMsg = personalizeMsg(message, c)
      openWhatsApp(c.phone, personalizedMsg)
      history.push(c.name)
      setProgress({ sent: i + 1, total: targets.length })

      // Esperar entre cada envio para não sobrecarregar
      if (i < targets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalSec * 1000))
      }
    }

    setSendHistory(history)
    setSending(false)
  }

  const cancelBroadcast = () => {
    setSending(false)
  }

  const previewClient = clients.find(c => selected.has(c.id)) || clients[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white/90 tracking-tight flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-400">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </span>
          Mensagens em Massa
        </h1>
        <p className="text-white/30 text-xs mt-1 ml-[46px]">Envie mensagens personalizadas via WhatsApp para seus clientes</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Column 1: Message Composer ── */}
        <div className="xl:col-span-1 space-y-4">
          {/* Templates */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <h3 className="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Modelos prontos
            </h3>
            <div className="space-y-1.5">
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => setMessage(t.msg)}
                  className="w-full text-left px-3 py-2 rounded-lg text-[11px] bg-white/[0.02] border border-white/[0.05] text-white/50 hover:text-white/70 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all">
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Composer */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <h3 className="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Compor mensagem
            </h3>

            {/* Variables help */}
            <div className="mb-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <p className="text-amber-400/70 text-[10px] font-medium mb-1.5">Variáveis disponíveis:</p>
              <div className="flex flex-wrap gap-1.5">
                {['{primeiro_nome}', '{nome}', '{email}', '{telefone}'].map(v => (
                  <button key={v} onClick={() => setMessage(prev => prev + v)}
                    className="px-2 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400/60 border border-amber-500/15 hover:bg-amber-500/20 transition-all">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              placeholder="Digite sua mensagem personalizada aqui...&#10;&#10;Use {primeiro_nome} para inserir o nome do cliente automaticamente!"
              className="w-full px-3.5 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl text-white text-xs focus:outline-none focus:border-[#b76e79]/40 focus:bg-white/[0.05] resize-none placeholder-white/20 transition-all leading-relaxed"
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-white/20 text-[10px]">{message.length} caracteres</span>
              {message && previewClient && (
                <button onClick={() => setShowPreview(true)}
                  className="text-[10px] text-[#b76e79]/70 hover:text-[#b76e79] transition-colors flex items-center gap-1">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Pré-visualizar
                </button>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <h3 className="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Configurações
            </h3>

            <label className="block text-white/40 text-[10px] mb-1.5">Intervalo entre envios (segundos)</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={3} max={15} value={intervalSec}
                onChange={e => setIntervalSec(Number(e.target.value))}
                className="flex-1 accent-[#b76e79]"
              />
              <span className="text-white/60 text-xs font-mono w-8 text-right">{intervalSec}s</span>
            </div>
            <p className="text-white/20 text-[9px] mt-1">Tempo estimado: ~{Math.ceil(selected.size * intervalSec / 60)} min para {selected.size} clientes</p>
          </div>

          {/* Send Button */}
          <button
            onClick={startBroadcast}
            disabled={!message.trim() || selected.size === 0 || sending}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {sending ? `Enviando... (${progress.sent}/${progress.total})` : `Enviar para ${selected.size} clientes`}
          </button>
        </div>

        {/* ── Column 2-3: Client Selection ── */}
        <div className="xl:col-span-2 space-y-4">
          {/* Search & Select All */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nome, telefone ou email..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl text-white text-xs focus:outline-none focus:border-[#b76e79]/40 placeholder-white/20 transition-all"
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={toggleAll}
                  className="px-4 py-2.5 rounded-xl text-[11px] font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/70 hover:bg-white/[0.08] transition-all whitespace-nowrap">
                  {selected.size === filtered.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#b76e79]/10 border border-[#b76e79]/15">
                  <span className="text-[#b76e79] text-xs font-bold">{selected.size}</span>
                  <span className="text-[#b76e79]/60 text-[10px]">selecionados</span>
                </div>
              </div>
            </div>
          </div>

          {/* Client List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#b76e79]/30 border-t-[#b76e79] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-white/30 text-sm">Nenhum cliente com telefone cadastrado</p>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                {filtered.map(c => {
                  const isSelected = selected.has(c.id)
                  return (
                    <label key={c.id}
                      className={`flex items-center gap-3.5 px-4 py-3 border-b border-white/[0.04] cursor-pointer transition-all hover:bg-white/[0.03] ${isSelected ? 'bg-emerald-500/[0.04]' : ''}`}>
                      <input
                        type="checkbox" checked={isSelected} onChange={() => toggle(c.id)}
                        className="w-4 h-4 rounded border-white/20 bg-white/[0.05] text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 flex-shrink-0"
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#b76e79]/20 to-[#b76e79]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#b76e79] text-[11px] font-bold">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 text-xs font-medium truncate">{c.name}</p>
                        <p className="text-white/30 text-[10px] truncate">{c.phone} · {c._count.appointments} agendamento{c._count.appointments !== 1 ? 's' : ''}</p>
                      </div>
                      {isSelected && (
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-400 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </label>
                  )
                })}
              </div>
              <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
                <p className="text-white/25 text-[10px]">Mostrando {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} com telefone</p>
              </div>
            </div>
          )}

          {/* Send History */}
          {sendHistory.length > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
              <h3 className="text-emerald-400 text-xs font-semibold mb-2 flex items-center gap-2">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Envio concluído — {sendHistory.length} mensagen{sendHistory.length !== 1 ? 's' : ''}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {sendHistory.map((name, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/15">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sending Progress Modal ── */}
      {sending && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center px-4">
          <div className="bg-[#1a1820] border border-white/[0.08] rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-400 animate-pulse">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <h3 className="text-white/90 text-lg font-semibold mb-1">Enviando mensagens...</h3>
            <p className="text-white/40 text-xs mb-6">Não feche as abas do WhatsApp Web que abrirem</p>

            {/* Progress bar */}
            <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progress.total > 0 ? (progress.sent / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-white/50 text-xs mb-5">
              {progress.sent} de {progress.total} · Próximo em {intervalSec}s
            </p>

            <button onClick={cancelBroadcast}
              className="px-5 py-2 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
              Cancelar envio
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Preview Modal ── */}
      {showPreview && previewClient && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center px-4" onClick={() => setShowPreview(false)}>
          <div className="bg-[#1a1820] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white/80 text-sm font-semibold mb-1 flex items-center gap-2">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Pré-visualização
            </h3>
            <p className="text-white/30 text-[10px] mb-4">Como a mensagem será vista por {previewClient.name.split(' ')[0]}</p>

            {/* Chat bubble */}
            <div className="bg-[#005c4b] rounded-xl rounded-tr-sm p-3.5 max-w-[85%] ml-auto">
              <p className="text-white text-xs leading-relaxed whitespace-pre-wrap">{personalizeMsg(message, previewClient)}</p>
              <p className="text-right text-white/40 text-[9px] mt-1.5">Agora ✓✓</p>
            </div>

            <button onClick={() => setShowPreview(false)}
              className="mt-5 w-full py-2.5 rounded-lg text-xs text-white/50 border border-white/[0.08] hover:bg-white/[0.05] transition-all">
              Fechar
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
