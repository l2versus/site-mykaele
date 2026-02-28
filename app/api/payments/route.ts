// app/api/payments/route.ts — PROTEGIDO com auth (admin-only para criação manual)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

export async function POST(request: NextRequest) {
  const admin = getAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { userId, amount, method, description, category } = await request.json()

    if (!userId || !amount) {
      return NextResponse.json({ error: 'userId e amount obrigatórios' }, { status: 400 })
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount,
        method: method || 'PIX',
        description: description || null,
        category: category || 'REVENUE',
        status: 'APPROVED',
      },
    })

    return NextResponse.json({ message: 'Pagamento registrado', data: payment }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao registrar pagamento' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const admin = getAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const where = userId ? { userId } : {}

    const payments = await prisma.payment.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ message: 'OK', data: payments }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar pagamentos' }, { status: 500 })
  }
}
