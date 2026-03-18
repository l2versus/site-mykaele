// src/lib/payments/credit.ts
// Função compartilhada de ativação de pacotes + registro de pagamento.
// Usada pelo webhook (server-to-server) e pela rota success (client-side fallback).
import { prisma } from '@/lib/prisma'
import { sendPurchaseNotification } from '@/lib/whatsapp'

interface CreditResult {
  success: boolean
  packageIds: string[]
  error?: string
}

/**
 * Ativa pacotes comprados e registra o pagamento no banco.
 * Idempotente: se o pacote já está ACTIVE ou o payment já existe, não duplica.
 *
 * @param userId          ID do usuário comprador
 * @param packageOptionIds IDs dos PackageOption comprados
 * @param paidAmount      Valor pago (em R$)
 * @param paymentRef      Referência única do pagamento (mpid:123 ou MP:prefId)
 * @param method          Método de pagamento (MERCADO_PAGO, PIX, etc.)
 * @param gateway         Gateway usado (MERCADO_PAGO, INFINITEPAY, etc.)
 */
export async function activatePackagesAndRecord(opts: {
  userId: string
  packageOptionIds: string[]
  paidAmount: number
  paymentRef: string
  method?: string
  gateway?: string
}): Promise<CreditResult> {
  const { userId, packageOptionIds, paidAmount, paymentRef, method = 'MERCADO_PAGO', gateway } = opts

  if (!userId || packageOptionIds.length === 0) {
    return { success: false, packageIds: [], error: 'userId e packageOptionIds obrigatórios' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return { success: false, packageIds: [], error: 'Usuário não encontrado' }
  }

  // --- Ativar pacotes (idempotente) ---
  const created: string[] = []
  for (const poId of packageOptionIds) {
    const existing = await prisma.package.findFirst({
      where: { userId, packageOptionId: poId, status: 'ACTIVE' },
    })
    if (existing) {
      created.push(existing.id)
      continue
    }

    const packageOption = await prisma.packageOption.findUnique({
      where: { id: poId },
      select: { id: true, sessions: true },
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

  // --- Registrar pagamento (idempotente via paymentRef) ---
  const paymentExists = await prisma.payment.findFirst({
    where: { userId, description: { contains: paymentRef } },
  })
  if (!paymentExists) {
    await prisma.payment.create({
      data: {
        userId,
        amount: paidAmount,
        method,
        gateway: gateway || undefined,
        status: 'COMPLETED',
        description: `${paymentRef} - ${created.length} pacote(s) ativado(s)`,
        category: 'REVENUE',
      },
    })
  }

  // --- Notificar via WhatsApp (fire-and-forget) ---
  const allOptions = await prisma.packageOption.findMany({
    where: { id: { in: packageOptionIds } },
    include: { service: true },
  })

  sendPurchaseNotification({
    clientName: user.name || 'Cliente',
    clientPhone: user.phone,
    clientEmail: user.email,
    items: allOptions.map(po => ({
      name: `${po.service.name} - ${po.sessions} sessões`,
      sessions: po.sessions,
      price: po.price,
    })),
    totalAmount: paidAmount,
    paymentMethod: method,
    paymentId: paymentRef,
    transactionDate: new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }),
  }).catch(() => {})

  return { success: true, packageIds: created }
}

/**
 * Valida se o valor pago confere com o esperado (soma dos PackageOptions).
 * Retorna { valid, expected } — tolerância de R$0,50 para arredondamentos.
 */
export async function validatePaymentAmount(
  packageOptionIds: string[],
  paidAmount: number,
): Promise<{ valid: boolean; expected: number }> {
  let expected = 0
  for (const poId of packageOptionIds) {
    const po = await prisma.packageOption.findUnique({ where: { id: poId } })
    if (po) expected += po.price
  }
  const tolerance = 0.5
  return { valid: Math.abs(paidAmount - expected) <= tolerance, expected }
}
