'use client'

import { useState, useEffect, useCallback } from 'react'

/* â”€â”€â”€ Types â”€â”€â”€ */
interface ReferralUser { id: string; name: string; email: string; phone?: string }
interface RankEntry {
  position: number; userId: string; user: ReferralUser | null
  confirmedReferrals: number; discount: number; tierLabel: string; code: string
}
interface ReferralEntry {
  id: string; referrer: ReferralUser | null; referred: ReferralUser | null
  status: string; createdAt: string; rewardedAt: string | null
}
interface CodeEntry { code: string; userId: string; user: ReferralUser | null; usageCount: number; createdAt: string }
interface DiscountTier { min: number; max: number; discount: number; label: string }
interface Stats {
  totalCodes: number; totalReferrals: number; confirmedReferrals: number
  pendingReferrals: number; usersWithDiscount: number; avgDiscount: number
  maxDiscountGiven: number; maxDiscountAllowed: number
}
interface Data {
  stats: Stats; ranking: RankEntry[]; referrals: ReferralEntry[]
  codes: CodeEntry[]; discountTiers: DiscountTier[]
}

/* â”€â”€â”€ Helpers â”€â”€â”€ */
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function IndicacoesAdminPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'ranking' | 'referrals' | 'codes'>('overview')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/loyalty?section=referral_stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erro')
      const json: Data = await res.json()
      setData(json)
    } catch (e) {
      console.error('Erro ao carregar dados de indicaÃ§Ãµes:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(fetchData, 30000)
    return () => clearInterval(iv)
  }, [fetchData])

  if (loading && !data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-rose-gold/30 border-t-rose-gold rounded-full" />
    </div>
  )

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center text-warm-gray text-sm">Erro ao carregar dados</div>
  )

  const { stats, ranking, referrals, codes, discountTiers } = data

  // Filtros
  const filteredRanking = search
    ? ranking.filter(r => r.user?.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()))
    : ranking
  const filteredReferrals = search
    ? referrals.filter(r =>
        r.referrer?.name.toLowerCase().includes(search.toLowerCase()) ||
        r.referred?.name.toLowerCase().includes(search.toLowerCase())
      )
    : referrals
  const filteredCodes = search
    ? codes.filter(c => c.user?.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
    : codes

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">ðŸ”— IndicaÃ§Ãµes</h1>
          <p className="text-sm text-warm-gray mt-0.5">Painel em tempo real Â· Atualiza a cada 30s</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="text-xs text-rose-gold hover:underline disabled:opacity-50">
          {loading ? 'Atualizando...' : 'ðŸ”„ Atualizar'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total IndicaÃ§Ãµes', value: stats.totalReferrals, icon: 'ðŸ“Š', color: 'from-blue-500/10 to-blue-600/10 border-blue-200' },
          { label: 'Confirmadas', value: stats.confirmedReferrals, icon: 'âœ…', color: 'from-green-500/10 to-green-600/10 border-green-200' },
          { label: 'Pendentes', value: stats.pendingReferrals, icon: 'â³', color: 'from-yellow-500/10 to-yellow-600/10 border-yellow-200' },
          { label: 'Com Desconto', value: stats.usersWithDiscount, icon: 'ðŸ’°', color: 'from-purple-500/10 to-purple-600/10 border-purple-200' },
        ].map(s => (
          <div key={s.label} className={`bg-linear-to-br ${s.color} rounded-xl p-4 border`}>
            <p className="text-[10px] text-warm-gray uppercase tracking-wider">{s.icon} {s.label}</p>
            <p className="text-2xl font-black text-charcoal mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Financial Impact */}
      <div className="bg-linear-to-r from-rose-gold/5 to-rose-gold/15 rounded-2xl p-5 border border-rose-gold/20">
        <h2 className="text-sm font-bold text-charcoal mb-3">ðŸ’Ž Impacto Financeiro dos Descontos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-[10px] text-warm-gray uppercase">CÃ³digos Criados</p>
            <p className="text-xl font-black text-charcoal">{stats.totalCodes}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-warm-gray uppercase">Desconto MÃ©dio</p>
            <p className="text-xl font-black text-charcoal">{stats.avgDiscount}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-warm-gray uppercase">Maior Desconto Dado</p>
            <p className="text-xl font-black text-rose-gold">{stats.maxDiscountGiven}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-warm-gray uppercase">Teto MÃ¡ximo</p>
            <p className="text-xl font-black text-green-700">{stats.maxDiscountAllowed}%</p>
          </div>
        </div>

        {/* Discount Tiers Reference */}
        <div className="mt-4 pt-3 border-t border-rose-gold/20">
          <p className="text-[10px] text-warm-gray font-medium mb-2">ðŸ“‹ Tabela de Tiers</p>
          <div className="flex flex-wrap gap-2">
            {discountTiers.map(tier => (
              <span key={tier.label} className="text-[10px] bg-white/80 rounded-full px-3 py-1 border border-cream-dark/30">
                <strong>{tier.label}</strong>: {tier.min}-{tier.max > 100 ? 'âˆž' : tier.max} ind. â†’ <strong>{tier.discount}%</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-cream rounded-xl p-1">
        {[
          { key: 'overview' as const, label: 'VisÃ£o Geral', icon: 'ðŸ“Š' },
          { key: 'ranking' as const, label: 'Ranking', icon: 'ðŸ†' },
          { key: 'referrals' as const, label: 'IndicaÃ§Ãµes', icon: 'ðŸ¤' },
          { key: 'codes' as const, label: 'CÃ³digos', icon: 'ðŸ”—' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
              tab === t.key ? 'bg-white text-charcoal shadow-sm' : 'text-warm-gray hover:text-charcoal'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab !== 'overview' && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ðŸ” Buscar por nome ou cÃ³digo..."
          className="w-full px-4 py-2.5 rounded-xl border border-cream-dark text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-gold/30"
        />
      )}

      {/* â•â•â• TAB: VisÃ£o Geral â•â•â• */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Top 5 Indicadores */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-cream-dark/30">
            <h3 className="text-sm font-bold text-charcoal mb-3">ðŸ† Top 5 Indicadores</h3>
            {ranking.length === 0 ? (
              <p className="text-xs text-warm-gray text-center py-4">Nenhuma indicaÃ§Ã£o confirmada ainda</p>
            ) : (
              <div className="space-y-2">
                {ranking.slice(0, 5).map(entry => (
                  <div key={entry.userId} className="flex items-center gap-3 p-3 rounded-lg bg-cream/40 hover:bg-cream/70 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      entry.position <= 3 ? 'bg-linear-to-br from-yellow-400 to-amber-600 text-white' : 'bg-cream text-warm-gray'
                    }`}>
                      {entry.position <= 3 ? ['', 'ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰'][entry.position] : entry.position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{entry.user?.name || 'Desconhecido'}</p>
                      <p className="text-[10px] text-warm-gray">CÃ³digo: {entry.code}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-charcoal">{entry.confirmedReferrals} ind.</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        entry.discount >= 12 ? 'bg-purple-100 text-purple-700' :
                        entry.discount >= 8 ? 'bg-amber-100 text-amber-700' :
                        entry.discount >= 5 ? 'bg-teal-100 text-teal-700' :
                        entry.discount >= 3 ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{entry.discount}% Â· {entry.tierLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent referrals */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-cream-dark/30">
            <h3 className="text-sm font-bold text-charcoal mb-3">ðŸ• IndicaÃ§Ãµes Recentes</h3>
            {referrals.length === 0 ? (
              <p className="text-xs text-warm-gray text-center py-4">Nenhuma indicaÃ§Ã£o registrada</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {referrals.slice(0, 10).map(ref => (
                  <div key={ref.id} className="flex items-center justify-between py-2.5 px-3 border-b border-cream last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-charcoal">
                        <strong>{ref.referrer?.name || '?'}</strong> indicou <strong>{ref.referred?.name || '?'}</strong>
                      </p>
                      <p className="text-[10px] text-warm-gray">{fmtDate(ref.createdAt)}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      ref.status === 'REWARDED' ? 'bg-green-50 text-green-700' :
                      ref.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>
                      {ref.status === 'REWARDED' ? 'âœ… Recompensado' : ref.status === 'CONFIRMED' ? 'âœ“ Confirmado' : 'â³ Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* â•â•â• TAB: Ranking â•â•â• */}
      {tab === 'ranking' && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-cream-dark/30">
          <h3 className="text-sm font-bold text-charcoal mb-3">ðŸ† Ranking Completo de Indicadores ({filteredRanking.length})</h3>
          {filteredRanking.length === 0 ? (
            <p className="text-xs text-warm-gray text-center py-6">Nenhum indicador encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-cream text-warm-gray">
                    <th className="py-2 px-2 font-medium">#</th>
                    <th className="py-2 px-2 font-medium">Nome</th>
                    <th className="py-2 px-2 font-medium">CÃ³digo</th>
                    <th className="py-2 px-2 font-medium text-center">IndicaÃ§Ãµes</th>
                    <th className="py-2 px-2 font-medium text-center">Desconto</th>
                    <th className="py-2 px-2 font-medium text-center">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRanking.map(entry => (
                    <tr key={entry.userId} className="border-b border-cream/50 hover:bg-cream/30">
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                          entry.position <= 3 ? 'bg-linear-to-br from-yellow-400 to-amber-600 text-white' : 'bg-cream text-warm-gray'
                        }`}>
                          {entry.position <= 3 ? ['', 'ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰'][entry.position] : entry.position}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-charcoal">{entry.user?.name || 'Desconhecido'}</p>
                        <p className="text-[10px] text-warm-gray">{entry.user?.email}</p>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-charcoal">{entry.code}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-charcoal">{entry.confirmedReferrals}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`font-bold px-2 py-0.5 rounded-full ${
                          entry.discount >= 12 ? 'bg-purple-100 text-purple-700' :
                          entry.discount >= 8 ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{entry.discount}%</span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-warm-gray">{entry.tierLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* â•â•â• TAB: IndicaÃ§Ãµes â•â•â• */}
      {tab === 'referrals' && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-cream-dark/30">
          <h3 className="text-sm font-bold text-charcoal mb-3">ðŸ¤ Todas as IndicaÃ§Ãµes ({filteredReferrals.length})</h3>
          {filteredReferrals.length === 0 ? (
            <p className="text-xs text-warm-gray text-center py-6">Nenhuma indicaÃ§Ã£o encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-cream text-warm-gray">
                    <th className="py-2 px-2 font-medium">Indicador</th>
                    <th className="py-2 px-2 font-medium">Indicado</th>
                    <th className="py-2 px-2 font-medium text-center">Status</th>
                    <th className="py-2 px-2 font-medium text-right">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReferrals.map(ref => (
                    <tr key={ref.id} className="border-b border-cream/50 hover:bg-cream/30">
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-charcoal">{ref.referrer?.name || '?'}</p>
                        <p className="text-[10px] text-warm-gray">{ref.referrer?.email}</p>
                      </td>
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-charcoal">{ref.referred?.name || '?'}</p>
                        <p className="text-[10px] text-warm-gray">{ref.referred?.email}</p>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ref.status === 'REWARDED' ? 'bg-green-50 text-green-700' :
                          ref.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' :
                          'bg-yellow-50 text-yellow-700'
                        }`}>
                          {ref.status === 'REWARDED' ? 'âœ… Recompensado' : ref.status === 'CONFIRMED' ? 'âœ“ Confirmado' : 'â³ Pendente'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-warm-gray">{fmtDate(ref.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* â•â•â• TAB: CÃ³digos â•â•â• */}
      {tab === 'codes' && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-cream-dark/30">
          <h3 className="text-sm font-bold text-charcoal mb-3">ðŸ”— Todos os CÃ³digos ({filteredCodes.length})</h3>
          {filteredCodes.length === 0 ? (
            <p className="text-xs text-warm-gray text-center py-6">Nenhum cÃ³digo encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-cream text-warm-gray">
                    <th className="py-2 px-2 font-medium">CÃ³digo</th>
                    <th className="py-2 px-2 font-medium">Dono</th>
                    <th className="py-2 px-2 font-medium text-center">Usos</th>
                    <th className="py-2 px-2 font-medium text-right">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCodes.map(code => (
                    <tr key={code.code} className="border-b border-cream/50 hover:bg-cream/30">
                      <td className="py-2.5 px-2 font-mono font-bold text-charcoal">{code.code}</td>
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-charcoal">{code.user?.name || '?'}</p>
                        <p className="text-[10px] text-warm-gray">{code.user?.email}</p>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`font-bold px-2 py-0.5 rounded-full ${
                          code.usageCount >= 10 ? 'bg-purple-100 text-purple-700' :
                          code.usageCount >= 5 ? 'bg-amber-100 text-amber-700' :
                          code.usageCount > 0 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{code.usageCount}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-warm-gray">{fmtDate(code.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
