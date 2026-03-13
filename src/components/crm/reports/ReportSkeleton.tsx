'use client'

export function ReportSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72 rounded-2xl" style={{ background: 'var(--crm-surface)' }} />
        ))}
      </div>
    </div>
  )
}

export function ReportMetricsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--crm-surface)' }} />
      ))}
    </div>
  )
}

export function ReportChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="rounded-2xl animate-pulse" style={{ background: 'var(--crm-surface)', height }} />
  )
}
