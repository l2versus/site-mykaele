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
  const errors: string[] = []

  try {
    const client = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true }
    })

    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Verificar agendamentos pendentes
    const pendingAppts = await prisma.appointment.count({
      where: { userId: id, status: { in: ['PENDING', 'CONFIRMED'] } }
    })
    if (pendingAppts > 0) {
      return NextResponse.json({
        error: 'Não é possível excluir cliente com agendamentos pendentes'
      }, { status: 400 })
    }

    // ═══ Limpar registros relacionados (cada um com try/catch individual) ═══
    const cleanups: Array<{ name: string; fn: () => Promise<unknown> }> = [
      { name: 'loyaltyTransaction', fn: () => prisma.loyaltyTransaction.deleteMany({ where: { userId: id } }) },
      { name: 'loyaltyPoints', fn: () => prisma.loyaltyPoints.deleteMany({ where: { userId: id } }) },
      { name: 'referral_referrer', fn: () => prisma.referral.deleteMany({ where: { referrerId: id } }) },
      { name: 'referral_referred', fn: () => prisma.referral.deleteMany({ where: { referredUserId: id } }) },
      { name: 'referralCode', fn: () => prisma.referralCode.deleteMany({ where: { userId: id } }) },
      { name: 'anamnese', fn: () => prisma.anamnese.deleteMany({ where: { userId: id } }) },
      { name: 'bodyMeasurement', fn: () => prisma.bodyMeasurement.deleteMany({ where: { userId: id } }) },
      { name: 'sessionFeedback', fn: () => prisma.sessionFeedback.deleteMany({ where: { userId: id } }) },
      { name: 'waitlist', fn: () => prisma.waitlist.deleteMany({ where: { userId: id } }) },
      { name: 'digitalReceipt', fn: () => prisma.digitalReceipt.deleteMany({ where: { userId: id } }) },
      { name: 'emailVerificationToken', fn: () => prisma.emailVerificationToken.deleteMany({ where: { userId: id } }) },
      { name: 'giftCard_purchaser', fn: () => prisma.giftCard.updateMany({ where: { purchaserId: id }, data: { purchaserId: null } }) },
      { name: 'giftCard_redeemed', fn: () => prisma.giftCard.updateMany({ where: { redeemedById: id }, data: { redeemedById: null } }) },
    ]

    for (const cleanup of cleanups) {
      try {
        await cleanup.fn()
      } catch (e) {
        errors.push(`${cleanup.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ═══ Deletar o usuário (cascade deleta appointments, packages, payments) ═══
    try {
      await prisma.user.delete({ where: { id } })
    } catch (prismaErr) {
      // Fallback: deletar via SQL direto
      console.error('Prisma delete failed, trying raw SQL:', prismaErr)
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "Appointment" WHERE "userId" = '${id}'`)
        await prisma.$executeRawUnsafe(`DELETE FROM "Package" WHERE "userId" = '${id}'`)
        await prisma.$executeRawUnsafe(`DELETE FROM "Payment" WHERE "userId" = '${id}'`)
        await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = '${id}'`)
      } catch (rawErr) {
        const msg = rawErr instanceof Error ? rawErr.message : String(rawErr)
        console.error('Raw SQL delete also failed:', msg)
        return NextResponse.json(
          { error: 'Erro ao excluir cliente', detail: msg, cleanupErrors: errors },
          { status: 500 }
        )
      }
    }

    if (errors.length > 0) {
      console.warn('DELETE client cleanup warnings:', errors)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('DELETE client error:', { id, message: errMsg, cleanupErrors: errors })
    return NextResponse.json(
      { error: 'Erro ao excluir cliente', detail: errMsg, cleanupErrors: errors },
      { status: 500 }
    )
  }
}
