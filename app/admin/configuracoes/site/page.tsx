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
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-100 rounded-lg w-1/3" />
          <div className="h-12 bg-stone-100 rounded-lg" />
          <div className="h-12 bg-stone-100 rounded-lg" />
          <div className="h-32 bg-stone-100 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <a href="/admin/configuracoes"
          className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors text-stone-500">
          {Ico.back}
        </a>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#b76e79]/15 to-[#d4a0a7]/10 flex items-center justify-center text-[#b76e79]">
            {Ico.globe}
          </div>
          <div>
            <h1 className="text-stone-800 text-lg font-semibold tracking-tight">Editar Site</h1>
            <p className="text-stone-400 text-[11px]">Altere textos e informações que aparecem no site público</p>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium border transition-all animate-[fadeIn_0.2s_ease-out] ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-600 border-red-200'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Form */}
      <div className="space-y-6">
        {/* WhatsApp */}
        <div>
          <label className="block text-stone-500 text-xs font-semibold mb-1.5 uppercase tracking-wider">
            WhatsApp da Clínica
          </label>
          <input
            value={form.whatsapp}
            onChange={e => handleChange('whatsapp', e.target.value)}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-2 focus:ring-[#b76e79]/10 transition-all"
            placeholder="(85) 99908-6924"
          />
          <p className="mt-1.5 text-stone-400 text-[11px]">Número usado no botão de WhatsApp do site e no chatbot.</p>
        </div>

        {/* Hero Title */}
        <div>
          <label className="block text-stone-500 text-xs font-semibold mb-1.5 uppercase tracking-wider">
            Título Principal (Hero)
          </label>
          <input
            value={form.heroTitle}
            onChange={e => handleChange('heroTitle', e.target.value)}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm focus:outline-none focus:border-[#b76e79]/40 focus:ring-2 focus:ring-[#b76e79]/10 transition-all"
            placeholder="Mykaele Procópio Home Spa"
          />
          <p className="mt-1.5 text-stone-400 text-[11px]">Texto exibido na seção principal da página inicial.</p>
        </div>

        {/* About Text */}
        <div>
          <label className="block text-stone-500 text-xs font-semibold mb-1.5 uppercase tracking-wider">
            Texto Sobre (About)
          </label>
          <textarea
            value={form.aboutText}
            onChange={e => handleChange('aboutText', e.target.value)}
            rows={5}
            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm leading-relaxed focus:outline-none focus:border-[#b76e79]/40 focus:ring-2 focus:ring-[#b76e79]/10 transition-all resize-y"
            placeholder="Conte a história da clínica, diferenciais, formação..."
          />
          <p className="mt-1.5 text-stone-400 text-[11px]">Aparece na seção &quot;Sobre&quot; do site. Pode conter vários parágrafos.</p>
        </div>

        {/* Preview Card */}
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-100">
          <div className="text-stone-400 text-[10px] font-semibold uppercase tracking-wider mb-3">Pré-visualização</div>
          <div className="text-stone-800 text-base font-semibold mb-1">{form.heroTitle || 'Título não definido'}</div>
          <div className="text-stone-500 text-xs leading-relaxed mb-2 whitespace-pre-line">{form.aboutText || 'Nenhum texto sobre definido.'}</div>
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
            {form.whatsapp || '(--) -----‑----'}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white shadow-lg shadow-[#b76e79]/20 disabled:opacity-50 hover:shadow-xl hover:shadow-[#b76e79]/30 transition-all"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : Ico.save}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          {dirty && <span className="text-amber-500 text-xs">Alterações não salvas</span>}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
