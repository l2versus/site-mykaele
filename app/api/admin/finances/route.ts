import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'month'
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const now = new Date()
    let from: Date, to: Date

    if (fromParam && toParam) {
      from = new Date(fromParam)
      to = new Date(toParam + 'T23:59:59')
    } else if (period === 'week') {
      const dayOfWeek = now.getDay()
      from = new Date(now)
      from.setDate(now.getDate() - dayOfWeek)
      from.setHours(0, 0, 0, 0)
      to = new Date(from)
      to.setDate(from.getDate() + 6)
      to.setHours(23, 59, 59, 999)
    } else if (period === 'year') {
      from = new Date(now.getFullYear(), 0, 1)
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }

    const [revenue, expenses, payments, expenseList] = await Promise.all([
      prisma.payment.aggregate({
        where: { category: 'REVENUE', createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { category: 'REVENUE', createdAt: { gte: from, lte: to } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: { date: { gte: from, lte: to } },
        orderBy: { date: 'desc' },
      }),
    ])

    const totalRevenue = revenue._sum.amount || 0
    const totalExpenses = expenses._sum.amount || 0

    return NextResponse.json({
      totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
      payments,
      expenses: expenseList,
    })
  } catch (error) {
    console.error('Finances GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados financeiros' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { type } = body

    // Add manual revenue (payment)
    if (type === 'revenue') {
      const { description, amount, method } = body
      if (!description || !amount) {
        return NextResponse.json({ error: 'Campos obrigatórios: description, amount' }, { status: 400 })
      }
      // Create a payment without userId (admin manual entry)
      // We need a userId - use admin's own id or find/create a generic user
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
      if (!adminUser) return NextResponse.json({ error: 'Admin user not found' }, { status: 500 })
      const payment = await prisma.payment.create({
        data: {
          userId: adminUser.id,
          amount: parseFloat(String(amount)),
          method: method || 'PIX',
          description,
          category: 'REVENUE',
          status: 'APPROVED',
        },
      })
      return NextResponse.json({ payment })
    }

    // Add expense (default)
    const { description, amount, category, date } = body
    if (!description || !amount || !category) {
      return NextResponse.json({ error: 'Campos obrigatórios: description, amount, category' }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: { description, amount: parseFloat(String(amount)), category, date: date ? new Date(date) : new Date() },
    })
    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Finances POST error:', error)
    return NextResponse.json({ error: 'Erro ao adicionar registro' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const itemType = searchParams.get('type') // 'expense' or 'payment'

    if (!id || !itemType) {
      return NextResponse.json({ error: 'id e type são obrigatórios' }, { status: 400 })
    }

    if (itemType === 'expense') {
      await prisma.expense.delete({ where: { id } })
    } else if (itemType === 'payment') {
      await prisma.payment.delete({ where: { id } })
    } else {
      return NextResponse.json({ error: 'type inválido' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Finances DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao deletar registro' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const itemType = searchParams.get('type')

    if (!id || !itemType) {
      return NextResponse.json({ error: 'id e type são obrigatórios' }, { status: 400 })
    }

    const body = await req.json()

    if (itemType === 'expense') {
      const data: Record<string, unknown> = {}
      if (body.description !== undefined) data.description = body.description
      if (body.amount !== undefined) data.amount = parseFloat(String(body.amount))
      if (body.category !== undefined) data.category = body.category
      if (body.date !== undefined) data.date = new Date(body.date)

      const expense = await prisma.expense.update({ where: { id }, data })
      return NextResponse.json({ expense })
    } else if (itemType === 'payment') {
      const data: Record<string, unknown> = {}
      if (body.description !== undefined) data.description = body.description
      if (body.amount !== undefined) data.amount = parseFloat(String(body.amount))
      if (body.method !== undefined) data.method = body.method

      const payment = await prisma.payment.update({ where: { id }, data })
      return NextResponse.json({ payment })
    }

    return NextResponse.json({ error: 'type inválido' }, { status: 400 })
  } catch (error) {
    console.error('Finances PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar registro' }, { status: 500 })
  }
}
