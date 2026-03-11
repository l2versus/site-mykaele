'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'clinica-mykaele-procopio'

interface LeadInsight {
  id: string
  name: string
  phone: string
  status: 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST'
  stageName: string
  expectedValue: number | null
  aiScore: number | null
  aiScoreLabel: string | null
  churnRisk: number | null
  bestContactDays: string | null
  bestContactHours: string | null
  bestContactBasis: number | null
  lastInteractionAt: string | null
  tags: string[]
}

const STATUS_COLORS: Record<string, string> = {
  HOT: '#FF6B4A', WARM: '#F0A500', COLD: '#4A7BFF', WON: '#2ECC8A', LOST: '#8B8A94',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 30) return `Há ${days}d`
  return `Há ${Math.floor(days / 30)}m`
}

// ━━━ Skeleton ━━━
function IntelligenceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: '#111114' }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl animate-pulse" style={{ background: '#111114' }} />
        ))}
      </div>
    </div>
  )
}

// ━━━ Score Ring ━━━
function ScoreRing({ value, size = 48, color }: { value: number; size?: number; color: string }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1A1A1F" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
    </svg>
  )
}

export default function IntelligencePage() {
  const [leads, setLeads] = useState<LeadInsight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'score' | 'window' | 'churn'>('score')

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('admin_token')

      const pipelineRes = await fetch(`/api/admin/crm/pipeline?tenantId=${TENANT_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!pipelineRes.ok) throw new Error('Falha ao carregar pipeline')
      const pipelineData = await pipelineRes.json()

      const stageMap: Record<string, string> = {}
      for (const stage of pipelineData.stages) {
        stageMap[stage.id] = stage.name
      }

      const leadsRes = await fetch(`/api/admin/crm/leads?tenantId=${TENANT_ID}&pipelineId=${pipelineData.pipeline.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!leadsRes.ok) throw new Error('Falha ao carregar leads')
      const leadsData = await leadsRes.json()

      setLeads(leadsData.leads.map((l: LeadInsight & { stageId: string }) => ({
        ...l,
        stageName: stageMap[l.stageId] ?? '—',
      })))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (isLoading) return <IntelligenceSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm" style={{ color: '#FF6B4A' }}>{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#1A1A1F', color: '#F0EDE8', border: '1px solid #2A2A32' }}
        >Tentar novamente</button>
      </div>
    )
  }

  // Métricas derivadas
  const activeLeads = leads.filter(l => l.status !== 'WON' && l.status !== 'LOST')
  const scoredLeads = activeLeads.filter(l => l.aiScore != null)
  const avgScore = scoredLeads.length > 0
    ? Math.round(scoredLeads.reduce((acc, l) => acc + (l.aiScore ?? 0), 0) / scoredLeads.length)
    : 0
  const highScoreLeads = scoredLeads.filter(l => (l.aiScore ?? 0) >= 70)
  const atRiskLeads = activeLeads.filter(l => l.churnRisk != null && l.churnRisk >= 70)
  const goldenWindowLeads = activeLeads.filter(l => l.bestContactDays && l.bestContactHours)
  const totalPipeline = activeLeads.reduce((acc, l) => acc + (l.expectedValue ?? 0), 0)

  // Top leads por score
  const topByScore = [...scoredLeads].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0)).slice(0, 10)
  // Leads com janela de ouro
  const topGoldenWindow = goldenWindowLeads.slice(0, 10)
  // Leads em risco
  const topAtRisk = [...activeLeads].filter(l => l.churnRisk != null).sort((a, b) => (b.churnRisk ?? 0) - (a.churnRisk ?? 0)).slice(0, 10)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#F0EDE8' }}>Inteligência</h1>
        <p className="text-xs mt-0.5" style={{ color: '#8B8A94' }}>
          Insights de IA sobre seus {activeLeads.length} leads ativos
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Score Médio', value: `${avgScore}`, sublabel: `${scoredLeads.length} avaliados`, color: '#D4AF37', icon: '★' },
          { label: 'Alta Conversão', value: `${highScoreLeads.length}`, sublabel: 'score ≥ 70', color: '#2ECC8A', icon: '↑' },
          { label: 'Em Risco', value: `${atRiskLeads.length}`, sublabel: 'churn ≥ 70%', color: '#FF6B4A', icon: '⚠' },
          { label: 'Pipeline Ativo', value: formatCurrency(totalPipeline), sublabel: `${activeLeads.length} leads`, color: '#D4AF37', icon: '◆' },
        ]).map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="rounded-xl p-4 border relative overflow-hidden"
            style={{ background: '#111114', borderColor: '#2A2A32' }}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="absolute top-3 right-3 text-lg opacity-20" style={{ color: kpi.color }}>{kpi.icon}</div>
            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#8B8A94' }}>{kpi.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#8B8A94' }}>{kpi.sublabel}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg inline-flex" style={{ background: '#111114' }}>
        {([
          { key: 'score' as const, label: 'Score IA', count: scoredLeads.length },
          { key: 'window' as const, label: 'Janela de Ouro', count: goldenWindowLeads.length },
          { key: 'churn' as const, label: 'Radar de Retenção', count: atRiskLeads.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-xs font-medium transition-all"
            style={{
              background: activeTab === tab.key ? '#1A1A1F' : 'transparent',
              color: activeTab === tab.key ? '#D4AF37' : '#8B8A94',
            }}
          >
            {tab.label} <span className="opacity-50 ml-1">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'score' && (
        <div className="space-y-2">
          {topByScore.length === 0 ? (
            <div className="flex flex-col items-center py-16 opacity-40">
              <svg width="32" height="32" fill="none" stroke="#8B8A94" strokeWidth="1.2" viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Scores de IA serão calculados automaticamente</p>
            </div>
          ) : (
            topByScore.map((lead, i) => {
              const scoreColor = (lead.aiScore ?? 0) >= 70 ? '#2ECC8A' : (lead.aiScore ?? 0) >= 40 ? '#F0A500' : '#4A7BFF'
              return (
                <motion.div
                  key={lead.id}
                  className="flex items-center gap-4 p-3 rounded-xl border"
                  style={{ background: '#111114', borderColor: '#2A2A32' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="relative flex-shrink-0">
                    <ScoreRing value={lead.aiScore ?? 0} color={scoreColor} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                      style={{ color: scoreColor }}
                    >
                      {lead.aiScore}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>{lead.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: (STATUS_COLORS[lead.status] ?? '#8B8A94') + '18', color: STATUS_COLORS[lead.status] }}
                      >
                        {lead.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>{lead.stageName}</span>
                      {lead.expectedValue != null && lead.expectedValue > 0 && (
                        <span className="text-[11px] font-medium" style={{ color: '#D4AF37' }}>
                          {formatCurrency(lead.expectedValue)}
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>{timeAgo(lead.lastInteractionAt)}</span>
                    </div>
                    {lead.aiScoreLabel && (
                      <p className="text-[10px] mt-1" style={{ color: '#8B8A94' }}>{lead.aiScoreLabel}</p>
                    )}
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'window' && (
        <div className="space-y-2">
          {topGoldenWindow.length === 0 ? (
            <div className="flex flex-col items-center py-16 opacity-40">
              <svg width="32" height="32" fill="none" stroke="#D4AF37" strokeWidth="1.2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Janelas de Ouro aparecem após padrões de interação</p>
            </div>
          ) : (
            topGoldenWindow.map((lead, i) => (
              <motion.div
                key={lead.id}
                className="flex items-center gap-4 p-3 rounded-xl border"
                style={{ background: '#111114', borderColor: '#2A2A32' }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(212,175,55,0.08)' }}
                >
                  <svg width="20" height="20" fill="none" stroke="#D4AF37" strokeWidth="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>{lead.name}</span>
                    <span className="text-[10px]" style={{ color: '#8B8A94' }}>{lead.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                    >
                      {lead.bestContactDays} · {lead.bestContactHours}
                    </span>
                    {lead.bestContactBasis != null && lead.bestContactBasis > 0 && (
                      <span className="text-[10px]" style={{ color: '#8B8A94' }}>
                        Base: {lead.bestContactBasis} conversões
                      </span>
                    )}
                  </div>
                </div>
                {lead.expectedValue != null && lead.expectedValue > 0 && (
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: '#D4AF37' }}>
                    {formatCurrency(lead.expectedValue)}
                  </span>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {activeTab === 'churn' && (
        <div className="space-y-2">
          {topAtRisk.length === 0 ? (
            <div className="flex flex-col items-center py-16 opacity-40">
              <svg width="32" height="32" fill="none" stroke="#2ECC8A" strokeWidth="1.2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-xs mt-2" style={{ color: '#8B8A94' }}>Nenhum lead em risco de churn. Excelente!</p>
            </div>
          ) : (
            topAtRisk.map((lead, i) => {
              const riskColor = (lead.churnRisk ?? 0) >= 70 ? '#FF6B4A' : (lead.churnRisk ?? 0) >= 40 ? '#F0A500' : '#2ECC8A'
              return (
                <motion.div
                  key={lead.id}
                  className="flex items-center gap-4 p-3 rounded-xl border"
                  style={{ background: '#111114', borderColor: '#2A2A32' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="relative flex-shrink-0">
                    <ScoreRing value={lead.churnRisk ?? 0} color={riskColor} />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                      style={{ color: riskColor }}
                    >
                      {lead.churnRisk}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: '#F0EDE8' }}>{lead.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: riskColor + '18', color: riskColor }}
                      >
                        {(lead.churnRisk ?? 0) >= 70 ? 'ALTO RISCO' : 'ATENÇÃO'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>{lead.stageName}</span>
                      <span className="text-[11px]" style={{ color: '#8B8A94' }}>
                        Última interação: {timeAgo(lead.lastInteractionAt)}
                      </span>
                    </div>
                    {lead.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {lead.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[9px] px-1 py-0.5 rounded"
                            style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                          >{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {lead.expectedValue != null && lead.expectedValue > 0 && (
                    <div className="flex-shrink-0 text-right">
                      <span className="text-xs font-medium" style={{ color: '#FF6B4A' }}>
                        {formatCurrency(lead.expectedValue)}
                      </span>
                      <p className="text-[9px]" style={{ color: '#8B8A94' }}>em risco</p>
                    </div>
                  )}
                </motion.div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
