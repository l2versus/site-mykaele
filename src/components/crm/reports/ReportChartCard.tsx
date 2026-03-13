'use client'

import { motion } from 'framer-motion'

interface ReportChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}

export function ReportChartCard({ title, subtitle, children, className = '', actions }: ReportChartCardProps) {
  return (
    <motion.div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--crm-text)' }}>{title}</h3>
          {subtitle && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--crm-text-muted)' }}>{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </motion.div>
  )
}

// ━━━ Chart Tooltip (reusable) ━━━

interface TooltipPayload {
  value: number
  name: string
  color?: string
}

export function ReportChartTooltip({
  active, payload, label, formatter,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  formatter?: (value: number, name: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 text-xs shadow-xl"
      style={{ background: 'var(--crm-surface-2)', border: '1px solid var(--crm-border)' }}
    >
      {label && (
        <p className="font-medium mb-1.5" style={{ color: 'var(--crm-text)' }}>{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color ?? '#D4AF37' }} />
          <span style={{ color: 'var(--crm-text-muted)' }}>{p.name}:</span>
          <span className="font-semibold" style={{ color: 'var(--crm-text)' }}>
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}
