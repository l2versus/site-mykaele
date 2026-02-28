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
    const clients = await prisma.user.findMany({
      where: { role: 'PATIENT' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpfRg: true,
        address: true,
        balance: true,
        createdAt: true,
        _count: { select: { appointments: true, packages: true } },
        packages: {
          where: { status: 'ACTIVE' },
          select: { id: true, totalSessions: true, usedSessions: true, packageOption: { select: { name: true } } },
        },
        appointments: {
          orderBy: { scheduledAt: 'desc' },
          take: 3,
          select: { id: true, scheduledAt: true, status: true, service: { select: { name: true } } },
        },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = clients.map(c => ({
      ...c,
      totalSpent: c.payments.reduce((sum, p) => sum + p.amount, 0),
      payments: undefined,
    }))

    return NextResponse.json({ clients: formatted })
  } catch (error) {
    console.error('Clients GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
  }
}
