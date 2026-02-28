// app/api/payments/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
})

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

    // Fetch payment details from Mercado Pago
    const paymentClient = new Payment(mpClient)
    const paymentData = await paymentClient.get({ id: paymentId })

    // Only process approved payments
    if (paymentData.status !== 'approved') {
      return NextResponse.json({ status: 'ok', message: 'Non-approved payment' })
    }

    // Extract user ID and package option IDs from external reference
    // Format: pkg_userId_optId1,optId2,optId3
    const externalRef = paymentData.external_reference || ''
    const parts = externalRef.split('_')
    const userId = parts[1]
    const packageOptionIds = parts[2] ? parts[2].split(',') : []

    if (!userId || packageOptionIds.length === 0) {
      return NextResponse.json({ status: 'error', message: 'Invalid payment reference' }, { status: 400 })
    }

    // Processar cada packageOptionId
    const created: string[] = []
    for (const poId of packageOptionIds) {
      // Verificar duplicata
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
          amount: paymentData.transaction_amount || 0,
          method: 'MERCADO_PAGO',
          status: 'COMPLETED',
          description: `mpid:${paymentId} - ${created.length} pacote(s)`,
          category: 'REVENUE',
        },
      })
    }

    return NextResponse.json({
      status: 'success',
      message: `${created.length} package(s) activated via webhook`,
      packageIds: created,
    })

  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    )
  }
}
