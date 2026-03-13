'use client'

import { motion } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'

interface SparklinePoint {
  value: number
}

interface ReportMetricCardProps {
  label: string
  value: string
  subValue?: string
  icon: React.ReactNode
  accent?: string
  trend?: 'up' | 'down' | null
  trendValue?: string
  sparklineData?: SparklinePoint[]
  sparklineColor?: string
}

export function ReportMetricCard({
  label, value, subValue, icon, accent, trend, trendValue, sparklineData, sparklineColor,
}: ReportMetricCardProps) {
  const accentColor = accent ?? 'var(--crm-gold)'

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-4 transition-all hover:brightness-110"
      style={{ background: 'var(--crm-surface)', border: '1px solid var(--crm-border)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Background accent circle */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.04] -translate-y-6 translate-x-6"
        style={{ background: accentColor }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--crm-text-muted)' }}>
          {label}
        </span>
        <span className="opacity-50">{icon}</span>
      </div>

      {/* Value */}
      <p className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
        {value}
      </p>

      {/* Sub-value + trend */}
      {(subValue || trendValue) && (
        <div className="flex items-center gap-2 mt-1">
          {trendValue && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{
                background: trend === 'up' ? 'rgba(46,204,138,0.1)' : trend === 'down' ? 'rgba(255,107,74,0.1)' : 'transparent',
                color: trend === 'up' ? 'var(--crm-won)' : trend === 'down' ? 'var(--crm-hot)' : 'var(--crm-text-muted)',
              }}
            >
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trendValue}
            </span>
          )}
          {subValue && (
            <span className="text-[11px] font-medium" style={{ color: 'var(--crm-text-muted)' }}>
              {subValue}
            </span>
          )}
        </div>
      )}

      {/* Optional sparkline */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-3 -mx-1 -mb-1" style={{ height: 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={sparklineColor ?? accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={sparklineColor ?? accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparklineColor ?? accentColor}
                fill={`url(#spark-${label.replace(/\s/g, '')})`}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}
