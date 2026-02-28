// src/utils/payment-calculator.ts

interface PaymentBreakdown {
  originalAmount: number
  cardFee: number
  tax: number
  productCost: number
  professionalCommission: number
  clinicRevenue: number
}

/**
 * Calcula o split de pagamento
 * Fórmula: Original - CardFee - Tax - ProductCost = ProfessionalCommission + ClinicRevenue
 */
export function calculatePaymentSplit(
  originalAmount: number,
  cardFeePercentage: number = 2.99, // Taxa média de cartão
  taxPercentage: number = 3, // ICMS/ISS aproximado
  productCost: number = 0,
  professionalCommissionPercentage: number = 40 // O profissional recebe 40%
): PaymentBreakdown {
  const cardFee = originalAmount * (cardFeePercentage / 100)
  const tax = originalAmount * (taxPercentage / 100)
  
  const netAmount = originalAmount - cardFee - tax - productCost
  const professionalCommission = netAmount * (professionalCommissionPercentage / 100)
  const clinicRevenue = netAmount - professionalCommission

  return {
    originalAmount,
    cardFee: Math.round(cardFee * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    productCost,
    professionalCommission: Math.round(professionalCommission * 100) / 100,
    clinicRevenue: Math.round(clinicRevenue * 100) / 100,
  }
}

/**
 * Formata valores monetários para BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Retorna relatório financeiro para período
 */
export function generateFinancialReport(payments: Array<{ amount: number; cardFee: number; tax: number; productCost: number; professionalCommission: number }>) {
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
  const totalFees = payments.reduce((sum, p) => sum + p.cardFee + p.tax, 0)
  const totalProductCost = payments.reduce((sum, p) => sum + p.productCost, 0)
  const totalCommissions = payments.reduce((sum, p) => sum + p.professionalCommission, 0)

  return {
    totalRevenue,
    totalFees,
    totalProductCost,
    totalCommissions,
    clinicNetRevenue: totalRevenue - totalFees - totalProductCost - totalCommissions,
    averageTicket: totalRevenue / payments.length,
    paymentCount: payments.length,
  }
}
