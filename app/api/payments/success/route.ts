import { NextRequest, NextResponse } from 'next/server'
import { getPaymentStatus } from '@/lib/mercadopago'
import { verifyToken } from '@/lib/auth'
import { activatePackagesAndRecord } from '@/lib/payments/credit'

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

    // Ativar pacotes + registrar pagamento + notificar WhatsApp
    const creditResult = await activatePackagesAndRecord({
      userId,
      packageOptionIds,
      paidAmount: result.amount || 0,
      paymentRef: `MP:${preferenceId}`,
      method: 'MERCADO_PAGO',
      gateway: 'MERCADO_PAGO',
    })

    if (!creditResult.success) {
      return NextResponse.json({ error: creditResult.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      packages: creditResult.packageIds,
      count: creditResult.packageIds.length,
      message: 'Pacote(s) ativado(s) com sucesso'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Falha ao processar confirmação de pagamento' },
      { status: 500 }
    )
  }
}
