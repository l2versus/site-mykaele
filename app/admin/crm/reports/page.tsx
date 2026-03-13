'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { DateRangeFilter } from '@/components/crm/reports'

const REPORT_CARDS = [
  {
    href: '/admin/crm/reports/roi',
    label: 'ROI',
    description: 'Retorno sobre investimento, custo por lead e custo por conversao',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    accent: 'var(--crm-won)',
  },
  {
    href: '/admin/crm/reports/wins-losses',
    label: 'Ganhos e Perdas',
    description: 'Taxa de conversao, funil de vendas e motivos de perda',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    accent: 'var(--crm-gold)',
  },
  {
    href: '/admin/crm/reports/consolidated',
    label: 'Consolidado',
    description: 'Metricas por estagio do pipeline e taxas de avanco',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    accent: 'var(--crm-warm)',
  },
  {
    href: '/admin/crm/reports/activities',
    label: 'Atividades',
    description: 'Historico de acoes, tarefas concluidas e volume de atividades',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    accent: 'var(--crm-cold)',
  },
  {
    href: '/admin/crm/reports/communications',
    label: 'Comunicacoes',
    description: 'Mensagens enviadas/recebidas, tempo de resposta e horarios de pico',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    accent: 'var(--crm-hot)',
  },
  {
    href: '/admin/crm/reports/goals',
    label: 'Metas',
    description: 'Objetivos mensais com progresso e projecoes',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    accent: '#D4AF37',
  },
]

export default function ReportsOverviewPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--crm-text)' }}>
            Relatorios
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>
            Analytics completo do seu CRM
          </p>
        </div>
        <DateRangeFilter />
      </div>

      {/* Quick summary will be added in 3.2 — for now show report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORT_CARDS.map((card, i) => (
          <motion.div
            key={card.href}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25, delay: i * 0.05 }}
          >
            <Link
              href={card.href}
              className="group block rounded-2xl p-5 transition-all hover:brightness-110"
              style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: `${card.accent}15`, color: card.accent }}
                >
                  {card.icon}
                </div>
                <svg
                  width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"
                  viewBox="0 0 24 24"
                  className="opacity-0 group-hover:opacity-60 transition-all -translate-x-1 group-hover:translate-x-0"
                  style={{ color: 'var(--crm-text-muted)' }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
              <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--crm-text)' }}>
                {card.label}
              </h3>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--crm-text-muted)' }}>
                {card.description}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
