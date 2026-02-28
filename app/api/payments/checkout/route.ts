// app/api/payments/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPaymentPreference } from '@/lib/mercadopago'
import { verifyToken } from '@/lib/auth'

interface CartItem {
  packageOptionId: string
  name: string
  sessions: number
  price: number
  serviceId?: string
  serviceName: string
}

export async function POST(request: NextRequest) {
  try {
    // Validar token
    const auth = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const decoded = verifyToken(auth)
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const body = await request.json()
    const { packageOptionId, packageOptionIds, items } = body

    // Handle single item or multiple items (cart)
    let itemsToProcess: CartItem[] = []
    
    if (items && Array.isArray(items) && items.length > 0) {
      // Multiple items from cart
      itemsToProcess = items
    } else if (packageOptionId) {
      // Single item - fetch from DB
      const packageOption = await prisma.packageOption.findUnique({
        where: { id: packageOptionId },
        include: { service: true },
      })

      if (!packageOption) {
        return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 })
      }

      itemsToProcess = [
        {
          packageOptionId: packageOption.id,
          name: packageOption.name,
          sessions: packageOption.sessions,
          price: packageOption.price,
          serviceId: packageOption.serviceId,
          serviceName: packageOption.service.name,
        },
      ]
    } else {
      return NextResponse.json({ error: 'Dados de compra ausentes' }, { status: 400 })
    }

    // Buscar usuário para email
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Calculate total
    const totalPrice = itemsToProcess.reduce((sum, item) => sum + item.price, 0)
    const totalSessions = itemsToProcess.reduce((sum, item) => sum + item.sessions, 0)

    // Create a combined preference for multiple items
    const preference = await createPaymentPreference({
      packageOptionId: itemsToProcess.map(i => i.packageOptionId).join(','),
      packageName: itemsToProcess.length === 1 
        ? itemsToProcess[0].name 
        : `Pacote com ${itemsToProcess.length} protocolos`,
      price: totalPrice,
      userId: decoded.userId,
      sessionCount: totalSessions,
      userEmail: user.email,
      items: itemsToProcess,
    })

    if (!preference.success) {
      return NextResponse.json({ error: preference.error }, { status: 500 })
    }

    return NextResponse.json({
      preferenceId: preference.preferenceId,
      checkoutUrl: preference.initPoint,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar pagamento' },
      { status: 500 }
    )
  }
}
