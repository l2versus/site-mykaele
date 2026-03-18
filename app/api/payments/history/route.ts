// app/api/payments/history/route.ts
// Histórico de pagamentos do CLIENTE (não admin).
// Retorna apenas os pagamentos do usuário autenticado.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const decoded = verifyToken(auth)
    if (!decoded?.userId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const statusFilter = searchParams.get('status') // COMPLETED, PENDING, SUSPICIOUS, etc.

    const where: Record<string, unknown> = { userId: decoded.userId }
    if (statusFilter) where.status = statusFilter

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          amount: true,
          method: true,
          gateway: true,
          status: true,
          category: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.payment.count({ where }),
    ])

    // Totais para o sumário
    const summary = await prisma.payment.aggregate({
      where: { userId: decoded.userId, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    })

    return NextResponse.json({
      payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalPaid: summary._sum.amount || 0,
        totalTransactions: summary._count || 0,
      },
    })
  } catch (error) {
    console.error('[PaymentHistory] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }
}
