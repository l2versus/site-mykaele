'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface ProposalItem {
  id: string
  name: string
  description: string | null
  quantity: number
  unitPrice: number
}

interface ProposalData {
  title: string
  description: string | null
  items: ProposalItem[]
  discount: number
  discountType: string
  totalValue: number
  validUntil: string | null
  status: string
  leadName: string
  createdAt: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: '#8B8A94' },
  SENT: { label: 'Enviada', color: '#4A7BFF' },
  VIEWED: { label: 'Visualizada', color: '#F0A500' },
  ACCEPTED: { label: 'Aceita', color: '#2ECC8A' },
  REJECTED: { label: 'Recusada', color: '#FF6B4A' },
  EXPIRED: { label: 'Expirada', color: '#8B8A94' },
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PublicProposalPage() {
  const params = useParams()
  const token = params?.token as string
  const [proposal, setProposal] = useState<ProposalData | null>(null)
  const [clinicName, setClinicName] = useState('Clínica')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [responded, setResponded] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/public/proposals/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setProposal(data.proposal)
          setClinicName(data.clinicName || 'Clínica')
        }
      })
      .catch(() => setError('Erro ao carregar proposta'))
      .finally(() => setLoading(false))
  }, [token])

  const handleRespond = async (action: 'accept' | 'reject') => {
    if (!token) return
    setResponding(true)
    try {
      const res = await fetch(`/api/public/proposals/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        setResponded(true)
        setProposal(prev => prev ? { ...prev, status: data.status } : prev)
      } else {
        alert(data.error || 'Erro ao responder')
      }
    } catch {
      alert('Erro ao enviar resposta')
    } finally {
      setResponding(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-serif text-[#1a1a1a] mb-2">Proposta não encontrada</h1>
          <p className="text-sm text-[#666]">{error || 'O link pode ter expirado ou sido removido.'}</p>
        </div>
      </div>
    )
  }

  const subtotal = proposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const statusInfo = STATUS_MAP[proposal.status] || STATUS_MAP.DRAFT
  const canRespond = ['SENT', 'VIEWED'].includes(proposal.status) && !responded
  const isExpired = proposal.validUntil && new Date(proposal.validUntil) < new Date()

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <header className="bg-white border-b border-[#eee] px-4 py-5 text-center">
        <p className="text-xs text-[#D4AF37] font-medium tracking-widest uppercase mb-1">{clinicName}</p>
        <h1 className="text-xl font-serif text-[#1a1a1a]">Proposta Comercial</h1>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}
          >
            {statusInfo.label}
          </span>
          <span className="text-xs text-[#999]">{formatDate(proposal.createdAt)}</span>
        </div>

        {/* Title & description */}
        <div className="bg-white rounded-2xl border border-[#eee] p-5 shadow-sm">
          <p className="text-xs text-[#999] mb-1">Para: {proposal.leadName}</p>
          <h2 className="text-lg font-serif text-[#1a1a1a] mb-2">{proposal.title}</h2>
          {proposal.description && (
            <p className="text-sm text-[#666] leading-relaxed">{proposal.description}</p>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-[#eee] overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-[#eee]">
            <h3 className="text-xs font-semibold text-[#999] uppercase tracking-wider">Serviços</h3>
          </div>
          {proposal.items.map((item, i) => (
            <div key={item.id} className={`px-5 py-4 ${i < proposal.items.length - 1 ? 'border-b border-[#f5f5f5]' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1a1a1a]">{item.name}</p>
                  {item.description && <p className="text-xs text-[#999] mt-0.5">{item.description}</p>}
                  {item.quantity > 1 && (
                    <p className="text-xs text-[#999] mt-0.5">{item.quantity}x {formatCurrency(item.unitPrice)}</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-[#1a1a1a] shrink-0">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl border border-[#eee] p-5 shadow-sm space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#999]">Subtotal</span>
            <span className="text-[#1a1a1a]">{formatCurrency(subtotal)}</span>
          </div>
          {proposal.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#2ECC8A]">
                Desconto {proposal.discountType === 'percent' ? `(${proposal.discount}%)` : ''}
              </span>
              <span className="text-[#2ECC8A]">
                -{formatCurrency(subtotal - proposal.totalValue)}
              </span>
            </div>
          )}
          <div className="border-t border-[#eee] pt-3 flex justify-between">
            <span className="text-base font-semibold text-[#1a1a1a]">Total</span>
            <span className="text-xl font-bold text-[#D4AF37]">{formatCurrency(proposal.totalValue)}</span>
          </div>
          {proposal.validUntil && (
            <p className="text-xs text-center" style={{ color: isExpired ? '#FF6B4A' : '#999' }}>
              {isExpired ? 'Esta proposta expirou em ' : 'Válida até '}
              {formatDate(proposal.validUntil)}
            </p>
          )}
        </div>

        {/* Actions */}
        {canRespond && !isExpired && (
          <div className="space-y-3">
            <button
              onClick={() => handleRespond('accept')}
              disabled={responding}
              className="w-full py-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-lg"
              style={{ background: '#2ECC8A', color: 'white' }}
            >
              {responding ? 'Enviando...' : 'Aceitar Proposta'}
            </button>
            <button
              onClick={() => handleRespond('reject')}
              disabled={responding}
              className="w-full py-3 rounded-xl text-sm transition-all disabled:opacity-50"
              style={{ color: '#FF6B4A', border: '1px solid #FF6B4A30' }}
            >
              Recusar
            </button>
          </div>
        )}

        {/* Responded message */}
        {(proposal.status === 'ACCEPTED' || responded) && proposal.status === 'ACCEPTED' && (
          <div className="bg-[#2ECC8A10] border border-[#2ECC8A30] rounded-xl p-5 text-center">
            <p className="text-sm font-medium text-[#2ECC8A]">Proposta aceita!</p>
            <p className="text-xs text-[#666] mt-1">Entraremos em contato para os próximos passos.</p>
          </div>
        )}

        {proposal.status === 'REJECTED' && (
          <div className="bg-[#FF6B4A10] border border-[#FF6B4A30] rounded-xl p-5 text-center">
            <p className="text-sm font-medium text-[#FF6B4A]">Proposta recusada</p>
            <p className="text-xs text-[#666] mt-1">Agradecemos por considerar.</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-[#ccc] pt-4">{clinicName}</p>
      </div>
    </div>
  )
}
