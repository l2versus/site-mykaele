// app/api/payments/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createHmac } from 'crypto'

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
})

/**
 * Valida assinatura HMAC do webhook do Mercado Pago.
 * Header x-signature: ts=<timestamp>,v1=<hmac>
 * Manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 */
function verifyWebhookSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret) {
    // Se não configurou secret, loga warning mas aceita (fallback - ainda valida via API do MP)
    console.warn('[Webhook] MERCADO_PAGO_WEBHOOK_SECRET não configurado. Usando validação via API apenas.')
    return true
  }

  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  if (!xSignature || !xRequestId) {
    console.error('[Webhook] Headers x-signature ou x-request-id ausentes')
    return false
  }

  // Parse x-signature: ts=123456,v1=abc123...
  const parts: Record<string, string> = {}
  xSignature.split(',').forEach(part => {
    const [key, value] = part.split('=', 2)
    if (key && value) parts[key.trim()] = value.trim()
  })

  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) {
    console.error('[Webhook] Formato x-signature inválido')
    return false
  }

  // Proteção contra replay: rejeitar webhooks com mais de 5 minutos
  const webhookTime = parseInt(ts, 10) * 1000
  const now = Date.now()
  if (Math.abs(now - webhookTime) > 5 * 60 * 1000) {
    console.error('[Webhook] Timestamp muito antigo (possível replay)')
    return false
  }

  // Montar manifest e calcular HMAC
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hmac = createHmac('sha256', secret).update(manifest).digest('hex')

  if (hmac !== v1) {
    console.error('[Webhook] Assinatura HMAC inválida')
    return false
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Only process payment notifications
    if (body.type !== 'payment') {
      return NextResponse.json({ status: 'ok' })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ status: 'ok' })
    }

    // Validar assinatura HMAC do Mercado Pago
    if (!verifyWebhookSignature(request, String(paymentId))) {
      console.error('[Webhook] Assinatura inválida - possível fraude. paymentId:', paymentId)
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 403 })
    }

    // Fetch payment details from Mercado Pago (validação primária - busca direto na API do MP)
    const paymentClient = new Payment(mpClient)
    const paymentData = await paymentClient.get({ id: paymentId })

    // Only process approved payments
    if (paymentData.status !== 'approved') {
      return NextResponse.json({ status: 'ok', message: `Payment status: ${paymentData.status}` })
    }

    // Extract user ID and package option IDs from external reference
    // Format: pkg_userId_optId1,optId2,optId3
    const externalRef = paymentData.external_reference || ''
    const parts = externalRef.split('_')
    const userId = parts[1]
    const packageOptionIds = parts[2] ? parts[2].split(',') : []

    if (!userId || packageOptionIds.length === 0) {
      console.error('[Webhook] Referência inválida:', externalRef)
      return NextResponse.json({ status: 'error', message: 'Invalid payment reference' }, { status: 400 })
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      console.error('[Webhook] Usuário não encontrado:', userId)
      return NextResponse.json({ status: 'error', message: 'User not found' }, { status: 400 })
    }

    // Verificar valor pago vs valor esperado dos pacotes
    let expectedTotal = 0
    for (const poId of packageOptionIds) {
      const po = await prisma.packageOption.findUnique({ where: { id: poId } })
      if (po) expectedTotal += po.price
    }

    const paidAmount = paymentData.transaction_amount || 0
    const tolerance = 0.5 // Tolerância de R$0,50 para arredondamentos
    if (Math.abs(paidAmount - expectedTotal) > tolerance) {
      console.error(`[Webhook] ALERTA: Valor pago R$${paidAmount} ≠ esperado R$${expectedTotal}. PaymentId: ${paymentId}`)
      // Registrar como suspeito mas NÃO ativar pacotes
      await prisma.payment.create({
        data: {
          userId,
          amount: paidAmount,
          method: 'MERCADO_PAGO',
          status: 'SUSPICIOUS',
          description: `mpid:${paymentId} - VALOR DIVERGENTE: pago=${paidAmount} esperado=${expectedTotal}`,
          category: 'REVENUE',
        },
      })
      return NextResponse.json({ status: 'error', message: 'Amount mismatch' }, { status: 400 })
    }

    // Processar cada packageOptionId
    const created: string[] = []
    for (const poId of packageOptionIds) {
      // Verificar duplicata (evita ativação dupla por replay)
      const existing = await prisma.package.findFirst({
        where: { userId, packageOptionId: poId, status: 'ACTIVE' },
      })
      if (existing) {
        created.push(existing.id)
        continue
      }

      const packageOption = await prisma.packageOption.findUnique({
        where: { id: poId },
        select: { id: true, sessions: true, service: { select: { name: true } } },
      })
      if (!packageOption) continue

      const pkg = await prisma.package.create({
        data: {
          userId,
          packageOptionId: poId,
          totalSessions: packageOption.sessions,
          usedSessions: 0,
          status: 'ACTIVE',
        },
      })
      created.push(pkg.id)
    }

    // Registro de pagamento (verificar duplicata pelo paymentId do MP)
    const paymentExists = await prisma.payment.findFirst({
      where: { userId, description: { contains: `mpid:${paymentId}` } },
    })
    if (!paymentExists) {
      await prisma.payment.create({
        data: {
          userId,
          amount: paidAmount,
          method: 'MERCADO_PAGO',
          status: 'COMPLETED',
          description: `mpid:${paymentId} - ${created.length} pacote(s) ativado(s)`,
          category: 'REVENUE',
        },
      })
    }

    console.log(`[Webhook] Pagamento aprovado: R$${paidAmount} - ${created.length} pacote(s) para user ${userId}`)

    return NextResponse.json({
      status: 'success',
      message: `${created.length} package(s) activated via webhook`,
      packageIds: created,
    })

  } catch (error) {
    console.error('[Webhook] Erro:', error)
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    )
  }
}
