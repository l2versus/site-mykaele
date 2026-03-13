'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

/* ── types ─────────────────────────────────────── */

interface TeamMember {
  id: string
  userId: string | null
  name: string
  email: string
  phone: string | null
  role: string
  avatar: string | null
  isActive: boolean
  commissionPercent: number | null
  invitedBy: string | null
  joinedAt: string | null
  createdAt: string
  assignedLeads: number
  assignedConversations: number
}

interface MemberStat {
  memberId: string
  name: string
  wonCount: number
  wonValue: number
  commissionPercent: number | null
  commission: number | null
}

interface DailyMsg { day: string; count: number }

interface TeamStats {
  wonLeadsMonth: number
  wonValueMonth: number
  lostLeadsMonth: number
  messagesSentWeek: number
  pendingTasks: number
  dailyMessages: DailyMsg[]
  memberStats: MemberStat[]
}

/* ── constants ─────────────────────────────────── */

const TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'

const ROLE_MAP: Record<string, { label: string; color: string; description: string }> = {
  owner: { label: 'Proprietario', color: 'var(--crm-gold)', description: 'Acesso total ao sistema' },
  admin: { label: 'Administrador', color: 'var(--crm-hot)', description: 'Gerencia equipe e configs' },
  manager: { label: 'Gerente', color: 'var(--crm-warm)', description: 'Visualiza relatorios e gerencia agentes' },
  agent: { label: 'Agente', color: 'var(--crm-cold)', description: 'Atende leads e conversas atribuidas' },
}

const ROLE_ORDER = ['owner', 'admin', 'manager', 'agent']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function formatDay(dayStr: string) {
  const d = new Date(dayStr + 'T12:00:00')
  const wk = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  return wk[d.getDay()]
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {}),
    },
  })
  return res.json()
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════ */

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [actionPortal, setActionPortal] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setActionPortal(document.getElementById('crm-page-actions'))
  }, [])

  const loadMembers = useCallback(async () => {
    const params = new URLSearchParams({ tenantId: TENANT_ID })
    if (showInactive) params.set('includeInactive', 'true')
    const data = await apiFetch(`/api/admin/crm/team?${params}`)
    if (data.members) setMembers(data.members)
    setLoading(false)
  }, [showInactive])

  const loadStats = useCallback(async () => {
    const data = await apiFetch(`/api/admin/crm/team/stats?tenantId=${TENANT_ID}`)
    if (!data.error) setStats(data)
  }, [])

  useEffect(() => { loadMembers(); loadStats() }, [loadMembers, loadStats])

  const handleRemove = async (member: TeamMember) => {
    if (member.role === 'owner') return alert('Nao e possivel remover o proprietario')
    if (!confirm(`Remover ${member.name} da equipe? Leads e conversas atribuidos serao desvinculados.`)) return
    await apiFetch(`/api/admin/crm/team/${member.id}`, { method: 'DELETE' })
    loadMembers()
    loadStats()
  }

  const handleSaved = () => {
    setShowAdd(false)
    setEditingMember(null)
    loadMembers()
    loadStats()
  }

  /* Stats */
  const activeCount = members.filter(m => m.isActive).length
  const totalLeads = members.reduce((s, m) => s + m.assignedLeads, 0)
  const totalConvs = members.reduce((s, m) => s + m.assignedConversations, 0)

  /* Group by role */
  const groupedMembers = ROLE_ORDER.map(role => ({
    role,
    info: ROLE_MAP[role],
    members: members.filter(m => m.role === role),
  })).filter(g => g.members.length > 0)

  /* Max daily messages for bar chart scale */
  const maxDailyMsg = stats ? Math.max(...stats.dailyMessages.map(d => d.count), 1) : 1

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Portal: header actions */}
      {actionPortal && createPortal(
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            onClick={() => { setEditingMember(null); setShowAdd(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--crm-gold)', color: '#000' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Adicionar Membro
          </button>
        </div>,
        actionPortal
      )}

      {/* ── Global Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Membros Ativos', value: String(activeCount), color: 'var(--crm-won)' },
          { label: 'Leads Atribuidos', value: String(totalLeads), color: 'var(--crm-gold)' },
          { label: 'Conversas Ativas', value: String(totalConvs), color: 'var(--crm-cold)' },
          { label: 'Ganhos no Mes', value: stats ? currencyFmt.format(stats.wonValueMonth) : '—', color: 'var(--crm-won)' },
          { label: 'Tarefas Pendentes', value: stats ? String(stats.pendingTasks) : '—', color: 'var(--crm-warm)' },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-xl p-4 border"
            style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
          >
            <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--crm-text-muted)' }}>{stat.label}</p>
            <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Messages Chart (Week) ── */}
      {stats && stats.dailyMessages.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold" style={{ color: 'var(--crm-text)' }}>Mensagens Enviadas</h3>
              <p className="text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>Ultimos 7 dias · {stats.messagesSentWeek} total</p>
            </div>
          </div>
          <div className="flex items-end gap-2 h-24">
            {stats.dailyMessages.map(d => {
              const pct = d.count / maxDailyMsg
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-semibold" style={{ color: 'var(--crm-text-muted)' }}>{d.count}</span>
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${Math.max(pct * 64, 4)}px`,
                      background: d.count > 0 ? 'var(--crm-gold)' : 'var(--crm-border)',
                      opacity: d.count > 0 ? 1 : 0.3,
                    }}
                  />
                  <span className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>{formatDay(d.day)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Ranking (Won this month) ── */}
      {stats && stats.memberStats.filter(m => m.wonCount > 0).length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}>
          <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--crm-text)' }}>Ranking — Leads Ganhos no Mes</h3>
          <div className="space-y-2">
            {stats.memberStats
              .filter(m => m.wonCount > 0)
              .sort((a, b) => b.wonValue - a.wonValue)
              .map((m, i) => (
                <div key={m.memberId} className="flex items-center gap-3 py-2 px-3 rounded-lg"
                  style={{ background: i === 0 ? 'var(--crm-gold-subtle)' : 'transparent' }}>
                  <span className="text-sm font-bold w-6 text-center"
                    style={{ color: i === 0 ? 'var(--crm-gold)' : 'var(--crm-text-muted)' }}>
                    {i === 0 ? '🏆' : `${i + 1}`}
                  </span>
                  <span className="text-xs font-medium flex-1" style={{ color: 'var(--crm-text)' }}>{m.name}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--crm-text-muted)' }}>{m.wonCount} ganhos</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--crm-won)' }}>{currencyFmt.format(m.wonValue)}</span>
                  {m.commission !== null && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'var(--crm-gold-subtle)', color: 'var(--crm-gold)' }}>
                      {currencyFmt.format(m.commission)} ({m.commissionPercent}%)
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Show inactive toggle ── */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Mostrar inativos</span>
        </label>
      </div>

      {/* ── Members grouped by role ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--crm-surface)' }} />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        >
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--crm-gold-subtle)' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-gold)' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--crm-text)' }}>Nenhum membro na equipe</h3>
          <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>Adicione membros para gerenciar leads e conversas</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMembers.map(group => (
            <div key={group.role}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: `${group.info.color}18`, color: group.info.color }}
                >
                  {group.info.label}
                </span>
                <span className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>{group.info.description}</span>
              </div>
              <div className="space-y-2">
                {group.members.map(member => {
                  const memberStat = stats?.memberStats.find(s => s.memberId === member.id)
                  return (
                    <MemberCard
                      key={member.id}
                      member={member}
                      memberStat={memberStat ?? null}
                      isExpanded={expandedMember === member.id}
                      onToggleExpand={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                      onEdit={() => setEditingMember(member)}
                      onRemove={() => handleRemove(member)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Roles reference */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--crm-text-muted)' }}>
          Permissoes por Funcao
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--crm-text-muted)' }}>
                <th className="text-left py-2 pr-4 font-medium">Permissao</th>
                {ROLE_ORDER.map(r => (
                  <th key={r} className="text-center py-2 px-3 font-medium" style={{ color: ROLE_MAP[r].color }}>
                    {ROLE_MAP[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ color: 'var(--crm-text)' }}>
              {[
                { perm: 'Ver todos os leads', roles: ['owner', 'admin', 'manager'] },
                { perm: 'Ver leads atribuidos', roles: ['owner', 'admin', 'manager', 'agent'] },
                { perm: 'Gerenciar pipeline', roles: ['owner', 'admin'] },
                { perm: 'Enviar mensagens', roles: ['owner', 'admin', 'manager', 'agent'] },
                { perm: 'Criar transmissoes', roles: ['owner', 'admin', 'manager'] },
                { perm: 'Criar propostas', roles: ['owner', 'admin', 'manager', 'agent'] },
                { perm: 'Gerenciar automacoes', roles: ['owner', 'admin'] },
                { perm: 'Gerenciar equipe', roles: ['owner', 'admin'] },
                { perm: 'Configuracoes', roles: ['owner', 'admin'] },
                { perm: 'Integracoes', roles: ['owner'] },
                { perm: 'Ver relatorios', roles: ['owner', 'admin', 'manager'] },
                { perm: 'Exportar dados', roles: ['owner', 'admin'] },
              ].map(row => (
                <tr key={row.perm} className="border-t" style={{ borderColor: 'var(--crm-border)' }}>
                  <td className="py-2 pr-4">{row.perm}</td>
                  {ROLE_ORDER.map(r => (
                    <td key={r} className="text-center py-2 px-3">
                      {row.roles.includes(r) ? (
                        <span style={{ color: 'var(--crm-won)' }}>&#10003;</span>
                      ) : (
                        <span style={{ color: 'var(--crm-text-muted)', opacity: 0.3 }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(showAdd || editingMember) && (
          <MemberFormModal
            member={editingMember}
            onClose={() => { setShowAdd(false); setEditingMember(null) }}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   MEMBER CARD (enhanced with metrics)
   ══════════════════════════════════════════════════════ */

function MemberCard({
  member,
  memberStat,
  isExpanded,
  onToggleExpand,
  onEdit,
  onRemove,
}: {
  member: TeamMember
  memberStat: MemberStat | null
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const roleInfo = ROLE_MAP[member.role] || ROLE_MAP.agent

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        background: 'var(--crm-surface)',
        borderColor: isExpanded ? 'var(--crm-gold)30' : 'var(--crm-border)',
        opacity: member.isActive ? 1 : 0.5,
      }}
    >
      {/* Main row */}
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={onToggleExpand}>
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: `${roleInfo.color}18`, color: roleInfo.color }}
        >
          {getInitials(member.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate" style={{ color: 'var(--crm-text)' }}>{member.name}</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: `${roleInfo.color}14`, color: roleInfo.color }}>{roleInfo.label}</span>
            {!member.isActive && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: 'rgba(255,107,74,0.1)', color: 'var(--crm-hot)' }}>
                Inativo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            <span>{member.email}</span>
            {member.phone && <span className="hidden sm:inline">{member.phone}</span>}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="hidden sm:flex items-center gap-5 shrink-0">
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--crm-text)' }}>{member.assignedLeads}</p>
            <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Leads</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--crm-text)' }}>{member.assignedConversations}</p>
            <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>Conversas</p>
          </div>
          {memberStat && memberStat.wonCount > 0 && (
            <div className="text-center">
              <p className="text-sm font-bold" style={{ color: 'var(--crm-won)' }}>{currencyFmt.format(memberStat.wonValue)}</p>
              <p className="text-[9px]" style={{ color: 'var(--crm-text-muted)' }}>{memberStat.wonCount} ganhos</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            title="Editar"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-text-muted)' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {member.role !== 'owner' && member.isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
              title="Remover"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--crm-hot)' }}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            className="transition-transform"
            style={{ color: 'var(--crm-text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded metrics panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: 'var(--crm-border)' }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <MetricBox label="Leads Atribuidos" value={String(member.assignedLeads)} color="var(--crm-gold)" />
                <MetricBox label="Conversas Ativas" value={String(member.assignedConversations)} color="var(--crm-cold)" />
                <MetricBox label="Ganhos no Mes" value={memberStat ? String(memberStat.wonCount) : '0'} color="var(--crm-won)" />
                <MetricBox
                  label="Valor Ganho"
                  value={memberStat ? currencyFmt.format(memberStat.wonValue) : 'R$ 0'}
                  color="var(--crm-won)"
                />
              </div>

              {/* Commission info */}
              {member.commissionPercent != null && memberStat && (
                <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--crm-gold-subtle)', border: '1px solid rgba(212,175,55,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--crm-gold)' }}>
                      Comissao ({member.commissionPercent}%)
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--crm-gold)' }}>
                      {memberStat.commission !== null ? currencyFmt.format(memberStat.commission) : '—'}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
                    {currencyFmt.format(memberStat.wonValue)} x {member.commissionPercent}%
                  </p>
                </div>
              )}

              {/* Extra info */}
              <div className="flex items-center gap-4 mt-3 text-[10px]" style={{ color: 'var(--crm-text-muted)' }}>
                {member.joinedAt && <span>Desde {formatDate(member.joinedAt)}</span>}
                {member.phone && <span className="sm:hidden">{member.phone}</span>}
                <span>Criado em {formatDate(member.createdAt)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)' }}>
      <p className="text-[9px] font-medium" style={{ color: 'var(--crm-text-muted)' }}>{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   ADD / EDIT MODAL
   ══════════════════════════════════════════════════════ */

function MemberFormModal({
  member,
  onClose,
  onSaved,
}: {
  member: TeamMember | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!member

  const [name, setName] = useState(member?.name || '')
  const [email, setEmail] = useState(member?.email || '')
  const [phone, setPhone] = useState(member?.phone || '')
  const [role, setRole] = useState(member?.role || 'agent')
  const [isActive, setIsActive] = useState(member?.isActive ?? true)
  const [commissionPercent, setCommissionPercent] = useState(member?.commissionPercent?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return alert('Nome obrigatorio')
    if (!email.trim()) return alert('Email obrigatorio')
    if (!email.includes('@')) return alert('Email invalido')

    setSaving(true)

    const data = isEdit
      ? await apiFetch(`/api/admin/crm/team/${member.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name, phone: phone || null, role, isActive,
            commissionPercent: commissionPercent ? Number(commissionPercent) : null,
          }),
        })
      : await apiFetch('/api/admin/crm/team', {
          method: 'POST',
          body: JSON.stringify({ tenantId: TENANT_ID, name, email, phone: phone || null, role }),
        })

    setSaving(false)

    if (data.member) onSaved()
    else alert(data.error || 'Erro ao salvar')
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--crm-bg)',
    borderColor: 'var(--crm-border)',
    color: 'var(--crm-text)',
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        className="relative w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ background: 'var(--crm-surface)', borderColor: 'var(--crm-border)' }}
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--crm-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--crm-text)' }}>
            {isEdit ? 'Editar Membro' : 'Adicionar Membro'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--crm-text-muted)' }}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Nome</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1" style={inputStyle}
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@clinica.com"
              disabled={isEdit}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 disabled:opacity-50" style={inputStyle}
            />
            {isEdit && <p className="text-[10px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>Email nao pode ser alterado</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Telefone (opcional)</label>
            <input
              type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1" style={inputStyle}
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>Funcao</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_ORDER.filter(r => r !== 'owner' || member?.role === 'owner').map(r => {
                const info = ROLE_MAP[r]
                const active = role === r
                const disabled = r === 'owner' && member?.role !== 'owner'
                return (
                  <button
                    key={r} onClick={() => !disabled && setRole(r)} disabled={disabled}
                    className="p-3 rounded-lg border text-left transition-all disabled:opacity-30"
                    style={{
                      background: active ? `${info.color}12` : 'var(--crm-bg)',
                      borderColor: active ? info.color : 'var(--crm-border)',
                    }}
                  >
                    <p className="text-xs font-semibold" style={{ color: active ? info.color : 'var(--crm-text)' }}>{info.label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>{info.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Commission (edit only) */}
          {isEdit && (
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--crm-text-muted)' }}>
                Comissao (% sobre leads ganhos)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={commissionPercent} onChange={e => setCommissionPercent(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1" style={inputStyle}
                />
                <span className="text-sm font-medium shrink-0" style={{ color: 'var(--crm-text-muted)' }}>%</span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--crm-text-muted)' }}>
                Calculado automaticamente sobre o valor dos leads ganhos
              </p>
            </div>
          )}

          {/* Active toggle (edit only) */}
          {isEdit && member?.role !== 'owner' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded"
              />
              <span className="text-sm" style={{ color: 'var(--crm-text)' }}>Membro ativo</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t" style={{ borderColor: 'var(--crm-border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--crm-border)', color: 'var(--crm-text-muted)' }}
          >Cancelar</button>
          <button
            onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'var(--crm-gold)', color: '#000' }}
          >{saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
