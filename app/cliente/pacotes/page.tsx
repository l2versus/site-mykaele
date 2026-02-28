'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useClient } from '../ClientContext'
import { useCart } from '../CartContext'
import Link from 'next/link'

interface PackageOption {
  id: string; name: string; sessions: number; price: number
  serviceId: string; service: { name: string }
}
interface MyPackage {
  id: string; totalSessions: number; usedSessions: number; status: string; purchaseDate: string
  packageOptionId: string; packageOption: { name: string; sessions: number; serviceId: string; service: { name: string } }
}

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function ProgressRing({ pct, size = 56, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#roseGrad)" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round" className="transition-all duration-700"/>
      <defs><linearGradient id="roseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#b76e79"/><stop offset="100%" stopColor="#d4a0a7"/>
      </linearGradient></defs>
    </svg>
  )
}

const PHASE_MAP = [
  { min: 0, name: 'Início', icon: '○' },
  { min: 1, name: 'Ativação', icon: '◐' },
  { min: 30, name: 'Remodelação', icon: '◑' },
  { min: 60, name: 'Refinamento', icon: '◕' },
  { min: 90, name: 'Manutenção', icon: '●' },
]
function getPhase(pct: number) { return [...PHASE_MAP].reverse().find(p => pct >= p.min)! }

export default function PacotesPage() {
  const { fetchWithAuth } = useClient()
  const { items: cartItems, addItem } = useCart()
  const router = useRouter()
  const [packages, setPackages] = useState<MyPackage[]>([])
  const [options, setOptions] = useState<PackageOption[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'my' | 'buy'>('my')
  const [buying, setBuying] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const [pkgRes, svcRes] = await Promise.all([
          fetchWithAuth('/api/patient/packages'),
          fetch('/api/services'),
        ])
        if (pkgRes.ok) { const d = await pkgRes.json(); setPackages(d.packages || d || []) }
        if (svcRes.ok) {
          const raw = await svcRes.json()
          const svcs = Array.isArray(raw) ? raw : (raw.services || [])
          const opts: PackageOption[] = []
          for (const s of svcs) for (const p of s.packageOptions || []) opts.push({ ...p, serviceId: s.id, service: { name: s.name } })
          setOptions(opts)
        }
      } catch { /* */ }
      setLoading(false)
    })()
  }, [fetchWithAuth])

  const buyPackage = async (optionId: string) => {
    const opt = options.find(o => o.id === optionId)
    if (!opt) return
    
    // Add to cart instead of directly purchasing
    addItem({
      id: opt.id,
      packageOptionId: opt.id,
      name: opt.name,
      sessions: opt.sessions,
      price: opt.price,
      serviceId: opt.serviceId,
      serviceName: opt.service.name,
    })
    
    // Show confirmation and redirect to cart
    setBuying(optionId)
    setTimeout(() => {
      setBuying(null)
      router.push('/cliente/carrinho')
    }, 1000)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
  }

  const active = packages.filter(p => p.status === 'ACTIVE')
  const completed = packages.filter(p => p.status !== 'ACTIVE')

  return (
    <div className="space-y-5 animate-[fadeIn_0.5s_ease-out]">
      <div>
        <h1 className="text-xl font-light text-white/90 tracking-tight">Minha Jornada</h1>
        <p className="text-[#c28a93]/40 text-[10px] mt-0.5 tracking-wide">Protocolos de Arquitetura Corporal</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1">
        <button onClick={() => setTab('my')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-300 ${tab === 'my' ? 'bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/15' : 'text-white/30 hover:text-white/45'}`}>
          Meus Protocolos ({active.length})
        </button>
        <button onClick={() => setTab('buy')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-300 ${tab === 'buy' ? 'bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/15' : 'text-white/30 hover:text-white/45'}`}>
          Novos Protocolos
        </button>
      </div>

      {tab === 'my' && (
        <>
          {active.length === 0 && completed.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-white/15"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <p className="text-white/25 text-sm">Nenhum protocolo ativo</p>
              <button onClick={() => setTab('buy')} className="mt-2 text-[#d4a0a7] text-xs hover:underline">Iniciar jornada</button>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((pkg) => {
                const pct = pkg.totalSessions > 0 ? Math.round((pkg.usedSessions / pkg.totalSessions) * 100) : 0
                const remaining = pkg.totalSessions - pkg.usedSessions
                const phase = getPhase(pct)
                return (
                  <div key={pkg.id} className="relative overflow-hidden rounded-2xl group hover:scale-[1.01] transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06] group-hover:to-white/[0.02] transition-all" />
                    <div className="relative border border-white/[0.06] rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center">
                        <ProgressRing pct={pct} />
                        <span className="absolute text-xs font-bold text-white">{pct}%</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="text-white/90 font-medium text-sm tracking-tight truncate">{pkg.packageOption.name}</div>
                          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[9px] px-2.5 py-0.5 rounded-full font-semibold shrink-0 ml-2">Ativo</span>
                        </div>
                        <div className="text-white/25 text-[11px] mt-0.5">{pkg.packageOption.service.name}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-white/20 text-[10px]">{pkg.usedSessions}/{pkg.totalSessions} sessões</span>
                          <span className="text-[#d4a0a7]/40 text-[10px]">{phase.icon} {phase.name}</span>
                          <span className="text-[#d4a0a7] text-[10px] font-medium">{remaining} restantes</span>
                        </div>
                      </div>
                    </div>
                    {/* Phase stepper */}
                    <div className="flex items-center gap-1 mt-3 px-1">
                      {PHASE_MAP.slice(1).map((p, i) => (
                        <div key={i} className="flex-1 flex items-center gap-1">
                          <div className={`h-1 flex-1 rounded-full ${pct >= p.min ? 'bg-gradient-to-r from-[#b76e79] to-[#d4a0a7]' : 'bg-white/[0.04]'}`}/>
                          <span className={`text-[8px] ${pct >= p.min ? 'text-[#d4a0a7]/60' : 'text-white/10'}`}>{p.icon}</span>
                        </div>
                      ))}
                    </div>
                    {remaining > 0 && (
                      <button onClick={() => {
                        const params = new URLSearchParams({
                          packageId: pkg.id, sessions: String(remaining),
                          serviceId: pkg.packageOption.serviceId || '', serviceName: pkg.packageOption.service.name,
                        })
                        router.push(`/cliente/agendar-pacote?${params.toString()}`)
                      }}
                        className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-xs font-medium shadow-lg shadow-[#b76e79]/10 hover:shadow-[#b76e79]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Agendar {remaining} sessões
                      </button>
                    )}
                  </div>
                  </div>
                )
              })}

              {/* Completed protocols */}
              {completed.length > 0 && (
                <>
                  <div className="text-white/15 text-[10px] font-medium uppercase tracking-wider mt-4">Finalizados</div>
                  {completed.map((pkg) => (
                    <div key={pkg.id} className="relative overflow-hidden rounded-2xl opacity-50">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-white/[0.005]" />
                      <div className="relative border border-white/[0.04] rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white/40 font-medium text-sm">{pkg.packageOption.name}</div>
                          <div className="text-white/15 text-[11px]">{pkg.packageOption.service.name} · {pkg.totalSessions} sessões</div>
                        </div>
                        <span className="text-blue-400/50 text-[9px] font-medium">Completo</span>
                      </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'buy' && (
        <div className="space-y-3">
          <p className="text-white/25 text-xs">Escolha um protocolo para iniciar</p>
          {options.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/20 text-sm">Nenhum protocolo disponível no momento</p>
            </div>
          ) : options.map((opt) => (
            <div key={opt.id} className="relative overflow-hidden rounded-2xl group hover:scale-[1.01] transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.01] group-hover:from-white/[0.06] group-hover:to-white/[0.02] transition-all" />
              <div className="relative border border-white/[0.06] group-hover:border-white/[0.10] rounded-2xl p-5 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-white/90 font-medium text-sm tracking-tight">{opt.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/25 text-[11px]">{opt.service.name}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10"/>
                    <span className="text-white/25 text-[11px]">{opt.sessions} sessões</span>
                  </div>
                  <div className="text-white/15 text-[10px] mt-1">{fmtCur(opt.price / opt.sessions)} por sessão</div>
                </div>
                <div className="text-right">
                  <div className="text-[#d4a0a7] font-bold text-lg">{fmtCur(opt.price)}</div>
                </div>
              </div>
              <button onClick={() => buyPackage(opt.id)} disabled={buying === opt.id}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white text-xs font-medium shadow-lg shadow-[#b76e79]/10 hover:shadow-[#b76e79]/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {buying === opt.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                    Adicionar ao Carrinho
                  </>
                )}
              </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
