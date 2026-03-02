// src/utils/pdf-evolution.ts — Geração de PDF de Evolução Corporal
// jsPDF is lazy-loaded when generateEvolutionPDF is called

interface MeasurementData {
  id: string
  date: string
  weight?: number
  height?: number
  bodyFat?: number
  muscleMass?: number
  bmi?: number
  bust?: number
  waist?: number
  abdomen?: number
  hip?: number
  armLeft?: number
  armRight?: number
  thighLeft?: number
  thighRight?: number
  calfLeft?: number
  calfRight?: number
  notes?: string
  measuredBy?: string
}

interface Evolution {
  key: string
  label: string
  unit: string
  initial: number | null
  latest: number | null
  delta: number | null
  deltaPercent: number | null
}

interface Summary {
  totalMeasurements: number
  daysSinceFirst: number
  totalLostCm: number
  weightChange: number
  fatChange: number
  bestReduction: { key: string; label: string; delta: number; unit: string } | null
}

interface EvolutionPDFData {
  clientName: string
  measurements: MeasurementData[]
  evolution: Evolution[]
  summary: Summary | null
  latest: MeasurementData | null
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const formatNum = (n: number) => n.toFixed(1)

export async function generateEvolutionPDF(data: EvolutionPDFData): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let y = margin

  // Colors
  const primary = '#b76e79'
  const dark = '#1a1a1a'
  const gray = '#666666'
  const lightGray = '#999999'

  // Header
  pdf.setFillColor(183, 110, 121) // rose-gold
  pdf.rect(0, 0, pageWidth, 45, 'F')
  
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Mykaele Procópio', margin, 18)
  
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Home Spa | Arquitetura Corporal', margin, 26)
  
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Relatório de Evolução Corporal', margin, 38)

  y = 55

  // Client info
  pdf.setTextColor(dark)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Cliente: ${data.clientName}`, margin, y)
  
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(gray)
  pdf.text(`Gerado em: ${formatDate(new Date().toISOString())}`, margin, y + 6)
  
  if (data.summary) {
    pdf.text(`Período de acompanhamento: ${data.summary.daysSinceFirst} dias | ${data.summary.totalMeasurements} avaliações`, margin, y + 12)
  }

  y += 25

  // Summary Box
  if (data.summary) {
    pdf.setFillColor(250, 245, 246)
    pdf.roundedRect(margin, y, pageWidth - margin * 2, 35, 3, 3, 'F')
    
    pdf.setTextColor(primary)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text('RESUMO DA EVOLUÇÃO', margin + 5, y + 8)
    
    pdf.setTextColor(dark)
    pdf.setFontSize(18)
    const colWidth = (pageWidth - margin * 2 - 20) / 4
    
    // Weight change
    const weightSign = data.summary.weightChange > 0 ? '+' : ''
    pdf.text(`${weightSign}${formatNum(data.summary.weightChange)}kg`, margin + 5, y + 22)
    pdf.setFontSize(8)
    pdf.setTextColor(gray)
    pdf.text('Peso', margin + 5, y + 28)
    
    // Fat change
    pdf.setTextColor(dark)
    pdf.setFontSize(18)
    const fatSign = data.summary.fatChange > 0 ? '+' : ''
    pdf.text(`${fatSign}${formatNum(data.summary.fatChange)}%`, margin + colWidth + 5, y + 22)
    pdf.setFontSize(8)
    pdf.setTextColor(gray)
    pdf.text('Gordura', margin + colWidth + 5, y + 28)
    
    // Total cm lost
    pdf.setTextColor(183, 110, 121)
    pdf.setFontSize(18)
    pdf.text(`-${formatNum(data.summary.totalLostCm)}cm`, margin + colWidth * 2 + 5, y + 22)
    pdf.setFontSize(8)
    pdf.setTextColor(gray)
    pdf.text('Total perdido', margin + colWidth * 2 + 5, y + 28)
    
    // Best reduction
    if (data.summary.bestReduction) {
      pdf.setTextColor(39, 174, 96)
      pdf.setFontSize(18)
      pdf.text(`${data.summary.bestReduction.delta}${data.summary.bestReduction.unit}`, margin + colWidth * 3 + 5, y + 22)
      pdf.setFontSize(8)
      pdf.setTextColor(gray)
      pdf.text(data.summary.bestReduction.label, margin + colWidth * 3 + 5, y + 28)
    }
    
    y += 45
  }

  // Evolution Table
  pdf.setTextColor(primary)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('MEDIDAS COMPARATIVAS', margin, y)
  y += 8

  // Table header
  const tableX = margin
  const tableW = pageWidth - margin * 2
  const cols = [40, 30, 30, 30, 35] // label, inicial, atual, variação, %
  
  pdf.setFillColor(183, 110, 121)
  pdf.rect(tableX, y, tableW, 8, 'F')
  
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Medida', tableX + 3, y + 5.5)
  pdf.text('Inicial', tableX + cols[0] + 3, y + 5.5)
  pdf.text('Atual', tableX + cols[0] + cols[1] + 3, y + 5.5)
  pdf.text('Variação', tableX + cols[0] + cols[1] + cols[2] + 3, y + 5.5)
  pdf.text('% Mudança', tableX + cols[0] + cols[1] + cols[2] + cols[3] + 3, y + 5.5)
  
  y += 8

  // Table rows
  const evolutions = data.evolution.filter(e => e.initial !== null || e.latest !== null)
  evolutions.forEach((evo, i) => {
    const rowY = y + (i * 7)
    
    // Alternate row bg
    if (i % 2 === 0) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(tableX, rowY, tableW, 7, 'F')
    }
    
    pdf.setTextColor(dark)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    
    // Label
    pdf.text(`${evo.label} (${evo.unit})`, tableX + 3, rowY + 5)
    
    // Initial
    pdf.text(evo.initial !== null ? formatNum(evo.initial) : '-', tableX + cols[0] + 3, rowY + 5)
    
    // Current
    pdf.text(evo.latest !== null ? formatNum(evo.latest) : '-', tableX + cols[0] + cols[1] + 3, rowY + 5)
    
    // Variation
    if (evo.delta !== null) {
      const isNegative = evo.delta < 0
      pdf.setTextColor(isNegative ? 39 : 231, isNegative ? 174 : 76, isNegative ? 96 : 60)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${evo.delta > 0 ? '+' : ''}${formatNum(evo.delta)}`, tableX + cols[0] + cols[1] + cols[2] + 3, rowY + 5)
    } else {
      pdf.text('-', tableX + cols[0] + cols[1] + cols[2] + 3, rowY + 5)
    }
    
    // Percentage
    pdf.setTextColor(gray)
    pdf.setFont('helvetica', 'normal')
    if (evo.deltaPercent !== null) {
      pdf.text(`${evo.deltaPercent > 0 ? '+' : ''}${formatNum(evo.deltaPercent)}%`, tableX + cols[0] + cols[1] + cols[2] + cols[3] + 3, rowY + 5)
    } else {
      pdf.text('-', tableX + cols[0] + cols[1] + cols[2] + cols[3] + 3, rowY + 5)
    }
  })

  y += evolutions.length * 7 + 10

  // Check if we need a new page
  if (y > pageHeight - 60) {
    pdf.addPage()
    y = margin
  }

  // Measurement History
  if (data.measurements.length > 0) {
    pdf.setTextColor(primary)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text('HISTÓRICO DE AVALIAÇÕES', margin, y)
    y += 8
    
    data.measurements.slice(0, 5).forEach((m, i) => {
      if (y > pageHeight - 30) {
        pdf.addPage()
        y = margin
      }
      
      pdf.setFillColor(i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 250 : 255)
      pdf.rect(margin, y, pageWidth - margin * 2, 18, 'F')
      
      pdf.setTextColor(primary)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.text(formatDate(m.date), margin + 3, y + 6)
      
      if (m.measuredBy) {
        pdf.setTextColor(lightGray)
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`Por: ${m.measuredBy}`, margin + 3, y + 11)
      }
      
      // Key measurements
      pdf.setTextColor(dark)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      const measurements = []
      if (m.weight) measurements.push(`${m.weight}kg`)
      if (m.waist) measurements.push(`Cintura: ${m.waist}cm`)
      if (m.abdomen) measurements.push(`Abdômen: ${m.abdomen}cm`)
      if (m.hip) measurements.push(`Quadril: ${m.hip}cm`)
      
      pdf.text(measurements.join(' | '), margin + 50, y + 6)
      
      if (m.notes) {
        pdf.setTextColor(gray)
        pdf.setFontSize(7)
        pdf.text(`"${m.notes.substring(0, 80)}${m.notes.length > 80 ? '...' : ''}"`, margin + 50, y + 13)
      }
      
      y += 20
    })
  }

  // Footer
  pdf.setFillColor(50, 50, 50)
  pdf.rect(0, pageHeight - 20, pageWidth, 20, 'F')
  
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(8)
  pdf.text('Mykaele Procópio Home Spa', margin, pageHeight - 12)
  pdf.setTextColor(200, 200, 200)
  pdf.setFontSize(7)
  pdf.text('Este documento é confidencial e destinado exclusivamente ao cliente identificado.', margin, pageHeight - 7)
  pdf.text(`mykaprocopio.com.br | (85) 99908-6924`, pageWidth - margin - 50, pageHeight - 7)

  return pdf.output('blob')
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
