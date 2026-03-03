// src/components/FeedbackModal.tsx
// Modal estilo iFood para avaliação de sessão
'use client'

import { useState, useEffect, useCallback } from 'react'
import StarRatingInput from './StarRatingInput'

interface PendingSession {
  id: string
  scheduledAt: string
  serviceName: string
  duration: number
}

interface FeedbackModalProps {
  session: PendingSession
  onClose: () => void
  onSubmit: (data: { appointmentId: string; score: number; comment: string; categories: string[] }) => Promise<void>
}

const CATEGORIES = [
  { id: 'atendimento', label: '💆 Atendimento', emoji: '💆' },
  { id: 'resultado', label: '✨ Resultado', emoji: '✨' },
  { id: 'conforto', label: '🛋️ Conforto', emoji: '🛋️' },
  { id: 'pontualidade', label: '⏰ Pontualidade', emoji: '⏰' },
  { id: 'ambiente', label: '🌿 Ambiente', emoji: '🌿' },
  { id: 'comunicacao', label: '💬 Comunicação', emoji: '💬' },
]

export default function FeedbackModal({ session, onClose, onSubmit }: FeedbackModalProps) {
  const [step, setStep] = useState<'rating' | 'details' | 'success'>('rating')
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fechar com ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const toggleCategory = useCallback((id: string) => {
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }, [])

  const handleNext = () => {
    if (score === 0) return
    setStep('details')
  }

  const handleSubmit = async () => {
    if (score === 0) return
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        appointmentId: session.id,
        score: score * 2, // Convert 1-5 stars to 1-10 scale
        comment,
        categories,
      })
      setStep('success')
    } catch (err) {
      setError('Erro ao enviar avaliação. Tente novamente.')
    }
    setLoading(false)
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-auto bg-[#111] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden animate-[slideUp_0.4s_ease-out]">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          {/* Handle bar (mobile) */}
          <div className="sm:hidden w-10 h-1 bg-white/10 rounded-full mx-auto mb-4" />

          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === 'rating' && (
          <div className="px-6 pb-8">
            {/* Service info */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#b76e79]/20 to-[#d4a0a7]/10 flex items-center justify-center">
                <span className="text-3xl">✨</span>
              </div>
              <h3 className="text-white text-lg font-medium">Como foi sua sessão?</h3>
              <p className="text-white/40 text-sm mt-1">{session.serviceName}</p>
              <p className="text-white/20 text-xs mt-0.5">{fmtDate(session.scheduledAt)}</p>
            </div>

            {/* Star Rating */}
            <div className="flex justify-center mb-8">
              <StarRatingInput value={score} onChange={setScore} size="lg" showLabel />
            </div>

            {/* CTA */}
            <button
              onClick={handleNext}
              disabled={score === 0}
              className={`w-full py-4 rounded-2xl text-sm font-bold tracking-wide transition-all duration-300 ${
                score > 0
                  ? 'bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white shadow-lg shadow-[#b76e79]/25 hover:shadow-[#b76e79]/40 active:scale-[0.98]'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              Continuar
            </button>

            <button onClick={onClose} className="w-full py-3 text-white/30 text-xs mt-2 hover:text-white/50 transition-colors">
              Avaliar depois
            </button>
          </div>
        )}

        {step === 'details' && (
          <div className="px-6 pb-8">
            {/* Back button */}
            <button onClick={() => setStep('rating')} className="flex items-center gap-1.5 text-white/40 text-xs mb-6 hover:text-white/60 transition-colors">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Voltar
            </button>

            {/* Stars summary */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <svg key={i} className={`w-5 h-5 ${i <= score ? 'text-[#b76e79]' : 'text-white/10'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <span className="text-white/60 text-sm font-medium">{score}.0</span>
            </div>

            {/* Categories - O que você mais gostou? */}
            <div className="mb-6">
              <p className="text-white/60 text-xs font-medium mb-3">O que você mais gostou?</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                      categories.includes(cat.id)
                        ? 'bg-[#b76e79]/20 text-[#d4a0a7] border border-[#b76e79]/30 shadow-sm shadow-[#b76e79]/10'
                        : 'bg-white/5 text-white/30 border border-white/5 hover:bg-white/8 hover:text-white/50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="mb-6">
              <p className="text-white/60 text-xs font-medium mb-3">Conte mais sobre sua experiência (opcional)</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="O que achou do atendimento, resultados, ambiente..."
                rows={3}
                maxLength={500}
                className="w-full bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-[#b76e79]/30 transition-all"
              />
              <div className="text-right text-white/10 text-[9px] mt-1">{comment.length}/500</div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white shadow-lg shadow-[#b76e79]/25 hover:shadow-[#b76e79]/40 active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </div>
              ) : (
                'Enviar Avaliação'
              )}
            </button>

            {/* Points hint */}
            <p className="text-center text-[#d4a0a7]/40 text-[10px] mt-3">
              ⭐ Ganhe 30 pontos de fidelidade por avaliar!
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="px-6 pb-8 text-center">
            {/* Success animation */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center animate-[bounceIn_0.5s_ease-out]">
              <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-white text-lg font-medium mb-2">Obrigada! 💕</h3>
            <p className="text-white/40 text-sm mb-2">Sua avaliação é muito importante para nós.</p>
            <p className="text-[#d4a0a7]/60 text-xs mb-8">
              +30 pontos adicionados ao seu programa de fidelidade!
            </p>

            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl text-sm font-bold bg-white/5 text-white/70 hover:bg-white/8 transition-all"
            >
              Fechar
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
