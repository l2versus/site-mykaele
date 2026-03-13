'use client'

import { motion } from 'framer-motion'

interface ReportEmptyStateProps {
  icon?: React.ReactNode
  title?: string
  message?: string
}

export function ReportEmptyState({
  icon,
  title = 'Sem dados',
  message = 'Nao ha dados suficientes para este periodo. Tente ampliar o intervalo de datas.',
}: ReportEmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--crm-surface-2)', border: '1px dashed var(--crm-border)' }}
      >
        {icon ?? (
          <svg width="22" height="22" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24" className="opacity-40">
            <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--crm-text-muted)' }}>{title}</p>
      <p className="text-xs text-center max-w-xs" style={{ color: 'var(--crm-text-muted)', opacity: 0.6 }}>{message}</p>
    </motion.div>
  )
}

/** Small inline empty for chart areas */
export function ReportEmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: 'var(--crm-surface-2)', border: '1px dashed var(--crm-border)' }}
      >
        <svg width="16" height="16" fill="none" stroke="var(--crm-text-muted)" strokeWidth="1.5" viewBox="0 0 24 24" className="opacity-40">
          <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
        </svg>
      </div>
      <span className="text-[11px]" style={{ color: 'var(--crm-text-muted)', opacity: 0.5 }}>{message}</span>
    </div>
  )
}
