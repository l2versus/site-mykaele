// src/lib/mercadopago.ts
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
})

export async function createPaymentPreference(data: {
  packageOptionId: string
  packageName: string
  price: number
  userId: string
  sessionCount: number
  userEmail?: string
  items?: Array<{
    packageOptionId: string
    name: string
    sessions: number
    price: number
    serviceId?: string
    serviceName: string
  }>
}) {
  try {
    const preference = new Preference(client)

    // Build items array - either from multiple items or single item
    const items = data.items && data.items.length > 0
      ? data.items.map((item, idx) => ({
          id: item.packageOptionId,
          title: `Protocolo: ${item.name}`,
          description: `${item.sessions} sessões de ${item.serviceName}`,
          unit_price: item.price,
          quantity: 1,
          currency_id: 'BRL',
        }))
      : [
          {
            id: data.packageOptionId,
            title: `Pacote: ${data.packageName}`,
            description: `${data.sessionCount} sessões de Arquitetura Corporal`,
            unit_price: data.price,
            quantity: 1,
            currency_id: 'BRL',
          },
        ]

    const result = await preference.create({
      body: {
        items,
        payer: {
          email: data.userEmail || 'cliente@mykaele.com',
          name: 'Cliente Mykaele',
        },
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/cliente/pagamentos/sucesso`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/cliente/pagamentos/sucesso?status=failure`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/cliente/pagamentos/sucesso?status=pending`,
        },
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/api/payments/webhook`,
        // Formato: pkg_userId_optId1,optId2  (suporta multi-item)
        external_reference: `pkg_${data.userId}_${data.items && data.items.length > 0 ? data.items.map(i => i.packageOptionId).join(',') : data.packageOptionId}`,
        auto_return: 'approved',
      },
    })

    return {
      success: true,
      preferenceId: result.id,
      initPoint: result.init_point,
    }
  } catch (error) {
    console.error('Erro ao criar preference do Mercado Pago:', error)
    return {
      success: false,
      error: 'Erro ao criar pagamento',
    }
  }
}

export async function getPaymentStatus(preferenceId: string) {
  try {
    const payment = new Payment(client)
    
    // Search for payments with this preference ID
    const result = await payment.search({
      options: {
        searchUrl: `/v1/payments/search?preference_id=${preferenceId}`,
      },
    })

    const payments = (result.results as any[]) || []
    if (payments.length === 0) {
      return {
        status: 'pending',
        statusDetail: 'Payment not found',
        amount: 0,
        packageOptionId: null,
        paymentId: null,
      }
    }

    const paymentData = payments[0]
    const externalRef = paymentData.external_reference || ''
    // Suporta multi-item: pkg_userId_id1,id2
    const parts = externalRef.split('_')
    const packageOptionId = parts[2] || null

    return {
      status: paymentData.status,
      statusDetail: paymentData.status_detail,
      amount: paymentData.transaction_amount,
      externalReference: externalRef,
      packageOptionId,
      paymentId: paymentData.id,
    }
  } catch (error) {
    console.error('Erro ao obter status do pagamento:', error)
    return {
      status: 'error',
      statusDetail: 'Failed to fetch payment status',
      amount: 0,
      packageOptionId: null,
      paymentId: null,
    }
  }
}

export async function validateWebhookSignature(
  body: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  // Validar assinatura do webhook (opcional mas recomendado)
  // Por enquanto vamos aceitar o webhook como válido
  return true
}

