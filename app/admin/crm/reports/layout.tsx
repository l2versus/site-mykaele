'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReportsProvider } from '@/components/crm/reports'

const REPORT_NAV = [
  {
    href: '/admin/crm/reports',
    label: 'Painel Geral',
    description: 'Visao geral de todas as metricas',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: '/admin/crm/reports/roi',
    label: 'ROI',
    description: 'Retorno sobre investimento',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: '/admin/crm/reports/wins-losses',
    label: 'Ganhos e Perdas',
    description: 'Analise de conversao',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    href: '/admin/crm/reports/consolidated',
    label: 'Consolidado',
    description: 'Metricas por estagio do pipeline',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: '/admin/crm/reports/activities',
    label: 'Atividades',
    description: 'Historico de acoes no CRM',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: '/admin/crm/reports/communications',
    label: 'Comunicacoes',
    description: 'Metricas de mensagens e atendimento',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/crm/reports/goals',
    label: 'Metas',
    description: 'Objetivos e progresso mensal',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
]

export default function ReportsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <ReportsProvider>
      <div className="flex gap-0 min-h-[calc(100vh-8rem)]">
        {/* Sidebar — desktop: fixed left, mobile: horizontal tabs */}
        <aside
          className="hidden lg:flex flex-col w-56 shrink-0 rounded-2xl p-2 mr-5"
          style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
        >
          <div className="px-3 pt-2 pb-3 mb-1">
            <h2 className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
              Relatorios
            </h2>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
              Analytics e metricas do CRM
            </p>
          </div>

          <nav className="flex flex-col gap-0.5">
            {REPORT_NAV.map((item) => {
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
                  style={{
                    background: isActive ? 'var(--crm-gold-subtle)' : 'transparent',
                    color: isActive ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--crm-surface-2)'
                      e.currentTarget.style.color = 'var(--crm-text)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--crm-text-muted)'
                    }
                  }}
                >
                  <span className="opacity-70" style={isActive ? { opacity: 1 } : undefined}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Mobile: horizontal tabs */}
        <div className="lg:hidden mb-4 w-full">
          <nav
            className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1"
          >
            {REPORT_NAV.map((item) => {
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all shrink-0"
                  style={{
                    background: isActive ? 'var(--crm-gold-subtle)' : 'var(--crm-surface)',
                    color: isActive ? 'var(--crm-gold)' : 'var(--crm-text-muted)',
                    border: '1px solid var(--crm-border)',
                  }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Content area */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </ReportsProvider>
  )
}
