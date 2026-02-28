'use client'

import { useState, useRef } from 'react'
import { useClient } from '../ClientContext'

type AnyUser = Record<string, unknown>

/* ─── Compact Input ─── */
function ProfileInput({ label, value, onChange, placeholder, required, type = 'text', disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
  required?: boolean; type?: string; disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-white/35 text-[10px] font-semibold tracking-wider uppercase">
        {label}
        {required && <span className="text-[#d4a0a7] text-[8px]">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.07] rounded-xl text-white text-sm
          focus:outline-none focus:border-[#b76e79]/40 focus:bg-white/[0.06] placeholder-white/12
          disabled:opacity-35 disabled:cursor-not-allowed transition-all"
        placeholder={placeholder} />
    </div>
  )
}

export default function PerfilPage() {
  const { user, fetchWithAuth, logout, refreshUser } = useClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const u = user as unknown as AnyUser

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    cpfRg: (u?.cpfRg as string) || '',
    address: (u?.address as string) || '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [settingsModal, setSettingsModal] = useState<'whatsapp' | 'privacy' | 'help' | null>(null)
  const [wppNotif, setWppNotif] = useState(true)
  const [wppReminder24h, setWppReminder24h] = useState(true)
  const [wppPromo, setWppPromo] = useState(false)

  const save = async () => {
    if (!form.name.trim()) { setMessage('Nome obrigatorio'); setMsgType('error'); return }
    if (!form.phone.trim()) { setMessage('Telefone obrigatorio'); setMsgType('error'); return }
    if (!form.cpfRg.trim()) { setMessage('CPF/RG obrigatorio'); setMsgType('error'); return }
    if (!form.address.trim()) { setMessage('Endereco obrigatorio'); setMsgType('error'); return }
    setSaving(true); setMessage('')
    try {
      const res = await fetchWithAuth('/api/patient/profile', { method: 'PUT', body: JSON.stringify(form) })
      if (res.ok) { refreshUser(); setEditing(false); setMsgType('success'); setMessage('Perfil salvo!'); setTimeout(() => setMessage(''), 4000) }
      else { setMsgType('error'); setMessage('Erro ao salvar') }
    } catch { setMsgType('error'); setMessage('Erro de conexao') }
    setSaving(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setMsgType('error'); setMessage('Max 5MB'); setTimeout(() => setMessage(''), 3000); return }
    setUploadingPhoto(true)
    try {
      const fd = new FormData(); fd.append('avatar', file)
      const res = await fetch('/api/patient/profile', {
        method: 'PUT', headers: { Authorization: `Bearer ${localStorage.getItem('client_token')}` }, body: fd,
      })
      if (res.ok) { refreshUser(); setMsgType('success'); setMessage('Foto atualizada!'); setTimeout(() => setMessage(''), 3000) }
      else { setMsgType('error'); setMessage('Erro ao enviar foto') }
    } catch { setMsgType('error'); setMessage('Erro de conexao') }
    setUploadingPhoto(false)
  }

  const startEdit = () => {
    setEditing(true)
    setForm({ name: user?.name || '', phone: user?.phone || '', cpfRg: (u?.cpfRg as string) || '', address: (u?.address as string) || '' })
  }

  const fields = [
    { label: 'Nome completo', value: user?.name, key: 'name', icon: '\uD83D\uDC64', color: 'text-[#d4a0a7]' },
    { label: 'Email', value: user?.email, key: 'email', icon: '\u2709\uFE0F', color: 'text-blue-400' },
    { label: 'WhatsApp', value: user?.phone, key: 'phone', icon: '💬', color: 'text-emerald-400' },
    { label: 'CPF / RG', value: u?.cpfRg as string, key: 'cpfRg', icon: '\uD83E\uDEAA', color: 'text-amber-400' },
    { label: 'Endereço', value: u?.address as string, key: 'address', icon: '\uD83D\uDCCD', color: 'text-purple-400' },
  ]
  const profileComplete = !!(user?.name && user?.phone && u?.cpfRg && u?.address)

  return (
    <div className="space-y-5 animate-[fadeIn_0.5s_ease-out]">

      {/* ═══ Cover Banner + Avatar + Info ═══ */}
      <div className="relative overflow-hidden rounded-3xl">
        {/* Cover Banner — foto da Mykaele */}
        <div className="relative h-36 sm:h-44 overflow-hidden">
          <img
            src="/media/profissionais/mykaele-principal.png"
            alt="Mykaele Procópio Home Spa"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: 'center 15%' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0b10] via-[#0e0b10]/60 to-[#0e0b10]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#b76e79]/10 via-transparent to-purple-500/5" />
          {/* Leaf watermark na cover */}
          <svg viewBox="0 0 200 320" className="absolute top-4 right-4 w-14 h-20 text-white/[0.06]">
            <path d="M100 10 C60 80, 30 150, 40 230 C50 290, 85 310, 100 310 C80 260, 75 210, 90 165 C105 120, 130 90, 100 10Z" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
            <path d="M90 165 C105 155, 130 160, 148 190 C158 210, 155 235, 140 260 C125 280, 110 300, 100 310" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Card body com avatar sobrepondo a cover */}
        <div className="relative bg-gradient-to-b from-[#0e0b10] to-[#0e0b10]/95 border border-[#b76e79]/10 border-t-0 rounded-b-3xl px-5 sm:px-7 pb-6 pt-0">
          {/* Avatar — posicionado subindo sobre a cover */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-14">
            <div className="relative shrink-0 self-center sm:self-auto">
              {user?.avatar ? (
                <img src={user.avatar} alt=""
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shadow-2xl shadow-black/50 ring-[3px] ring-[#0e0b10] border border-[#b76e79]/15" />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-[#c28a93] to-[#9e6670] flex items-center justify-center text-white text-3xl sm:text-4xl font-light shadow-2xl shadow-black/50 ring-[3px] ring-[#0e0b10] border border-[#b76e79]/15">
                  {user?.name?.charAt(0)}
                </div>
              )}
              <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-gradient-to-br from-[#b76e79] to-[#c28a93] flex items-center justify-center text-white shadow-lg shadow-[#b76e79]/30 hover:scale-110 active:scale-95 transition-transform border-[3px] border-[#0e0b10]">
                {uploadingPhoto ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* Info — ao lado do avatar em desktop, embaixo em mobile */}
            <div className="flex-1 min-w-0 text-center sm:text-left pb-0 sm:pb-1.5">
              <h2 className="text-white text-xl sm:text-2xl font-semibold tracking-tight truncate">{user?.name}</h2>
              <p className="text-white/30 text-xs sm:text-sm mt-1 truncate">{user?.email}</p>
              <div className="flex items-center gap-2.5 mt-3 flex-wrap justify-center sm:justify-start">
                <span className="text-[9px] px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#b76e79]/15 to-[#d4a0a7]/10 border border-[#b76e79]/15 text-[#d4a0a7]/80 font-bold tracking-wider uppercase flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  VIP
                </span>
                {!profileComplete && (
                  <span className="text-[9px] px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/15 text-amber-400/70 font-medium animate-pulse">
                    Incompleto
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Message ═══ */}
      {message && (
        <div className={`text-xs rounded-xl px-4 py-3 text-center animate-[fadeIn_0.3s] font-medium ${
          msgType === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/15 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/15 text-red-400'
        }`}>{message}</div>
      )}

      {/* ═══ Quick Cards ═══ */}
      <div className="grid grid-cols-2 gap-3">
        <a href="/cliente/anamnese" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/12 to-teal-500/5 group-hover:from-emerald-500/20 transition-all duration-500" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-400/[0.06] rounded-full -translate-y-6 translate-x-6 blur-xl" />
          <div className="relative border border-emerald-500/10 group-hover:border-emerald-500/20 rounded-2xl p-4 transition-all">
            <div className="text-xl mb-2">📋</div>
            <div className="text-white/70 text-xs font-semibold group-hover:text-white/90 transition-colors">Anamnese</div>
            <div className="text-emerald-400/30 text-[10px] mt-0.5">Ficha de saude</div>
          </div>
        </a>
        <a href="/cliente/evolucao" className="group relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/12 to-cyan-500/5 group-hover:from-blue-500/20 transition-all duration-500" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-400/[0.06] rounded-full -translate-y-6 translate-x-6 blur-xl" />
          <div className="relative border border-blue-500/10 group-hover:border-blue-500/20 rounded-2xl p-4 transition-all">
            <div className="text-xl mb-2">📊</div>
            <div className="text-white/70 text-xs font-semibold group-hover:text-white/90 transition-colors">Evolucao</div>
            <div className="text-blue-400/30 text-[10px] mt-0.5">Medidas corporais</div>
          </div>
        </a>
      </div>

      {/* ═══ Profile Fields ═══ */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01]" />
        <div className="relative border border-white/[0.06] rounded-3xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#b76e79]/10 flex items-center justify-center text-[#d4a0a7]/60">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span className="text-white/50 text-xs font-medium">Dados Pessoais</span>
            </div>
            {!editing && (
              <button onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] text-[#d4a0a7]/60 border border-[#b76e79]/10 hover:border-[#b76e79]/25 hover:text-[#d4a0a7] hover:bg-[#b76e79]/5 transition-all font-medium">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
            )}
          </div>

          {editing ? (
            <div className="p-5 space-y-4">
              <ProfileInput label="Nome completo" value={form.name} onChange={v => setForm({...form, name: v})} placeholder="Seu nome" required />
              <ProfileInput label="Telefone" value={form.phone} onChange={v => setForm({...form, phone: v})} placeholder="(85) 99999-0000" required />
              <ProfileInput label="CPF ou RG" value={form.cpfRg} onChange={v => setForm({...form, cpfRg: v})} placeholder="000.000.000-00" required />
              <ProfileInput label="Endereco" value={form.address} onChange={v => setForm({...form, address: v})} placeholder="Rua, numero, bairro" required />
              <ProfileInput label="Email" value={user?.email || ''} onChange={() => {}} disabled />

              <div className="flex gap-2.5 pt-2">
                <button onClick={() => setEditing(false)}
                  className="flex-1 py-3 rounded-xl border border-white/[0.06] text-white/25 text-xs font-medium hover:text-white/50 transition-all">
                  Cancelar
                </button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-xs font-medium shadow-lg shadow-[#b76e79]/15 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all">
                  {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                    <>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {fields.map(f => (
                <div key={f.key} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.01] transition-colors">
                  <span className={`text-sm w-6 text-center ${f.color} opacity-60`}>{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white/15 text-[9px] font-semibold uppercase tracking-wider">{f.label}</div>
                    <div className={`text-sm mt-0.5 truncate ${f.value ? 'text-white/65' : 'text-white/12 italic'}`}>
                      {f.value || 'Nao informado'}
                    </div>
                  </div>
                  {!f.value && f.key !== 'email' && (
                    <span className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/50 border border-amber-500/10 font-semibold shrink-0">
                      Obrigatorio
                    </span>
                  )}
                </div>
              ))}

              {!profileComplete && (
                <div className="p-5">
                  <button onClick={startEdit}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/12 text-amber-400/70 text-[11px] font-medium hover:border-amber-500/25 hover:text-amber-400 transition-all flex items-center justify-center gap-2">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Complete seu cadastro para agendar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Settings ═══ */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" />
        <div className="relative border border-white/[0.05] rounded-3xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.03]">
            <span className="text-white/15 text-[9px] font-bold uppercase tracking-[0.2em]">Configurações</span>
          </div>
          {([
            { key: 'whatsapp' as const, label: 'Notificações WhatsApp', desc: 'Lembretes de sessões', icon: '🔔', iconColor: 'text-amber-400' },
            { key: 'privacy' as const, label: 'Privacidade', desc: 'Seus dados pessoais', icon: '🔒', iconColor: 'text-blue-400' },
            { key: 'help' as const, label: 'Ajuda e Suporte', desc: 'Dúvidas ou problemas', icon: '❓', iconColor: 'text-purple-400' },
          ]).map(item => (
            <div key={item.key} onClick={() => setSettingsModal(item.key)} className="flex items-center gap-3.5 px-5 py-4 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer active:bg-white/[0.04]">
              <span className={`text-base ${item.iconColor} opacity-50`}>{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-white/50 text-xs font-medium">{item.label}</div>
                <div className="text-white/12 text-[10px] mt-0.5">{item.desc}</div>
              </div>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-white/8 shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Settings Modal ═══ */}
      {settingsModal && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSettingsModal(null)}>
          <div className="w-full sm:max-w-md bg-[#1a1a2e] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Handle bar mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/10" />
            </div>

            {settingsModal === 'whatsapp' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white/80 text-sm font-semibold flex items-center gap-2">🔔 Notificações WhatsApp</h3>
                    <p className="text-white/20 text-[11px] mt-1">Gerencie seus lembretes e alertas</p>
                  </div>
                  <button onClick={() => setSettingsModal(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/20">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Toggle: Lembretes de sessão */}
                  <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05]">
                    <div>
                      <div className="text-white/60 text-xs font-medium">Lembretes de sessão</div>
                      <div className="text-white/15 text-[10px] mt-0.5">Receba aviso antes do horário agendado</div>
                    </div>
                    <button onClick={() => setWppNotif(!wppNotif)}
                      className={`relative w-11 h-6 rounded-full transition-all ${wppNotif ? 'bg-[#b76e79]' : 'bg-white/10'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${wppNotif ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Toggle: 24h antes */}
                  <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05]">
                    <div>
                      <div className="text-white/60 text-xs font-medium">Lembrete 24h antes</div>
                      <div className="text-white/15 text-[10px] mt-0.5">Confirmação de presença um dia antes</div>
                    </div>
                    <button onClick={() => setWppReminder24h(!wppReminder24h)}
                      className={`relative w-11 h-6 rounded-full transition-all ${wppReminder24h ? 'bg-[#b76e79]' : 'bg-white/10'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${wppReminder24h ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Toggle: Promoções */}
                  <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05]">
                    <div>
                      <div className="text-white/60 text-xs font-medium">Promoções e novidades</div>
                      <div className="text-white/15 text-[10px] mt-0.5">Descontos exclusivos e lançamentos</div>
                    </div>
                    <button onClick={() => setWppPromo(!wppPromo)}
                      className={`relative w-11 h-6 rounded-full transition-all ${wppPromo ? 'bg-[#b76e79]' : 'bg-white/10'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${wppPromo ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <p className="text-emerald-400/50 text-[10px]">📱 As notificações são enviadas para o WhatsApp cadastrado no seu perfil: <span className="font-semibold text-emerald-400/70">{user?.phone || 'Não informado'}</span></p>
                </div>

                <button onClick={() => setSettingsModal(null)} className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-xs font-medium">
                  Salvar preferências
                </button>
              </div>
            )}

            {settingsModal === 'privacy' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white/80 text-sm font-semibold flex items-center gap-2">🔒 Privacidade</h3>
                    <p className="text-white/20 text-[11px] mt-1">Como tratamos seus dados</p>
                  </div>
                  <button onClick={() => setSettingsModal(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/20">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05] space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-blue-400/40 text-sm mt-0.5">🛡️</span>
                      <div>
                        <div className="text-white/50 text-xs font-medium">Dados protegidos</div>
                        <p className="text-white/20 text-[10px] mt-1 leading-relaxed">Seus dados pessoais (nome, telefone, CPF, endereço) são armazenados com segurança e utilizados exclusivamente para prestação de serviços.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05] space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-violet-400/40 text-sm mt-0.5">📋</span>
                      <div>
                        <div className="text-white/50 text-xs font-medium">Registros médicos</div>
                        <p className="text-white/20 text-[10px] mt-1 leading-relaxed">Suas medidas corporais, anamnese e fotos de evolução são confidenciais e de acesso exclusivo seu e da profissional responsável.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05] space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-amber-400/40 text-sm mt-0.5">💳</span>
                      <div>
                        <div className="text-white/50 text-xs font-medium">Pagamentos</div>
                        <p className="text-white/20 text-[10px] mt-1 leading-relaxed">Pagamentos online são processados pelo Mercado Pago. Não armazenamos dados de cartão de crédito.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                    <div className="flex items-start gap-3">
                      <span className="text-red-400/40 text-sm mt-0.5">🗑️</span>
                      <div>
                        <div className="text-white/50 text-xs font-medium">Excluir minha conta</div>
                        <p className="text-white/20 text-[10px] mt-1 leading-relaxed">Para solicitar exclusão dos seus dados, entre em contato pelo WhatsApp.</p>
                        <a href="https://wa.me/5585999086924?text=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20a%20exclus%C3%A3o%20dos%20meus%20dados." target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 text-[10px] text-red-400/50 hover:text-red-400/80 transition-colors font-medium">
                          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                          Solicitar exclusão
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={() => setSettingsModal(null)} className="w-full py-3 rounded-2xl border border-white/[0.06] text-white/30 text-xs font-medium hover:text-white/50 transition-all">
                  Fechar
                </button>
              </div>
            )}

            {settingsModal === 'help' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white/80 text-sm font-semibold flex items-center gap-2">❓ Ajuda e Suporte</h3>
                    <p className="text-white/20 text-[11px] mt-1">Estamos aqui para ajudar</p>
                  </div>
                  <button onClick={() => setSettingsModal(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/20">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  {/* FAQ rápido */}
                  {[
                    { q: 'Como agendo uma sessão?', a: 'Acesse "Agendar" no menu inferior, escolha o serviço, data e horário disponível.' },
                    { q: 'Como cancelar um agendamento?', a: 'Vá em "Agendamentos", toque na sessão e clique em "Cancelar". Cancelamentos devem ser feitos com 24h de antecedência.' },
                    { q: 'Como funciona o pagamento?', a: 'Aceitamos PIX, cartão de crédito (até 12x) e dinheiro. O pagamento online é processado pelo Mercado Pago.' },
                    { q: 'Onde vejo minha evolução?', a: 'Na aba "Evolução" do menu, você acompanha suas medidas corporais registradas pela profissional.' },
                    { q: 'E os pacotes?', a: 'Em "Pacotes" você visualiza seus pacotes ativos e quantidade de sessões disponíveis.' },
                  ].map((item, i) => (
                    <details key={i} className="group">
                      <summary className="flex items-center gap-3 p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05] cursor-pointer hover:bg-white/[0.05] transition-colors list-none">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-[#b76e79]/40 shrink-0 transition-transform group-open:rotate-90"><polyline points="9 18 15 12 9 6"/></svg>
                        <span className="text-white/50 text-xs font-medium">{item.q}</span>
                      </summary>
                      <div className="px-11 pb-3 pt-1">
                        <p className="text-white/25 text-[11px] leading-relaxed">{item.a}</p>
                      </div>
                    </details>
                  ))}
                </div>

                {/* Contato direto */}
                <div className="p-4 bg-[#b76e79]/5 rounded-2xl border border-[#b76e79]/10 space-y-3">
                  <div className="text-white/50 text-xs font-medium">Precisa de mais ajuda?</div>
                  <div className="flex gap-2">
                    <a href="https://wa.me/5585999086924?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20app" target="_blank" rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-400/70 text-[11px] font-medium text-center hover:bg-emerald-500/20 transition-all">
                      💬 WhatsApp
                    </a>
                    <a href="tel:+5585999086924"
                      className="flex-1 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15 text-blue-400/70 text-[11px] font-medium text-center hover:bg-blue-500/20 transition-all">
                      📞 Ligar
                    </a>
                  </div>
                </div>

                <button onClick={() => setSettingsModal(null)} className="w-full py-3 rounded-2xl border border-white/[0.06] text-white/30 text-xs font-medium hover:text-white/50 transition-all">
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Logout ═══ */}
      <button onClick={logout}
        className="w-full py-3.5 rounded-2xl border border-red-500/6 text-red-400/25 text-xs font-medium hover:text-red-400/60 hover:border-red-500/15 hover:bg-red-500/5 transition-all">
        Sair da conta
      </button>
    </div>
  )
}
