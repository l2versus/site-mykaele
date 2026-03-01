import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

// GET — retorna clientes com telefone para o broadcast
export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const clients = await prisma.user.findMany({
      where: {
        role: 'PATIENT',
        phone: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: { select: { appointments: true } },
      },
      orderBy: { name: 'asc' },
    })

    // Filtrar apenas quem tem telefone válido (pelo menos 8 dígitos)
    const withPhone = clients.filter(c => {
      const digits = (c.phone || '').replace(/\D/g, '')
      return digits.length >= 8
    })

    return NextResponse.json({ clients: withPhone })
  } catch (error) {
    console.error('Broadcast GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
  }
}
