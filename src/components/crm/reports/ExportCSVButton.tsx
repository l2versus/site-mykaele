'use client'

interface ExportCSVButtonProps {
  /** Array of objects to export */
  data: Record<string, unknown>[]
  /** Custom column headers mapping: { fieldName: 'Display Name' } */
  headers?: Record<string, string>
  /** File name without extension */
  filename: string
  /** Button label */
  label?: string
}

export function ExportCSVButton({ data, headers, filename, label = 'Exportar CSV' }: ExportCSVButtonProps) {
  function handleExport() {
    if (!data.length) return

    const keys = headers ? Object.keys(headers) : Object.keys(data[0])
    const headerRow = headers ? keys.map((k) => headers[k]) : keys

    const rows = data.map((row) =>
      keys.map((key) => {
        const val = row[key]
        if (val === null || val === undefined) return ''
        const str = String(val)
        // Escape quotes and wrap if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(',')
    )

    // BOM for Excel to recognize UTF-8
    const bom = '\uFEFF'
    const csv = bom + [headerRow.join(','), ...rows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={!data.length}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-125 disabled:opacity-40"
      style={{
        background: 'var(--crm-surface-2)',
        color: 'var(--crm-text-muted)',
        border: '1px solid var(--crm-border)',
      }}
    >
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </button>
  )
}
