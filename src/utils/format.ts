/** Labels amigáveis para métodos de pagamento (Payment.method) */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão Crédito',
  CARTAO_DEBITO: 'Cartão Débito',
  TRANSFERENCIA: 'Transferência',
  IN_PERSON: 'Na Clínica',
  ONLINE: 'Site (Mercado Pago)',
  MERCADO_PAGO: 'Site (Mercado Pago)',
  CREDIT_CARD: 'Cartão Crédito',
  DEBIT_CARD: 'Cartão Débito',
}

/** Labels amigáveis para gateways/maquininhas (Payment.gateway) */
const GATEWAY_LABELS: Record<string, string> = {
  INFINITEPAY: 'InfinitePay',
  MERCADO_PAGO: 'Mercado Pago',
  STONE: 'Stone',
  SUMUP: 'SumUp',
  PAGSEGURO: 'PagSeguro',
  CASH: 'Dinheiro',
  OUTRO: 'Outro',
}

/** Converte o enum do banco para label legível. Ex: IN_PERSON → "Na Clínica" */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return '-'
  return PAYMENT_METHOD_LABELS[method] || method
}

/** Converte o enum do gateway para label legível. Ex: INFINITEPAY → "InfinitePay" */
export function formatGateway(gateway: string | null | undefined): string {
  if (!gateway) return ''
  return GATEWAY_LABELS[gateway] || gateway
}

/**
 * Exibição completa: método + gateway quando existir.
 * Ex: "Cartão Crédito (InfinitePay)", "Na Clínica", "Site (Mercado Pago)"
 */
export function formatPaymentDisplay(method: string | null | undefined, gateway?: string | null): string {
  const methodLabel = formatPaymentMethod(method)
  if (!gateway) return methodLabel
  const gatewayLabel = formatGateway(gateway)
  return `${methodLabel} (${gatewayLabel})`
}
