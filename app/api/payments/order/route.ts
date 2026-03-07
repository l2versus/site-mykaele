import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const decoded = verifyToken(auth)
    if (!decoded?.userId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { items } = await request.json()
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Itens obrigatórios' }, { status: 400 })
    }

    const totalAmount = items.reduce((sum: number, i: { price: number }) => sum + (Number(i.price) || 0), 0)
    const description = items
      .map((i: { name: string; sessions: number }) => `${i.name} (${i.sessions}x)`)
      .join(', ')

    const payment = await prisma.payment.create({
      data: {
        userId: decoded.userId,
        amount: totalAmount,
        method: 'IN_PERSON',
        status: 'PENDING',
        category: 'REVENUE',
        description: `Pedido p/ atendimento: ${description}`,
      },
    })

    return NextResponse.json({ success: true, orderId: payment.id })
  } catch (error) {
    console.error('Order error:', error)
    return NextResponse.json({ error: 'Erro ao registrar pedido' }, { status: 500 })
  }
}
