// src/utils/pdf-receipt.ts — Geração de Comprovante de Pagamento PDF
import jsPDF from 'jspdf'

interface ReceiptData {
  clientName: string
  clientEmail: string
  clientPhone?: string
  paymentId: string
  amount: number
  description: string
  method: string
  date: string
  status: string
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL'
})

export async function generateReceiptPDF(data: ReceiptData): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 20
  let y = margin

  // Header com logo
  pdf.setFillColor(183, 110, 121)
  pdf.rect(0, 0, pageWidth, 50, 'F')
  
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Mykaele Procópio', margin, 22)
  
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Home Spa | Arquitetura Corporal', margin, 30)
  
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('COMPROVANTE DE PAGAMENTO', margin, 44)

  y = 65

  // Status badge
  const statusColor = data.status === 'APPROVED' || data.status === 'approved' 
    ? { bg: [39, 174, 96], text: 'APROVADO' }
    : data.status === 'PENDING' || data.status === 'pending'
    ? { bg: [245, 158, 11], text: 'PENDENTE' }
    : { bg: [239, 68, 68], text: 'RECUSADO' }

  pdf.setFillColor(statusColor.bg[0], statusColor.bg[1], statusColor.bg[2])
  pdf.roundedRect(margin, y, 35, 8, 2, 2, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text(statusColor.text, margin + 17.5, y + 5.5, { align: 'center' })

  y += 18

  // Informações do pagamento
  pdf.setTextColor(50, 50, 50)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  // ID do pagamento
  pdf.setTextColor(130, 130, 130)
  pdf.text('Identificador:', margin, y)
  pdf.setTextColor(50, 50, 50)
  pdf.setFont('helvetica', 'bold')
  pdf.text(data.paymentId, margin + 35, y)
  
  y += 8
  
  // Data
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(130, 130, 130)
  pdf.text('Data/Hora:', margin, y)
  pdf.setTextColor(50, 50, 50)
  pdf.text(formatDate(data.date), margin + 35, y)
  
  y += 15

  // Box com valor
  pdf.setFillColor(250, 245, 246)
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 35, 3, 3, 'F')
  
  pdf.setTextColor(130, 130, 130)
  pdf.setFontSize(9)
  pdf.text('VALOR TOTAL', margin + (pageWidth - margin * 2) / 2, y + 10, { align: 'center' })
  
  pdf.setTextColor(183, 110, 121)
  pdf.setFontSize(28)
  pdf.setFont('helvetica', 'bold')
  pdf.text(formatCurrency(data.amount), margin + (pageWidth - margin * 2) / 2, y + 26, { align: 'center' })

  y += 45

  // Descrição
  pdf.setTextColor(50, 50, 50)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Descrição', margin, y)
  
  y += 6
  
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(80, 80, 80)
  
  // Quebrar descrição em múltiplas linhas se necessário
  const descLines = pdf.splitTextToSize(data.description, pageWidth - margin * 2)
  pdf.text(descLines, margin, y)
  
  y += descLines.length * 5 + 10

  // Método de pagamento
  pdf.setTextColor(50, 50, 50)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Forma de Pagamento', margin, y)
  
  y += 6
  
  const methodLabels: Record<string, string> = {
    'CREDIT_CARD': 'Cartão de Crédito',
    'PIX': 'PIX',
    'BOLETO': 'Boleto Bancário',
    'DEBIT_CARD': 'Cartão de Débito',
    'BALANCE': 'Saldo/Créditos'
  }
  
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(80, 80, 80)
  pdf.text(methodLabels[data.method] || data.method, margin, y)

  y += 15

  // Dados do cliente
  pdf.setFillColor(248, 248, 248)
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 35, 3, 3, 'F')
  
  y += 8
  
  pdf.setTextColor(50, 50, 50)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Dados do Cliente', margin + 5, y)
  
  y += 8
  
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(80, 80, 80)
  pdf.text(`Nome: ${data.clientName}`, margin + 5, y)
  
  y += 5
  pdf.text(`E-mail: ${data.clientEmail}`, margin + 5, y)
  
  if (data.clientPhone) {
    y += 5
    pdf.text(`Telefone: ${data.clientPhone}`, margin + 5, y)
  }

  y += 25

  // Informações adicionais
  pdf.setTextColor(130, 130, 130)
  pdf.setFontSize(8)
  pdf.text('Este comprovante é válido como documento fiscal.', margin, y)
  y += 4
  pdf.text('Guarde este comprovante para consultas futuras.', margin, y)

  // Footer
  const footerY = pdf.internal.pageSize.getHeight() - 25
  
  pdf.setFillColor(50, 50, 50)
  pdf.rect(0, footerY, pageWidth, 25, 'F')
  
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Mykaele Procópio Home Spa', margin, footerY + 10)
  
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(200, 200, 200)
  pdf.text('CNPJ: XX.XXX.XXX/0001-XX', margin, footerY + 16)
  pdf.text('mykaprocopio.com.br', margin, footerY + 21)
  
  pdf.text('(85) 99908-6924', pageWidth - margin, footerY + 16, { align: 'right' })
  pdf.text('Fortaleza - CE', pageWidth - margin, footerY + 21, { align: 'right' })

  return pdf.output('blob')
}

export function downloadReceipt(blob: Blob, paymentId: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comprovante-${paymentId}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
