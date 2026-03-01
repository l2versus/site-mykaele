'use client'

import { useClient } from '../ClientContext'
import { useState, useEffect, useCallback } from 'react'

// ═══ Types ═══
interface LoyaltyOverview {
  loyalty: {
    points: number
    totalEarned: number
    totalSpent: number
    tier: string
    nextTier: string | null
    nextTierThreshold: number | null
    progressToNext: number
  }
  referralCode: string
  referralCount: number
  confirmedReferrals: number
}

interface Transaction {
  id: string
  points: number
  type: string
  description: string
  createdAt: string
}

interface RankingEntry {
  position: number
  displayName: string
  avatar: string | null
  tier: string
  totalEarned: number
  isCurrentUser: boolean
}

interface Reward {
  id: string
  name: string
  description: string
  pointsCost: number
  type: string
  value: number
  active: boolean
  stock: number | null
  imageEmoji: string
}

interface ReferralEntry {
  id: string
  referredName: string
  status: string
  createdAt: string
  rewardedAt: string | null
}

interface DiscountInfo {
  discount: number
  label: string
  nextTier: { discount: number; label: string; min: number } | null
  remaining: number
}
interface DiscountTier { min: number; max: number; discount: number; label: string }
interface ReferralRankEntry {
  position: number; displayName: string; referralCount: number; isCurrentUser: boolean
}
interface ReferralData {
  code: string; usageCount: number; referrals: ReferralEntry[]
  confirmedCount: number; discount: DiscountInfo; discountTiers: DiscountTier[]
  maxDiscount: number; ranking: ReferralRankEntry[]; myPosition: number | null; promoLink: string
}

// ═══ Constants ═══
const TIER_CONFIG = {
  BRONZE: {
    name: 'Bronze',
    color: 'from-amber-700 to-amber-900',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: '🥉',
    emoji: '✨',
    benefits: ['Acúmulo de pontos básico', 'Acesso ao programa de indicação'],
  },
  SILVER: {
    name: 'Prata',
    color: 'from-gray-400 to-gray-600',
    textColor: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: '🥈',
    emoji: '💫',
    benefits: ['Pontos 1.5x em sessões', 'Acesso antecipado a novidades', 'Prioridade no agendamento'],
  },
  GOLD: {
    name: 'Ouro',
    color: 'from-yellow-500 to-amber-600',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: '🥇',
    emoji: '👑',
    benefits: ['Pontos 2x em sessões', 'Recompensas exclusivas', 'Sessão de bônus no aniversário', 'Atendimento VIP'],
  },
  DIAMOND: {
    name: 'Diamante',
    color: 'from-cyan-400 via-blue-500 to-purple-600',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '💎',
    emoji: '🌟',
    benefits: ['Pontos 3x em sessões', 'Todas as recompensas disponíveis', 'Convites para eventos exclusivos', 'Protocolo personalizado', 'Concierge dedicado'],
  },
}

const TYPE_LABELS: Record<string, string> = {
  REFERRAL_BONUS: '🤝 Indicação',
  REFERRED_BONUS: '🎁 Boas-vindas',
  SESSION_COMPLETE: '💆 Sessão',
  REVIEW_BONUS: '⭐ Avaliação',
  BIRTHDAY_BONUS: '🎂 Aniversário',
  TIER_BONUS: '🏆 Promoção de Tier',
  REDEMPTION: '🎯 Resgate',
  ADMIN_ADJUSTMENT: '⚙️ Ajuste',
  FIRST_SESSION_BONUS: '🌟 Primeira Sessão',
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function FidelidadePage() {
  const { user, fetchWithAuth } = useClient()
  const [tab, setTab] = useState<'overview' | 'ranking' | 'rewards' | 'referral'>('overview')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<LoyaltyOverview | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [myRank, setMyRank] = useState<RankingEntry | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [referralInput, setReferralInput] = useState('')
  const [applyingCode, setApplyingCode] = useState(false)
  const [customCodeInput, setCustomCodeInput] = useState('')
  const [savingCustomCode, setSavingCustomCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [calcReferrals, setCalcReferrals] = useState(0)
  const [calcSessionValue, setCalcSessionValue] = useState(250)

  // Discount calculator — maps referral count → discount %
  const getCalcDiscount = (refs: number) => {
    if (refs >= 20) return { discount: 15, label: 'VIP Embaixadora' }
    if (refs >= 10) return { discount: 12, label: 'Embaixadora' }
    if (refs >= 6) return { discount: 8, label: 'Influenciadora' }
    if (refs >= 3) return { discount: 5, label: 'Conectada' }
    if (refs >= 1) return { discount: 3, label: 'Iniciante' }
    return { discount: 0, label: '—' }
  }

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/patient/loyalty?section=overview')
      if (res.ok) {
        const data = await res.json()
        setOverview(data)
      }
    } catch {}
  }, [fetchWithAuth])

  const loadTransactions = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/patient/loyalty?section=history')
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
      }
    } catch {}
  }, [fetchWithAuth])

  const loadRanking = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/patient/loyalty?section=ranking')
      if (res.ok) {
        const data = await res.json()
        setRanking(data.ranking || [])
        setMyRank(data.myRank || null)
      }
    } catch {}
  }, [fetchWithAuth])

  const loadRewards = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/patient/loyalty?section=rewards')
      if (res.ok) {
        const data = await res.json()
        setRewards(data.rewards || [])
      }
    } catch {}
  }, [fetchWithAuth])

  const loadReferral = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/patient/referral')
      if (res.ok) {
        const data = await res.json()
        setReferralData(data)
      }
    } catch {}
  }, [fetchWithAuth])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadOverview(), loadTransactions(), loadRanking(), loadRewards(), loadReferral()])
      setLoading(false)
    }
    load()
  }, [loadOverview, loadTransactions, loadRanking, loadRewards, loadReferral])

  const copyCode = async () => {
    if (!referralData?.code) return
    try {
      await navigator.clipboard.writeText(referralData.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  const shareCode = async () => {
    if (!referralData?.code) return
    const link = referralData.promoLink || `https://mykaprocopio.com.br/ref/${referralData.code}`
    const text = `💎 Venha experimentar o melhor da estética com a Mykaele Procópio!\n\nUse meu link exclusivo:\n${link}\n\nGanhe pontos de boas-vindas no programa de fidelidade! ✨`
    if (navigator.share) {
      try { await navigator.share({ title: 'Mykaele Procópio - Indicação VIP', text }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(text) } catch {}
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const copyLink = async () => {
    if (!referralData) return
    const link = referralData.promoLink || `https://mykaprocopio.com.br/ref/${referralData.code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {}
  }

  const saveCustomCode = async () => {
    if (!customCodeInput.trim() || customCodeInput.length < 3) return
    setSavingCustomCode(true)
    setMessage(null)
    try {
      const res = await fetchWithAuth('/api/patient/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'customize_code', newCode: customCodeInput.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ text: 'Código personalizado salvo!', type: 'success' })
        setCustomCodeInput('')
        await loadReferral()
      } else {
        setMessage({ text: data.error || 'Erro ao salvar código', type: 'error' })
      }
    } catch {
      setMessage({ text: 'Erro de conexão', type: 'error' })
    }
    setSavingCustomCode(false)
  }

  const applyReferralCode = async () => {
    if (!referralInput.trim()) return
    setApplyingCode(true)
    setMessage(null)
    try {
      const res = await fetchWithAuth('/api/patient/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_code', referralCode: referralInput.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ text: data.message, type: 'success' })
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
        setReferralInput('')
        await Promise.all([loadOverview(), loadTransactions()])
      } else {
        setMessage({ text: data.error || 'Erro ao aplicar código', type: 'error' })
      }
    } catch {
      setMessage({ text: 'Erro de conexão', type: 'error' })
    }
    setApplyingCode(false)
  }

  const redeemReward = async (rewardId: string) => {
    setRedeemingId(rewardId)
    setMessage(null)
    try {
      const res = await fetchWithAuth('/api/patient/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', rewardId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ text: data.message, type: 'success' })
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
        await Promise.all([loadOverview(), loadTransactions(), loadRewards()])
      } else {
        setMessage({ text: data.error || 'Erro ao resgatar', type: 'error' })
      }
    } catch {
      setMessage({ text: 'Erro de conexão', type: 'error' })
    }
    setRedeemingId(null)
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-48 bg-cream-dark/50 rounded-2xl" />
        <div className="h-32 bg-cream-dark/50 rounded-xl" />
        <div className="h-32 bg-cream-dark/50 rounded-xl" />
        <div className="h-64 bg-cream-dark/50 rounded-xl" />
      </div>
    )
  }

  const tier = overview?.loyalty?.tier || 'BRONZE'
  const tierInfo = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.BRONZE

  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
      {/* ═══ Confetti ═══ */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
                fontSize: `${12 + Math.random() * 16}px`,
              }}
            >
              {['✨', '💎', '🌟', '👑', '🎉', '💫'][Math.floor(Math.random() * 6)]}
            </div>
          ))}
        </div>
      )}

      {/* ═══ Hero Card — Tier & Points ═══ */}
      <div className={`mx-4 mt-4 rounded-2xl bg-gradient-to-br ${tierInfo.color} p-6 text-white shadow-xl relative overflow-hidden`}>
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white/70 text-xs font-medium tracking-wider uppercase">Programa de Fidelidade</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/15 rounded-full">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[8px] font-medium tracking-wider uppercase text-white/70">Verificado</span>
                </span>
              </div>
              <h1 className="text-2xl font-bold mt-1">{user?.name?.split(' ')[0] || 'Cliente'}</h1>
            </div>
            <div className="text-4xl">{tierInfo.icon}</div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/60 text-xs">Seus pontos</p>
              <p className="text-3xl font-bold tabular-nums">{(overview?.loyalty?.points || 0).toLocaleString('pt-BR')}</p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-sm font-semibold">{tierInfo.emoji} Tier {tierInfo.name}</p>
              <p className="text-white/50 text-xs">{(overview?.loyalty?.totalEarned || 0).toLocaleString('pt-BR')} pts acumulados</p>
            </div>
          </div>

          {/* Progress bar to next tier */}
          {overview?.loyalty?.nextTier && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>Próximo: {TIER_CONFIG[overview.loyalty.nextTier as keyof typeof TIER_CONFIG]?.name || overview.loyalty.nextTier}</span>
                <span>{overview.loyalty.progressToNext}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/80 rounded-full transition-all duration-1000"
                  style={{ width: `${overview.loyalty.progressToNext}%` }}
                />
              </div>
              <p className="text-white/40 text-[10px] mt-1">
                Faltam {((overview.loyalty.nextTierThreshold || 0) - (overview.loyalty.totalEarned || 0)).toLocaleString('pt-BR')} pts
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Quick Stats ═══ */}
      <div className="grid grid-cols-3 gap-3 mx-4 mt-4">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-cream-dark/30">
          <p className="text-xl font-bold text-rose-gold">{overview?.referralCount || 0}</p>
          <p className="text-[10px] text-warm-gray">Indicações</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-cream-dark/30">
          <p className="text-xl font-bold text-rose-gold">{overview?.confirmedReferrals || 0}</p>
          <p className="text-[10px] text-warm-gray">Confirmadas</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-cream-dark/30">
          <p className="text-xl font-bold text-rose-gold">{overview?.loyalty?.totalSpent || 0}</p>
          <p className="text-[10px] text-warm-gray">Pts Resgatados</p>
        </div>
      </div>

      {/* ═══ Message ═══ */}
      {message && (
        <div className={`mx-4 mt-4 p-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* ═══ Tab Navigation ═══ */}
      <div className="flex mx-4 mt-4 bg-cream rounded-xl p-1 gap-1">
        {[
          { key: 'overview' as const, label: 'Resumo', icon: '📊' },
          { key: 'ranking' as const, label: 'Ranking', icon: '🏆' },
          { key: 'rewards' as const, label: 'Resgatar', icon: '🎁' },
          { key: 'referral' as const, label: 'Indicar', icon: '🤝' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-rose-gold shadow-sm'
                : 'text-warm-gray hover:text-charcoal'
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Resumo ═══ */}
      {tab === 'overview' && (
        <div className="mx-4 mt-4 space-y-4">
          {/* Tier Benefits */}
          <div className={`${tierInfo.bgColor} border ${tierInfo.borderColor} rounded-xl p-4`}>
            <h3 className={`text-sm font-bold ${tierInfo.textColor} mb-2`}>{tierInfo.icon} Benefícios Tier {tierInfo.name}</h3>
            <ul className="space-y-1">
              {tierInfo.benefits.map((b, i) => (
                <li key={i} className="text-xs text-charcoal/70 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-gold/50 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* ═══ Como Acumular Pontos — Apple minimal ═══ */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-dark/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-rose-gold/10 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-rose-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-charcoal tracking-tight">Como acumular pontos</h3>
                <p className="text-[10px] text-warm-gray">Troque por recompensas exclusivas</p>
              </div>
            </div>
            <div className="space-y-0.5">
              {[
                { action: 'Indique uma amiga', points: '+200', icon: '🤝' },
                { action: 'Amiga indicada se cadastra', points: '+100', icon: '🎁' },
                { action: 'Complete uma sessão', points: '+50', icon: '💆' },
                { action: 'Faça uma avaliação', points: '+30', icon: '⭐' },
                { action: 'Aniversário', points: '+150', icon: '🎂' },
                { action: 'Suba de tier', points: '+50', icon: '🏆' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-cream-dark/10 last:border-0">
                  <span className="text-xs text-charcoal/70 flex items-center gap-2">
                    <span className="text-sm">{item.icon}</span>
                    {item.action}
                  </span>
                  <span className="text-xs font-semibold text-rose-gold tabular-nums">{item.points} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ Simulador de Desconto por Indicação — Apple style ═══ */}
          <div className="bg-white rounded-2xl shadow-sm border border-cream-dark/20 overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-0">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-full bg-rose-gold/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-rose-gold">%</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-charcoal tracking-tight">Simulador de Desconto</h3>
                  <p className="text-[10px] text-warm-gray tracking-wide">Privilégio exclusivo por indicações</p>
                </div>
              </div>
            </div>

            {/* Big Number Display */}
            <div className="text-center py-8 mx-5 mt-3 border-y border-cream-dark/10 bg-gradient-to-b from-cream/30 to-transparent rounded-xl">
              <p className="text-[9px] font-medium tracking-[0.35em] uppercase text-warm-gray/50 mb-3">Seu desconto exclusivo</p>
              <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-7xl font-extralight text-charcoal tabular-nums tracking-tighter leading-none">
                  {getCalcDiscount(calcReferrals).discount}
                </span>
                <span className="text-3xl font-extralight text-rose-gold">%</span>
              </div>
              <p className="text-[11px] text-rose-gold font-medium mt-2 tracking-wide">{getCalcDiscount(calcReferrals).label}</p>
              {calcReferrals > 0 && (
                <p className="text-[11px] text-warm-gray/70 mt-1.5">
                  Economia de{' '}
                  <span className="font-semibold text-charcoal">
                    {fmtCur(calcSessionValue * getCalcDiscount(calcReferrals).discount / 100)}
                  </span>
                  {' '}por sessão de {fmtCur(calcSessionValue)}
                </p>
              )}
            </div>

            {/* Slider — Referrals */}
            <div className="px-5 pt-5">
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-[10px] font-medium tracking-[0.15em] uppercase text-warm-gray">Indicações confirmadas</label>
                <span className="text-sm font-semibold text-charcoal tabular-nums">{calcReferrals}</span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                value={calcReferrals}
                onChange={e => setCalcReferrals(Number(e.target.value))}
                className="w-full h-1 bg-cream-dark/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-gold [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-rose-gold/25 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
              />
              <div className="flex justify-between text-[9px] text-warm-gray/40 mt-1">
                <span>0</span>
                <span>25+</span>
              </div>
            </div>

            {/* Session Value Input */}
            <div className="px-5 mt-4">
              <label className="text-[10px] font-medium tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Valor da sessão</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-warm-gray">R$</span>
                <input
                  type="number"
                  min={50}
                  max={2000}
                  step={10}
                  value={calcSessionValue}
                  onChange={e => setCalcSessionValue(Math.max(50, Math.min(2000, Number(e.target.value))))}
                  className="w-full pl-9 pr-3 py-2.5 border border-cream-dark/20 rounded-xl text-sm text-charcoal bg-cream/20 focus:outline-none focus:ring-2 focus:ring-rose-gold/15 focus:border-rose-gold/30 tabular-nums"
                />
              </div>
            </div>

            {/* Tiers Strip — minimalist */}
            <div className="px-5 pt-5 pb-5 mt-4 border-t border-cream-dark/10">
              <div className="grid grid-cols-5 gap-0.5">
                {[
                  { refs: '1-2', pct: 3 },
                  { refs: '3-5', pct: 5 },
                  { refs: '6-9', pct: 8 },
                  { refs: '10-19', pct: 12 },
                  { refs: '20+', pct: 15 },
                ].map((t, i) => {
                  const isActive = getCalcDiscount(calcReferrals).discount === t.pct
                  return (
                    <div key={i} className={`text-center py-2.5 rounded-lg transition-all duration-300 ${isActive ? 'bg-rose-gold/10 scale-105' : ''}`}>
                      <p className={`text-sm font-semibold transition-colors ${isActive ? 'text-rose-gold' : 'text-charcoal/30'}`}>{t.pct}%</p>
                      <p className={`text-[8px] mt-0.5 transition-colors ${isActive ? 'text-rose-gold/60' : 'text-warm-gray/40'}`}>{t.refs} ind.</p>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-3">
                <span className="text-[9px] text-warm-gray/40 flex items-center gap-1">
                  <span className="w-3 h-[1px] bg-rose-gold/30" />
                  Piso: 3%
                </span>
                <span className="text-[9px] text-warm-gray/40 flex items-center gap-1">
                  Teto: 15%
                  <span className="w-3 h-[1px] bg-rose-gold/30" />
                </span>
              </div>
              <p className="text-[9px] text-warm-gray/40 text-center mt-2">Desconto aplicável em todas as sessões avulsas</p>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-cream-dark/30">
            <h3 className="text-sm font-bold text-charcoal mb-3">📋 Histórico Recente</h3>
            {transactions.length === 0 ? (
              <p className="text-xs text-warm-gray text-center py-4">Nenhuma transação ainda. Comece indicando amigas!</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-charcoal truncate">{tx.description}</p>
                      <p className="text-[10px] text-warm-gray">{fmtDate(tx.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-bold ml-2 ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Ranking ═══ */}
      {tab === 'ranking' && (
        <div className="mx-4 mt-4 space-y-3">
          <div className="bg-gradient-to-r from-rose-gold/10 to-transparent rounded-xl p-4 border border-rose-gold/20">
            <h3 className="text-sm font-bold text-charcoal">🏆 Ranking de Fidelidade</h3>
            <p className="text-[10px] text-warm-gray mt-0.5">As clientes mais exclusivas da Mykaele Procópio</p>
          </div>

          {ranking.length === 0 ? (
            <p className="text-xs text-warm-gray text-center py-8">Ranking em construção...</p>
          ) : (
            <div className="space-y-2">
              {ranking.map(entry => {
                const entryTier = TIER_CONFIG[entry.tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.BRONZE
                const isTop3 = entry.position <= 3
                const positionEmojis = ['', '🥇', '🥈', '🥉']

                return (
                  <div
                    key={entry.position}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      entry.isCurrentUser
                        ? 'bg-rose-gold/10 border-2 border-rose-gold/30 shadow-md'
                        : isTop3
                        ? 'bg-white border border-cream-dark/40 shadow-sm'
                        : 'bg-white/70 border border-cream-dark/20'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isTop3 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-white' : 'bg-cream text-warm-gray'
                    }`}>
                      {isTop3 ? positionEmojis[entry.position] : entry.position}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${entry.isCurrentUser ? 'text-rose-gold font-bold' : 'text-charcoal'}`}>
                        {entry.isCurrentUser ? '⭐ Você' : entry.displayName}
                      </p>
                      <p className={`text-[10px] ${entryTier.textColor}`}>
                        {entryTier.icon} {entryTier.name}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-charcoal">{entry.totalEarned.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-warm-gray">pontos</p>
                    </div>
                  </div>
                )
              })}

              {myRank && !ranking.find(r => r.isCurrentUser) && (
                <>
                  <div className="text-center py-1">
                    <span className="text-warm-gray text-xs">• • •</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-gold/10 border-2 border-rose-gold/30 shadow-md">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-cream text-warm-gray">
                      {myRank.position}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-rose-gold">⭐ Você</p>
                      <p className="text-[10px] text-warm-gray">{TIER_CONFIG[myRank.tier as keyof typeof TIER_CONFIG]?.icon} {TIER_CONFIG[myRank.tier as keyof typeof TIER_CONFIG]?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-charcoal">{myRank.totalEarned.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-warm-gray">pontos</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Resgatar ═══ */}
      {tab === 'rewards' && (
        <div className="mx-4 mt-4 space-y-3">
          <div className="bg-gradient-to-r from-rose-gold/10 to-transparent rounded-xl p-4 border border-rose-gold/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-charcoal">🎁 Recompensas Exclusivas</h3>
                <p className="text-[10px] text-warm-gray mt-0.5">Troque seus pontos por benefícios incríveis</p>
              </div>
              <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
                <p className="text-xs text-warm-gray">Saldo</p>
                <p className="text-sm font-bold text-rose-gold">{(overview?.loyalty?.points || 0).toLocaleString('pt-BR')} pts</p>
              </div>
            </div>
          </div>

          {rewards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎁</p>
              <p className="text-sm text-warm-gray">Novas recompensas em breve!</p>
              <p className="text-xs text-warm-gray/70 mt-1">Continue acumulando pontos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rewards.map(reward => {
                const canAfford = (overview?.loyalty?.points || 0) >= reward.pointsCost
                const outOfStock = reward.stock !== null && reward.stock <= 0

                return (
                  <div
                    key={reward.id}
                    className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${
                      canAfford && !outOfStock
                        ? 'border-rose-gold/30 hover:shadow-md'
                        : 'border-cream-dark/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl shrink-0">{reward.imageEmoji || '🎁'}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-charcoal">{reward.name}</h4>
                        {reward.description && (
                          <p className="text-[11px] text-warm-gray mt-0.5">{reward.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-bold text-rose-gold">{reward.pointsCost.toLocaleString('pt-BR')} pts</span>
                          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            Valor: {fmtCur(reward.value)}
                          </span>
                          {reward.stock !== null && (
                            <span className="text-[10px] text-warm-gray">
                              {outOfStock ? 'Esgotado' : `${reward.stock} restantes`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => redeemReward(reward.id)}
                      disabled={!canAfford || outOfStock || redeemingId === reward.id}
                      className={`mt-3 w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                        canAfford && !outOfStock
                          ? 'bg-rose-gold text-white hover:bg-rose-gold-dark active:scale-[0.98]'
                          : 'bg-cream text-warm-gray cursor-not-allowed'
                      }`}
                    >
                      {redeemingId === reward.id
                        ? 'Resgatando...'
                        : outOfStock
                        ? 'Esgotado'
                        : canAfford
                        ? '✨ Resgatar Agora'
                        : `Faltam ${(reward.pointsCost - (overview?.loyalty?.points || 0)).toLocaleString('pt-BR')} pts`}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Indicar ═══ */}
      {tab === 'referral' && (
        <div className="mx-4 mt-4 space-y-4">

          {/* ═══ Discount Card ═══ */}
          <div className={`rounded-2xl p-5 text-white shadow-xl relative overflow-hidden ${
            (referralData?.discount?.discount || 0) >= 12 ? 'bg-gradient-to-br from-purple-600 to-indigo-700' :
            (referralData?.discount?.discount || 0) >= 8 ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
            (referralData?.discount?.discount || 0) >= 5 ? 'bg-gradient-to-br from-teal-500 to-emerald-600' :
            (referralData?.discount?.discount || 0) >= 3 ? 'bg-gradient-to-br from-blue-500 to-cyan-600' :
            'bg-gradient-to-br from-gray-500 to-gray-700'
          }`}>
            <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-white/70 text-[10px] font-medium tracking-wider uppercase">Seu desconto por indicações</p>
              <div className="flex items-end gap-3 mt-2">
                <span className="text-5xl font-black tabular-nums">{referralData?.discount?.discount || 0}%</span>
                <div className="pb-1.5">
                  <p className="text-white/90 text-sm font-bold">{referralData?.discount?.label || 'Sem indicações'}</p>
                  <p className="text-white/50 text-[10px]">{referralData?.confirmedCount || 0} indicação(ões) confirmada(s)</p>
                </div>
              </div>
              {referralData?.discount?.nextTier && (
                <div className="mt-3 bg-white/10 rounded-lg px-3 py-2">
                  <p className="text-white/80 text-[10px]">
                    🎯 Faltam <strong>{referralData.discount.remaining}</strong> indicação(ões) para <strong>{referralData.discount.nextTier.discount}%</strong> ({referralData.discount.nextTier.label})
                  </p>
                </div>
              )}
              {(referralData?.discount?.discount || 0) >= (referralData?.maxDiscount || 15) && (
                <div className="mt-3 bg-white/10 rounded-lg px-3 py-2">
                  <p className="text-white/90 text-[10px] font-bold">🏆 Parabéns! Você atingiu o desconto máximo!</p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Discount Tiers Table ═══ */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-cream-dark/30">
            <h3 className="text-sm font-bold text-charcoal mb-3">📊 Tabela de Descontos</h3>
            <div className="space-y-1.5">
              {(referralData?.discountTiers || []).map((tier, i) => {
                const isActive = (referralData?.confirmedCount || 0) >= tier.min && (referralData?.confirmedCount || 0) <= tier.max
                const isPast = (referralData?.confirmedCount || 0) > tier.max
                return (
                  <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all ${
                    isActive ? 'bg-rose-gold/10 border border-rose-gold/30' : isPast ? 'bg-green-50 border border-green-200' : 'bg-cream/50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{isPast ? '✅' : isActive ? '👉' : '○'}</span>
                      <span className={`text-xs font-medium ${isActive ? 'text-rose-gold font-bold' : 'text-charcoal/70'}`}>{tier.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-warm-gray">{tier.min}-{tier.max > 100 ? '∞' : tier.max} ind.</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-rose-gold text-white' : 'bg-cream text-warm-gray'
                      }`}>{tier.discount}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[9px] text-warm-gray/60 mt-2 text-center">Teto máximo: {referralData?.maxDiscount || 15}% · Desconto aplicável em sessões avulsas</p>
          </div>

          {/* ═══ My Link & Custom Code ═══ */}
          <div className="bg-gradient-to-br from-rose-gold/5 to-rose-gold/15 rounded-2xl p-5 border border-rose-gold/20">
            <p className="text-xs text-warm-gray font-medium mb-1 text-center">Seu link promocional</p>
            
            {/* Current link */}
            <div className="bg-white rounded-xl py-3 px-4 my-3 flex items-center justify-between shadow-sm border border-cream-dark/30">
              <span className="text-xs font-mono text-charcoal truncate flex-1 mr-2">mykaprocopio.com.br/ref/{referralData?.code || '...'}</span>
              <button onClick={copyLink} className="text-rose-gold hover:text-rose-gold-dark transition-colors shrink-0">
                {copiedLink ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>
                )}
              </button>
            </div>

            {/* Customize code */}
            <div className="mt-4">
              <p className="text-[11px] text-charcoal font-medium mb-2">✏️ Personalize seu código (máx. 10 caracteres)</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCodeInput}
                  onChange={e => setCustomCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10))}
                  placeholder="Ex: MYKA2026"
                  maxLength={10}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-cream-dark text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-gold/30 focus:border-rose-gold uppercase tracking-wider font-mono"
                />
                <button
                  onClick={saveCustomCode}
                  disabled={!customCodeInput.trim() || customCodeInput.length < 3 || savingCustomCode}
                  className="bg-rose-gold text-white px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-rose-gold-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {savingCustomCode ? '...' : 'Salvar'}
                </button>
              </div>
              <p className="text-[9px] text-warm-gray mt-1.5">Só letras e números. Mín. 3 caracteres. Seu link ficará: mykaprocopio.com.br/ref/{customCodeInput || 'SEUCODIGO'}</p>
            </div>

            {/* Share buttons */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={shareCode}
                className="bg-rose-gold text-white py-3 rounded-xl font-bold text-xs hover:bg-rose-gold-dark active:scale-[0.98] transition-all shadow-md"
              >
                📲 Compartilhar
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `💎 Venha experimentar o melhor da estética com a Mykaele Procópio!\n\nUse meu link exclusivo:\n${referralData?.promoLink || `https://mykaprocopio.com.br/ref/${referralData?.code || ''}`}\n\nGanhe pontos de boas-vindas no programa de fidelidade! ✨`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 bg-green-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-green-700 active:scale-[0.98] transition-all shadow-md"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            </div>

            <p className="text-[10px] text-warm-gray/60 mt-3 text-center">
              {referralData?.usageCount || 0} pessoa(s) já usaram seu código
            </p>
          </div>

          {/* ═══ Ranking de Indicações ═══ */}
          {referralData?.ranking && referralData.ranking.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-cream-dark/30">
              <h3 className="text-sm font-bold text-charcoal mb-3">🏆 Ranking de Indicações</h3>
              <div className="space-y-1.5">
                {referralData.ranking.map(entry => {
                  const posEmojis = ['', '🥇', '🥈', '🥉']
                  return (
                    <div key={entry.position} className={`flex items-center gap-3 py-2.5 px-3 rounded-lg ${
                      entry.isCurrentUser ? 'bg-rose-gold/10 border border-rose-gold/30' : 'bg-cream/30'
                    }`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        entry.position <= 3 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-white' : 'bg-cream text-warm-gray'
                      }`}>
                        {entry.position <= 3 ? posEmojis[entry.position] : entry.position}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-medium ${entry.isCurrentUser ? 'text-rose-gold font-bold' : 'text-charcoal'}`}>
                          {entry.isCurrentUser ? '⭐ Você' : entry.displayName}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-charcoal">{entry.referralCount} ind.</span>
                    </div>
                  )
                })}
              </div>
              {referralData.myPosition && !referralData.ranking.find(r => r.isCurrentUser) && (
                <div className="mt-2 flex items-center gap-3 py-2.5 px-3 rounded-lg bg-rose-gold/10 border border-rose-gold/30">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-cream text-warm-gray">
                    {referralData.myPosition}
                  </div>
                  <p className="text-xs font-bold text-rose-gold flex-1">⭐ Você</p>
                  <span className="text-xs font-bold text-charcoal">{referralData.usageCount} ind.</span>
                </div>
              )}
            </div>
          )}

          {/* Apply referral code */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-cream-dark/30">
            <h3 className="text-sm font-bold text-charcoal mb-2">🎁 Tem um código de indicação?</h3>
            <p className="text-[11px] text-warm-gray mb-3">Se uma amiga te indicou, insira o código dela aqui para ganhar pontos de boas-vindas!</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralInput}
                onChange={e => setReferralInput(e.target.value.toUpperCase())}
                placeholder="Ex: MYKA2026"
                className="flex-1 px-3 py-2.5 rounded-lg border border-cream-dark text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-rose-gold/30 focus:border-rose-gold uppercase tracking-wider"
              />
              <button
                onClick={applyReferralCode}
                disabled={!referralInput.trim() || applyingCode}
                className="bg-rose-gold text-white px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-rose-gold-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {applyingCode ? '...' : 'Aplicar'}
              </button>
            </div>
          </div>

          {/* My Referrals List */}
          {referralData && referralData.referrals.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-cream-dark/30">
              <h3 className="text-sm font-bold text-charcoal mb-3">🤝 Minhas Indicações ({referralData.referrals.length})</h3>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {referralData.referrals.map(ref => (
                  <div key={ref.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0">
                    <div>
                      <p className="text-xs font-medium text-charcoal">{ref.referredName}</p>
                      <p className="text-[10px] text-warm-gray">{fmtDate(ref.createdAt)}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ref.status === 'REWARDED' ? 'bg-green-50 text-green-700' :
                      ref.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>
                      {ref.status === 'REWARDED' ? '✅ +200pts' : ref.status === 'CONFIRMED' ? '✓ Confirmado' : '⏳ Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
