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
  const [referralData, setReferralData] = useState<{ code: string; usageCount: number; referrals: ReferralEntry[] } | null>(null)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [referralInput, setReferralInput] = useState('')
  const [applyingCode, setApplyingCode] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

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
    const text = `💎 Venha experimentar o melhor da estética com a Mykaele Procópio! Use meu código ${referralData.code} no cadastro e ganhe pontos de boas-vindas no programa de fidelidade exclusivo!\n\nhttps://mykaprocopio.com.br/cliente`
    if (navigator.share) {
      try { await navigator.share({ title: 'Mykaele Procópio - Indicação VIP', text }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(text) } catch {}
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
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
    <div className="min-h-screen pb-28">
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
              <p className="text-white/70 text-xs font-medium tracking-wider uppercase">Programa de Fidelidade</p>
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
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-gold/50 flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* How to earn points */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-cream-dark/30">
            <h3 className="text-sm font-bold text-charcoal mb-3">💰 Como ganhar pontos</h3>
            <div className="space-y-2">
              {[
                { action: 'Indique uma amiga', points: '+200 pts', icon: '🤝' },
                { action: 'Amiga indicada se cadastra', points: '+100 pts (ela)', icon: '🎁' },
                { action: 'Complete uma sessão', points: '+50 pts', icon: '💆' },
                { action: 'Faça uma avaliação', points: '+30 pts', icon: '⭐' },
                { action: 'Aniversário', points: '+150 pts', icon: '🎂' },
                { action: 'Suba de tier', points: '+50 pts', icon: '🏆' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-cream last:border-0">
                  <span className="text-xs text-charcoal/80">
                    <span className="mr-1.5">{item.icon}</span>
                    {item.action}
                  </span>
                  <span className="text-xs font-bold text-rose-gold">{item.points}</span>
                </div>
              ))}
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
                      <div className="text-3xl flex-shrink-0">{reward.imageEmoji || '🎁'}</div>
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
          {/* My Referral Code */}
          <div className="bg-gradient-to-br from-rose-gold/5 to-rose-gold/15 rounded-2xl p-5 border border-rose-gold/20 text-center">
            <p className="text-xs text-warm-gray font-medium mb-1">Seu código exclusivo de indicação</p>
            <div className="bg-white rounded-xl py-3 px-4 my-3 flex items-center justify-center gap-3 shadow-sm border border-cream-dark/30">
              <span className="text-lg font-bold tracking-widest text-charcoal">{referralData?.code || '...'}</span>
              <button
                onClick={copyCode}
                className="text-rose-gold hover:text-rose-gold-dark transition-colors"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>
                )}
              </button>
            </div>

            <p className="text-[11px] text-warm-gray mb-4">
              Cada amiga que se cadastra com seu código: você ganha <strong className="text-rose-gold">200 pts</strong> e ela ganha <strong className="text-rose-gold">100 pts</strong>!
            </p>

            <button
              onClick={shareCode}
              className="w-full bg-rose-gold text-white py-3 rounded-xl font-bold text-sm hover:bg-rose-gold-dark active:scale-[0.98] transition-all shadow-md"
            >
              📲 Compartilhar com amigas
            </button>

            <p className="text-[10px] text-warm-gray/60 mt-2">
              {referralData?.usageCount || 0} pessoa(s) já usaram seu código
            </p>
          </div>

          {/* Apply referral code */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-cream-dark/30">
            <h3 className="text-sm font-bold text-charcoal mb-2">🎁 Tem um código de indicação?</h3>
            <p className="text-[11px] text-warm-gray mb-3">Se uma amiga te indicou, insira o código dela aqui para ganhar pontos de boas-vindas!</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralInput}
                onChange={e => setReferralInput(e.target.value.toUpperCase())}
                placeholder="Ex: MYKA-ANA2024"
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
              <h3 className="text-sm font-bold text-charcoal mb-3">🤝 Minhas Indicações</h3>
              <div className="space-y-2">
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
                      {ref.status === 'REWARDED' ? '✅ Recompensado' : ref.status === 'CONFIRMED' ? '✓ Confirmado' : '⏳ Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Share via WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `💎 Venha experimentar o melhor da estética com a Mykaele Procópio! Use meu código ${referralData?.code || ''} no cadastro e ganhe pontos no programa de fidelidade exclusivo! ✨\n\nhttps://mykaprocopio.com.br/cliente`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 active:scale-[0.98] transition-all shadow-md"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Enviar via WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
