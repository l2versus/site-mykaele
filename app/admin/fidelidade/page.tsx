'use client'

import { useAdmin } from '../AdminContext'
import { useState, useEffect, useCallback } from 'react'

// ═══ Types ═══
interface Stats {
  totalMembers: number
  totalReferrals: number
  tierCounts: { BRONZE: number; SILVER: number; GOLD: number; DIAMOND: number }
  totalPointsIssued: number
  totalRedemptions: number
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

interface Member {
  id: string
  userId: string
  points: number
  totalEarned: number
  totalSpent: number
  tier: string
  position: number
  user: { id: string; name: string; email: string; phone: string; avatar: string | null } | null
}

interface ReferralInfo {
  id: string
  referrer: { id: string; name: string; email: string } | null
  referred: { id: string; name: string; email: string } | null
  status: string
  createdAt: string
  rewardedAt: string | null
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

const TIER_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  BRONZE: { name: 'Bronze', icon: '🥉', color: 'text-amber-700 bg-amber-50' },
  SILVER: { name: 'Prata', icon: '🥈', color: 'text-gray-600 bg-gray-100' },
  GOLD: { name: 'Ouro', icon: '🥇', color: 'text-yellow-600 bg-yellow-50' },
  DIAMOND: { name: 'Diamante', icon: '💎', color: 'text-blue-600 bg-blue-50' },
}

const REWARD_TYPES = [
  { value: 'DISCOUNT', label: 'Desconto' },
  { value: 'FREE_SESSION', label: 'Sessão Grátis' },
  { value: 'FREE_ADDON', label: 'Adicional Grátis' },
  { value: 'GIFT', label: 'Presente' },
  { value: 'UPGRADE', label: 'Upgrade' },
]

export default function AdminFidelidadePage() {
  const { fetchWithAuth } = useAdmin()
  const [tab, setTab] = useState<'overview' | 'members' | 'rewards' | 'referrals'>('overview')
  const [loading, setLoading] = useState(true)

  // States
  const [stats, setStats] = useState<Stats | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [referrals, setReferrals] = useState<ReferralInfo[]>([])
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Modals
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [rewardForm, setRewardForm] = useState({ name: '', description: '', pointsCost: '', type: 'DISCOUNT', value: '', stock: '', imageEmoji: '🎁' })
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [pointsAdjust, setPointsAdjust] = useState({ points: '', description: '' })

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ═══ Loaders ═══
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/loyalty?section=overview')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setRewards(data.rewards || [])
      }
    } catch {}
  }, [fetchWithAuth])

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/loyalty?section=members')
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      }
    } catch {}
  }, [fetchWithAuth])

  const loadReferrals = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/loyalty?section=referrals')
      if (res.ok) {
        const data = await res.json()
        setReferrals(data.referrals || [])
      }
    } catch {}
  }, [fetchWithAuth])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadOverview(), loadMembers(), loadReferrals()])
      setLoading(false)
    }
    init()
  }, [loadOverview, loadMembers, loadReferrals])

  // ═══ Actions ═══
  const saveReward = async () => {
    const body: Record<string, unknown> = {
      ...rewardForm,
      action: editingReward ? undefined : 'create_reward',
    }

    try {
      if (editingReward) {
        const res = await fetchWithAuth('/api/admin/loyalty', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingReward.id, ...rewardForm }),
        })
        if (res.ok) {
          showToast('Recompensa atualizada!')
        } else {
          showToast('Erro ao atualizar', 'error')
        }
      } else {
        const res = await fetchWithAuth('/api/admin/loyalty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_reward', ...rewardForm }),
        })
        if (res.ok) {
          showToast('Recompensa criada!')
        } else {
          showToast('Erro ao criar', 'error')
        }
      }
      setShowRewardModal(false)
      setEditingReward(null)
      setRewardForm({ name: '', description: '', pointsCost: '', type: 'DISCOUNT', value: '', stock: '', imageEmoji: '🎁' })
      await loadOverview()
    } catch {
      showToast('Erro de conexão', 'error')
    }
  }

  const toggleReward = async (reward: Reward) => {
    try {
      const res = await fetchWithAuth('/api/admin/loyalty', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reward.id, active: !reward.active }),
      })
      if (res.ok) {
        showToast(reward.active ? 'Desativada' : 'Ativada')
        await loadOverview()
      }
    } catch {}
  }

  const adjustPoints = async () => {
    if (!selectedMember || !pointsAdjust.points) return
    try {
      const res = await fetchWithAuth('/api/admin/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_points',
          userId: selectedMember.userId,
          points: pointsAdjust.points,
          description: pointsAdjust.description,
        }),
      })
      if (res.ok) {
        showToast('Pontos ajustados!')
        setShowPointsModal(false)
        setSelectedMember(null)
        setPointsAdjust({ points: '', description: '' })
        await loadMembers()
      } else {
        showToast('Erro ao ajustar', 'error')
      }
    } catch {
      showToast('Erro de conexão', 'error')
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all animate-fadeIn ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">💎 Programa de Fidelidade</h1>
        <p className="text-sm text-gray-500">Gerencie o programa de fidelidade e indicações</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'overview' as const, label: 'Visão Geral' },
          { key: 'members' as const, label: `Membros (${stats?.totalMembers || 0})` },
          { key: 'rewards' as const, label: `Recompensas (${rewards.length})` },
          { key: 'referrals' as const, label: `Indicações (${stats?.totalReferrals || 0})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Overview ═══ */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
              <p className="text-xs text-gray-500">Membros</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
              <p className="text-xs text-gray-500">Indicações</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-blue-600">{stats.totalPointsIssued.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-500">Pontos Emitidos</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-green-600">{stats.totalRedemptions}</p>
              <p className="text-xs text-gray-500">Resgates</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-2xl font-bold text-purple-600">{rewards.filter(r => r.active).length}</p>
              <p className="text-xs text-gray-500">Recompensas Ativas</p>
            </div>
          </div>

          {/* Tier Distribution */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Distribuição por Tier</h3>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(TIER_LABELS).map(([key, info]) => {
                const count = stats.tierCounts[key as keyof typeof stats.tierCounts] || 0
                const pct = stats.totalMembers > 0 ? Math.round((count / stats.totalMembers) * 100) : 0

                return (
                  <div key={key} className="text-center">
                    <div className="text-3xl mb-1">{info.icon}</div>
                    <p className="text-xl font-bold text-gray-900">{count}</p>
                    <p className="text-xs text-gray-500">{info.name}</p>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{pct}%</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Members ═══ */}
      {tab === 'members' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">#</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Cliente</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Tier</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500">Pontos</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500">Total Ganho</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500">Resgatado</th>
                <th className="py-3 px-4 text-center text-xs font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(m => {
                const tier = TIER_LABELS[m.tier] || TIER_LABELS.BRONZE
                return (
                  <tr key={m.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-xs text-gray-400">{m.position}</td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-gray-900">{m.user?.name || 'Sem nome'}</p>
                      <p className="text-xs text-gray-400">{m.user?.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tier.color}`}>
                        {tier.icon} {tier.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{m.points.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-right text-green-600">{m.totalEarned.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{m.totalSpent.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedMember(m)
                          setPointsAdjust({ points: '', description: '' })
                          setShowPointsModal(true)
                        }}
                        className="text-xs text-rose-gold hover:text-rose-gold-dark font-medium"
                      >
                        Ajustar Pontos
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {members.length === 0 && (
            <p className="text-center py-8 text-sm text-gray-400">Nenhum membro no programa ainda</p>
          )}
        </div>
      )}

      {/* ═══ TAB: Rewards ═══ */}
      {tab === 'rewards' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingReward(null)
                setRewardForm({ name: '', description: '', pointsCost: '', type: 'DISCOUNT', value: '', stock: '', imageEmoji: '🎁' })
                setShowRewardModal(true)
              }}
              className="bg-rose-gold text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-gold-dark transition-all"
            >
              + Nova Recompensa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map(r => (
              <div key={r.id} className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${r.active ? 'border-gray-100' : 'border-gray-200 opacity-50'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{r.imageEmoji || '🎁'}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 text-sm">{r.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {r.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-bold text-rose-gold">{r.pointsCost.toLocaleString('pt-BR')} pts</span>
                      <span className="text-xs text-gray-500">R$ {r.value.toFixed(2)}</span>
                      <span className="text-xs text-gray-400 capitalize">{REWARD_TYPES.find(t => t.value === r.type)?.label || r.type}</span>
                      {r.stock !== null && <span className="text-xs text-gray-400">Estoque: {r.stock}</span>}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setEditingReward(r)
                          setRewardForm({
                            name: r.name,
                            description: r.description || '',
                            pointsCost: String(r.pointsCost),
                            type: r.type,
                            value: String(r.value),
                            stock: r.stock !== null ? String(r.stock) : '',
                            imageEmoji: r.imageEmoji || '🎁',
                          })
                          setShowRewardModal(true)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleReward(r)}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        {r.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {rewards.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-400">Nenhuma recompensa criada. Crie a primeira!</p>
          )}
        </div>
      )}

      {/* ═══ TAB: Referrals ═══ */}
      {tab === 'referrals' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Quem Indicou</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Indicado(a)</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {referrals.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-gray-900">{r.referrer?.name || '-'}</p>
                    <p className="text-xs text-gray-400">{r.referrer?.email || ''}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-gray-900">{r.referred?.name || '-'}</p>
                    <p className="text-xs text-gray-400">{r.referred?.email || ''}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.status === 'REWARDED' ? 'bg-green-50 text-green-700' :
                      r.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>
                      {r.status === 'REWARDED' ? '✅ Recompensado' : r.status === 'CONFIRMED' ? '✓ Confirmado' : '⏳ Pendente'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {referrals.length === 0 && (
            <p className="text-center py-8 text-sm text-gray-400">Nenhuma indicação registrada ainda</p>
          )}
        </div>
      )}

      {/* ═══ Modal: Reward Form ═══ */}
      {showRewardModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRewardModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingReward ? '✏️ Editar Recompensa' : '🎁 Nova Recompensa'}
            </h3>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <label className="text-xs text-gray-500 block mb-1">Emoji</label>
                  <input
                    type="text"
                    value={rewardForm.imageEmoji}
                    onChange={e => setRewardForm(f => ({ ...f, imageEmoji: e.target.value }))}
                    className="w-14 h-10 text-center text-xl border border-gray-200 rounded-lg"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Nome</label>
                  <input
                    type="text"
                    value={rewardForm.name}
                    onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Desconto de R$50"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Descrição</label>
                <input
                  type="text"
                  value={rewardForm.description}
                  onChange={e => setRewardForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Válido na próxima sessão"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Custo (pontos)</label>
                  <input
                    type="number"
                    value={rewardForm.pointsCost}
                    onChange={e => setRewardForm(f => ({ ...f, pointsCost: e.target.value }))}
                    placeholder="500"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    value={rewardForm.value}
                    onChange={e => setRewardForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="50.00"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                  <select
                    value={rewardForm.type}
                    onChange={e => setRewardForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {REWARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Estoque (vazio = ilimitado)</label>
                  <input
                    type="number"
                    value={rewardForm.stock}
                    onChange={e => setRewardForm(f => ({ ...f, stock: e.target.value }))}
                    placeholder="∞"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRewardModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveReward}
                disabled={!rewardForm.name || !rewardForm.pointsCost || !rewardForm.value}
                className="flex-1 py-2.5 bg-rose-gold text-white rounded-lg text-sm font-medium hover:bg-rose-gold-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingReward ? 'Salvar Alterações' : 'Criar Recompensa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal: Adjust Points ═══ */}
      {showPointsModal && selectedMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPointsModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">⚙️ Ajustar Pontos</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedMember.user?.name} — {selectedMember.points.toLocaleString('pt-BR')} pts atuais</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Pontos (positivo = adicionar, negativo = remover)</label>
                <input
                  type="number"
                  value={pointsAdjust.points}
                  onChange={e => setPointsAdjust(a => ({ ...a, points: e.target.value }))}
                  placeholder="Ex: 100 ou -50"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Motivo</label>
                <input
                  type="text"
                  value={pointsAdjust.description}
                  onChange={e => setPointsAdjust(a => ({ ...a, description: e.target.value }))}
                  placeholder="Bônus especial, correção, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPointsModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={adjustPoints}
                disabled={!pointsAdjust.points}
                className="flex-1 py-2.5 bg-rose-gold text-white rounded-lg text-sm font-medium hover:bg-rose-gold-dark disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
