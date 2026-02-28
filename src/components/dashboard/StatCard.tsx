// src/components/dashboard/StatCard.tsx
interface StatCardProps {
  label: string
  value: string | number
  icon?: string
  trend?: { value: number; direction: 'up' | 'down' }
  color?: 'slate' | 'green' | 'blue' | 'red' | 'amber' | 'purple'
}

export function StatCard({ label, value, icon, trend, color = 'slate' }: StatCardProps) {
  const colorClasses = {
    slate: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      icon: 'bg-slate-200 text-slate-700',
      label: 'text-slate-600',
      value: 'text-slate-900',
      trend: 'text-slate-600',
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'bg-green-200 text-green-700',
      label: 'text-green-700',
      value: 'text-green-900',
      trend: 'text-green-600',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'bg-blue-200 text-blue-700',
      label: 'text-blue-700',
      value: 'text-blue-900',
      trend: 'text-blue-600',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'bg-red-200 text-red-700',
      label: 'text-red-700',
      value: 'text-red-900',
      trend: 'text-red-600',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: 'bg-amber-200 text-amber-700',
      label: 'text-amber-700',
      value: 'text-amber-900',
      trend: 'text-amber-600',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      icon: 'bg-purple-200 text-purple-700',
      label: 'text-purple-700',
      value: 'text-purple-900',
      trend: 'text-purple-600',
    },
  }

  const colors = colorClasses[color]

  return (
    <div className={`p-6 rounded-2xl border ${colors.bg} ${colors.border} h-full`}>
      <div className="flex items-start justify-between gap-4">
        {/* Left side: Label and Value */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${colors.label} mb-3 truncate`}>{label}</p>
          <p className={`text-4xl font-bold ${colors.value} mb-2 break-words`}>{value}</p>
          {trend && (
            <div className={`mt-3 text-xs flex items-center gap-1 ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}% vs mês anterior</span>
            </div>
          )}
        </div>
        
        {/* Right side: Icon in circle */}
        {icon && (
          <div className={`w-16 h-16 rounded-full ${colors.icon} flex items-center justify-center flex-shrink-0 text-3xl`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
