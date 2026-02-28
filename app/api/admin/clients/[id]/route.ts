import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

// GET - Buscar cliente específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = getAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  try {
    const client = await prisma.user.findUnique({
      where: { id, role: 'PATIENT' },
      include: {
        appointments: {
          include: { service: true },
          orderBy: { scheduledAt: 'desc' },
          take: 10
        },
        packages: {
          include: { packageOption: true },
          where: { status: 'ACTIVE' }
        }
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('GET client error:', error)
    return NextResponse.json({ error: 'Erro ao buscar cliente' }, { status: 500 })
  }
}

// PATCH - Atualizar cliente
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = getAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { name, email, phone, cpf, address, balance } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e email são obrigatórios' }, { status: 400 })
    }

    // Verificar se email já existe em outro usuário
    const existingUser = await prisma.user.findFirst({
      where: { email, id: { not: id } }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Este email já está em uso por outro usuário' }, { status: 400 })
    }

    const updatedClient = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        phone: phone || null,
        cpfRg: cpf || null,
        address: address || null,
        balance: typeof balance === 'number' ? balance : parseFloat(balance) || 0,
      }
    })

    return NextResponse.json({ success: true, client: updatedClient })
  } catch (error) {
    console.error('PATCH client error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 })
  }
}

// DELETE - Excluir cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = getAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  try {
    const client = await prisma.user.findUnique({
      where: { id },
      include: {
        appointments: {
          where: { status: { in: ['PENDING', 'CONFIRMED'] } }
        }
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    if (client.appointments.length > 0) {
      return NextResponse.json({
        error: 'Não é possível excluir cliente com agendamentos pendentes'
      }, { status: 400 })
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE client error:', error)
    return NextResponse.json({ error: 'Erro ao excluir cliente' }, { status: 500 })
  }
}
