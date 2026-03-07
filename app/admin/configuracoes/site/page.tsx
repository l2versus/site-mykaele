'use client'

import { useState, useEffect } from 'react'
import { useAdmin } from '../../AdminContext'

const Ico = {
  globe: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  save: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  back: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>,
}

interface SiteSettings {
  whatsapp: string
  heroTitle: string
  aboutText: string
}

export default function SiteSettingsPage() {
  const { fetchWithAuth } = useAdmin()
  const [form, setForm] = useState<SiteSettings>({ whatsapp: '', heroTitle: '', aboutText: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [dirty, setDirty] = useState(false)

  const showFeedback = (msg: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3500)
  }

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetchWithAuth('/api/admin/settings')
        if (res.ok) {
          const { settings } = await res.json()
          setForm({ whatsapp: settings.whatsapp || '', heroTitle: settings.heroTitle || '', aboutText: settings.aboutText || '' })
        }
      } catch { /* silently */ }
      setLoading(false)
    })()
  }, [fetchWithAuth])

  const handleChange = (field: keyof SiteSettings, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      if (res.ok) {
        showFeedback('Configurações salvas! O site foi atualizado.')
        setDirty(false)
      } else {
        const data = await res.json().catch(() => ({}))
        showFeedback(data.error || 'Erro ao salvar', 'error')
      }
    } catch {
      showFeedback('Erro de conexão', 'error')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-stone-100 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-stone-100 rounded-lg w-1/3" />
              <div className="h-3 bg-stone-50 rounded w-1/2" />
            </div>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-stone-100 rounded-xl" />
                <div className="h-5 bg-stone-100 rounded w-32" />
              </div>
              <div className="h-12 bg-stone-50 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto animate-[fadeIn_0.4s_ease-out]">
      {/* ═══ Header Premium ═══ */}
      <div className="flex items-center gap-4 mb-10">
        <a href="/admin/configuracoes"
          className="w-10 h-10 rounded-xl bg-white border border-stone-200 hover:border-stone-300 flex items-center justify-center transition-all text-stone-400 hover:text-stone-600 shadow-sm hover:shadow">
          {Ico.back}
        </a>
        <div>
          <h1 className="text-stone-800 text-2xl font-bold tracking-tight">Configurações do Site</h1>
          <p className="text-stone-400 text-sm mt-0.5">Personalize os textos e informações do seu site público</p>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`mb-8 px-5 py-3.5 rounded-2xl text-sm font-medium border transition-all animate-[fadeIn_0.2s_ease-out] flex items-center gap-3 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100'
            : 'bg-red-50 text-red-600 border-red-200 shadow-sm shadow-red-100'
        }`}>
          {feedback.type === 'success' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          )}
          {feedback.msg}
        </div>
      )}

      <div className="space-y-6">
        {/* ═══ Card: Comunicação (WhatsApp) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm shadow-stone-200/60 border border-stone-100 overflow-hidden hover:shadow-md hover:shadow-stone-200/40 transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-stone-50 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 flex items-center justify-center shadow-sm shadow-emerald-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-stone-800 font-bold text-[15px]">Comunicação</h2>
              <p className="text-stone-400 text-[11px] mt-0.5">Canal principal de atendimento WhatsApp</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <label className="block text-stone-500 text-[10px] font-bold mb-2 uppercase tracking-[0.15em]">
              WhatsApp da Clínica
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              </div>
              <input
                value={form.whatsapp}
                onChange={e => handleChange('whatsapp', e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                placeholder="(85) 99908-6924"
              />
            </div>
            <p className="mt-2 text-stone-400 text-[11px] flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-300"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Número usado no botão de WhatsApp do site e no chatbot.
            </p>
          </div>
        </div>

        {/* ═══ Card: Identidade (Hero Title) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm shadow-stone-200/60 border border-stone-100 overflow-hidden hover:shadow-md hover:shadow-stone-200/40 transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-stone-50 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#b76e79]/10 to-[#d4a0a7]/15 flex items-center justify-center shadow-sm shadow-[#d4a0a7]/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[#b76e79]">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div>
              <h2 className="text-stone-800 font-bold text-[15px]">Identidade</h2>
              <p className="text-stone-400 text-[11px] mt-0.5">Título principal e primeira impressão do site</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <label className="block text-stone-500 text-[10px] font-bold mb-2 uppercase tracking-[0.15em]">
              Título Principal (Hero)
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b76e79]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
              </div>
              <input
                value={form.heroTitle}
                onChange={e => handleChange('heroTitle', e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/50 focus:ring-2 focus:ring-[#b76e79]/10 transition-all"
                placeholder="Mykaele Procópio Home Spa"
              />
            </div>
            <p className="mt-2 text-stone-400 text-[11px] flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-300"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Texto exibido na seção principal da página inicial.
            </p>
          </div>
        </div>

        {/* ═══ Card: História (Sobre Nós) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm shadow-stone-200/60 border border-stone-100 overflow-hidden hover:shadow-md hover:shadow-stone-200/40 transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-stone-50 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center shadow-sm shadow-blue-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-stone-800 font-bold text-[15px]">História</h2>
              <p className="text-stone-400 text-[11px] mt-0.5">Texto &quot;Sobre Nós&quot; visível no site público</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <label className="block text-stone-500 text-[10px] font-bold mb-2 uppercase tracking-[0.15em]">
              Texto Sobre (About)
            </label>
            <textarea
              value={form.aboutText}
              onChange={e => handleChange('aboutText', e.target.value)}
              rows={5}
              className="w-full px-4 py-3 bg-stone-50/70 border border-stone-200 rounded-xl text-stone-800 text-sm leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-y"
              placeholder="Conte a história da clínica, diferenciais, formação..."
            />
            <p className="mt-2 text-stone-400 text-[11px] flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-300"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Aparece na seção &quot;Sobre&quot; do site. Pode conter vários parágrafos.
            </p>
          </div>
        </div>

        {/* ═══ Preview Card — Device Frame ═══ */}
        <div className="bg-white rounded-2xl shadow-sm shadow-stone-200/60 border border-stone-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-50 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
            </div>
            <div className="flex-1 h-6 bg-stone-50 rounded-lg flex items-center justify-center">
              <span className="text-stone-300 text-[9px] tracking-wider font-medium">mykaelespa.com.br</span>
            </div>
          </div>
          <div className="px-6 py-6 bg-gradient-to-b from-stone-50/50 to-white">
            <div className="text-stone-800 text-lg font-bold mb-2">{form.heroTitle || 'Título não definido'}</div>
            <div className="text-stone-500 text-xs leading-relaxed mb-4 whitespace-pre-line max-h-32 overflow-y-auto">{form.aboutText || 'Nenhum texto sobre definido.'}</div>
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg w-fit border border-emerald-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              <span className="text-emerald-700 text-xs font-semibold">{form.whatsapp || '(--) -----‑----'}</span>
            </div>
          </div>
        </div>

        {/* ═══ Save Bar ═══ */}
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="flex items-center gap-3">
            {dirty && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 animate-[fadeIn_0.2s_ease-out]">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-600 text-xs font-medium">Alterações não salvas</span>
              </div>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white shadow-lg shadow-[#b76e79]/20 disabled:opacity-40 disabled:shadow-none hover:shadow-xl hover:shadow-[#b76e79]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : Ico.save}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
