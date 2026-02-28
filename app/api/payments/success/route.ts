import { NextRequest, NextResponse } from 'next/server'
import { getPaymentStatus } from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Auth consistente com o resto do app (Bearer token)
    const auth = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const decoded = verifyToken(auth)
    if (!decoded || !decoded.userId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const userId = decoded.userId

    // Get preference ID from query params
    const preferenceId = request.nextUrl.searchParams.get('preference_id')
    if (!preferenceId) return NextResponse.json({ error: 'Missing preference_id' }, { status: 400 })

    // Get payment status from Mercado Pago
    const result = await getPaymentStatus(preferenceId)
    
    if (result.status !== 'approved') {
      return NextResponse.json({ 
        error: 'Pagamento não aprovado',
        status: result.status 
      }, { status: 400 })
    }

    // Extrair packageOptionIds do external_reference (suporta multi-item: pkg_userId_id1,id2)
    const externalRef = result.externalReference || ''
    const parts = externalRef.split('_')
    const packageOptionIds = parts[2] ? parts[2].split(',') : []

    if (packageOptionIds.length === 0) {
      return NextResponse.json({ error: 'Dados de pagamento inválidos' }, { status: 400 })
    }

    // Processar cada packageOptionId
    const createdPackages = []
    for (const poId of packageOptionIds) {
      // Verificar duplicata (evitar ativar 2x)
      const existing = await prisma.package.findFirst({
        where: { userId, packageOptionId: poId, status: 'ACTIVE' },
      })
      if (existing) {
        createdPackages.push(existing)
        continue
      }

      const packageOption = await prisma.packageOption.findUnique({
        where: { id: poId },
        select: { id: true, sessions: true, serviceId: true, service: { select: { id: true, name: true } } },
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
        include: { packageOption: { include: { service: true } } },
      })
      createdPackages.push(pkg)
    }

    // Criar registro de pagamento (verificar duplicata)
    const paymentExists = await prisma.payment.findFirst({
      where: { userId, description: { contains: preferenceId } },
    })
    if (!paymentExists) {
      await prisma.payment.create({
        data: {
          userId,
          amount: result.amount || 0,
          method: 'MERCADO_PAGO',
          status: 'COMPLETED',
          description: `MP:${preferenceId} - ${createdPackages.length} pacote(s)`,
          category: 'REVENUE',
        },
      })
    }

    return NextResponse.json({ 
      success: true,
      packages: createdPackages,
      count: createdPackages.length,
      message: 'Pacote(s) ativado(s) com sucesso'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Falha ao processar confirmação de pagamento' },
      { status: 500 }
    )
  }
}
