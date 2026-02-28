// src/components/patient/SessionFeedbackModal.tsx
'use client'
import { useState } from 'react'

interface Props {
  appointmentId: string
  serviceName: string
  userId: string
  onClose: () => void
  onSubmitted: () => void
}

const CATEGORIES = [
  { id: 'atendimento', label: 'Atendimento', icon: '💆' },
  { id: 'resultado', label: 'Resultado', icon: '✨' },
  { id: 'conforto', label: 'Conforto', icon: '🛋️' },
  { id: 'pontualidade', label: 'Pontualidade', icon: '⏰' },
  { id: 'ambiente', label: 'Ambiente', icon: '🌿' },
  { id: 'custo-beneficio', label: 'Custo-benefício', icon: '💎' },
]

export default function SessionFeedbackModal({ appointmentId, serviceName, userId, onClose, onSubmitted }: Props) {
  const [score, setScore] = useState(0)
  const [hoverScore, setHoverScore] = useState(0)
  const [comment, setComment] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const toggleCat = (id: string) => {
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const submit = async () => {
    if (score === 0) { setError('Selecione uma nota'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          appointmentId,
          score: score * 2, // 1-5 stars → 2-10 score
          comment: comment.trim() || null,
          categories: categories.length > 0 ? categories : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubmitted(true)
      setTimeout(() => { onSubmitted(); onClose() }, 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl p-10 max-w-md text-center" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-4">💖</div>
          <h3 className="text-xl font-semibold text-[#2d2d2d] mb-2">Obrigada pela avaliação!</h3>
          <p className="text-sm text-[#6a6560]">Sua opinião é muito valiosa para nós.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#f0ece8]">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-[#2d2d2d]">Como foi sua experiência?</h3>
              <p className="text-sm text-[#b76e79] mt-1">{serviceName}</p>
            </div>
            <button onClick={onClose} className="text-[#999] hover:text-[#333] text-xl">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stars */}
          <div className="text-center">
            <p className="text-sm text-[#6a6560] mb-3">Toque para avaliar</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  onMouseEnter={() => setHoverScore(i)}
                  onMouseLeave={() => setHoverScore(0)}
                  onClick={() => setScore(i)}
                  className="transition-transform hover:scale-125"
                >
                  <svg className={`w-10 h-10 ${i <= (hoverScore || score) ? 'text-[#b76e79]' : 'text-[#e8dfd6]'} transition-colors`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            {score > 0 && (
              <p className="text-xs text-[#b76e79] mt-2 font-medium">
                {score === 1 ? 'Ruim' : score === 2 ? 'Regular' : score === 3 ? 'Bom' : score === 4 ? 'Ótimo' : 'Excelente!'}
              </p>
            )}
          </div>

          {/* Categories */}
          <div>
            <p className="text-sm text-[#6a6560] mb-3">O que mais gostou? <span className="text-[#999]">(opcional)</span></p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => toggleCat(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    categories.includes(cat.id)
                      ? 'bg-[#b76e79] text-white'
                      : 'bg-[#f5f0eb] text-[#6a6560] hover:bg-[#e8dfd6]'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <p className="text-sm text-[#6a6560] mb-2">Conte mais sobre sua experiência <span className="text-[#999]">(opcional)</span></p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="O que mais te marcou? Compartilhe com outras clientes..."
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-[#e8dfd6] px-4 py-3 text-sm text-[#2d2d2d] placeholder:text-[#ccc] focus:outline-none focus:ring-2 focus:ring-[#b76e79]/30 resize-none"
            />
            <p className="text-[10px] text-[#999] text-right mt-1">{comment.length}/500</p>
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          {/* Submit */}
          <button
            onClick={submit}
            disabled={loading || score === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#b76e79] to-[#c4868f] text-white font-medium text-sm disabled:opacity-50 hover:shadow-lg transition-all"
          >
            {loading ? 'Enviando...' : 'Enviar Avaliação'}
          </button>

          <p className="text-[10px] text-[#999] text-center">
            Sua avaliação pode ser exibida publicamente de forma anônima (apenas iniciais do nome).
          </p>
        </div>
      </div>
    </div>
  )
}
