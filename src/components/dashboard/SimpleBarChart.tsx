// src/components/dashboard/SimpleBarChart.tsx
'use client'

interface SeriesData {
  name: string
  data: number[]
}

interface SimpleBarChartProps {
  title: string
  series: SeriesData[]
  categories: string[]
  height?: number
}

export function SimpleBarChart({ title, series, categories, height = 300 }: SimpleBarChartProps) {
  const colors = ['#1e293b', '#64748b', '#cbd5e1']

  const maxValue = Math.max(...series.flatMap(s => s.data))
  const barWidth = 100 / (categories.length * series.length + categories.length)

  return (
    <div className="p-6 bg-white rounded-lg border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
      
      <div style={{ height }} className="flex flex-col justify-end gap-4">
        {/* Renderizar barras simples */}
        <div className="flex justify-around items-end gap-2" style={{ height: '100%' }}>
          {categories.map((category, catIdx) => (
            <div key={category} className="flex-1 flex flex-col items-center justify-end gap-2">
              {series.map((s, seriesIdx) => (
                <div
                  key={`${category}-${s.name}`}
                  style={{
                    height: `${(s.data[catIdx] / maxValue) * 250}px`,
                    width: '30px',
                    backgroundColor: colors[seriesIdx % colors.length],
                    borderRadius: '4px 4px 0 0',
                  }}
                  title={`${s.name}: ${s.data[catIdx]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-6 justify-center mt-6">
        {series.map((s, idx) => (
          <div key={s.name} className="flex items-center gap-2">
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: colors[idx % colors.length],
                borderRadius: '2px',
              }}
            />
            <span className="text-sm text-slate-600">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
