import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

// POST - Inserir créditos/pacote para o cliente
export async function POST(
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
    const { type, packageOptionId, sessions, balance, serviceId } = body

    // Verificar se o cliente existe
    const client = await prisma.user.findUnique({
      where: { id, role: 'PATIENT' }
    })
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const results: Record<string, unknown> = {}

    // Tipo 1: Adicionar pacote de sessões
    if (type === 'package' && packageOptionId) {
      const pkgOption = await prisma.packageOption.findUnique({
        where: { id: packageOptionId },
        include: { service: true }
      })
      if (!pkgOption) {
        return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 })
      }

      const pkg = await prisma.package.create({
        data: {
          userId: id,
          packageOptionId: pkgOption.id,
          totalSessions: pkgOption.sessions,
          usedSessions: 0,
          status: 'ACTIVE',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }
      })
      results.package = pkg
      results.message = `Pacote "${pkgOption.name}" (${pkgOption.sessions} sessões de ${pkgOption.service.name}) adicionado com sucesso`
    }

    // Tipo 2: Adicionar sessões avulsas
    if (type === 'sessions') {
      if (!serviceId) {
        return NextResponse.json({ error: 'Serviço é obrigatório para sessões avulsas' }, { status: 400 })
      }
      const numSessions = parseInt(sessions) || 1

      let pkgOption = await prisma.packageOption.findFirst({
        where: { serviceId, sessions: numSessions, active: true }
      })

      if (!pkgOption) {
        const service = await prisma.service.findUnique({ where: { id: serviceId } })
        if (!service) {
          return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
        }
        pkgOption = await prisma.packageOption.create({
          data: {
            serviceId,
            name: `${numSessions} sessão(ões) ${service.name} (Admin)`,
            sessions: numSessions,
            price: service.price * numSessions,
            active: true
          }
        })
      }

      const pkg = await prisma.package.create({
        data: {
          userId: id,
          packageOptionId: pkgOption.id,
          totalSessions: numSessions,
          usedSessions: 0,
          status: 'ACTIVE',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }
      })
      results.package = pkg
      results.message = `${numSessions} sessão(ões) adicionada(s) com sucesso`
    }

    // Tipo 3: Adicionar saldo monetário
    if (type === 'balance' && balance !== undefined && balance !== null && balance !== '') {
      const addValue = parseFloat(balance)
      if (isNaN(addValue) || addValue < 0) {
        return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      }
      const newBalance = (client.balance || 0) + addValue
      await prisma.user.update({
        where: { id },
        data: { balance: newBalance }
      })
      results.balance = newBalance
      results.message = results.message
        ? (results.message as string) + ` + R$ ${addValue.toFixed(2)} de saldo`
        : `R$ ${addValue.toFixed(2)} adicionado ao saldo. Novo saldo: R$ ${newBalance.toFixed(2)}`
    }

    // Tipo 4: Definir saldo exato (pode ser 0)
    if (type === 'set_balance' && balance !== undefined && balance !== null && balance !== '') {
      const newValue = parseFloat(balance)
      if (isNaN(newValue) || newValue < 0) {
        return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      }
      await prisma.user.update({
        where: { id },
        data: { balance: newValue }
      })
      results.balance = newValue
      results.message = `Saldo definido para R$ ${newValue.toFixed(2)}`
    }

    if (!results.message) {
      return NextResponse.json({ error: 'Tipo de crédito inválido ou dados incompletos' }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error('POST credits error:', error)
    return NextResponse.json({ error: 'Erro interno ao inserir créditos' }, { status: 500 })
  }
}

// ═══ DELETE — Reset total de dados de teste de um cliente ═══
// Remove: appointments, payments, loyalty, packages, feedbacks, receipts, measures
// NÃO deleta o usuário em si — apenas zera seus dados
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = getAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  try {
    const client = await prisma.user.findUnique({ where: { id, role: 'PATIENT' } })
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    // Buscar IDs de appointments para limpar referências
    const appointments = await prisma.appointment.findMany({
      where: { userId: id },
      select: { id: true },
    })
    const aptIds = appointments.map(a => a.id)

    // Limpar tudo em ordem (evitar FK violations)
    const cleaned: string[] = []

    // Digital receipts referenciando appointments
    if (aptIds.length > 0) {
      const r1 = await prisma.digitalReceipt.deleteMany({ where: { appointmentId: { in: aptIds } } })
      if (r1.count) cleaned.push(`${r1.count} recibos digitais`)

      const r2 = await prisma.sessionFeedback.deleteMany({ where: { appointmentId: { in: aptIds } } })
      if (r2.count) cleaned.push(`${r2.count} feedbacks`)
    }

    // Payments (vinculados a appointments E avulsos)
    const r3 = await prisma.payment.deleteMany({ where: { userId: id } })
    if (r3.count) cleaned.push(`${r3.count} pagamentos`)

    // Loyalty
    const r4 = await prisma.loyaltyTransaction.deleteMany({ where: { userId: id } })
    if (r4.count) cleaned.push(`${r4.count} transações de fidelidade`)

    await prisma.loyaltyPoints.deleteMany({ where: { userId: id } })
    cleaned.push('pontos de fidelidade zerados')

    // Packages
    const r6 = await prisma.package.deleteMany({ where: { userId: id } })
    if (r6.count) cleaned.push(`${r6.count} pacotes`)

    // Body measurements
    const r7 = await prisma.bodyMeasurement.deleteMany({ where: { userId: id } })
    if (r7.count) cleaned.push(`${r7.count} medições`)

    // Appointments
    const r8 = await prisma.appointment.deleteMany({ where: { userId: id } })
    if (r8.count) cleaned.push(`${r8.count} agendamentos`)

    // Zerar saldo
    await prisma.user.update({
      where: { id },
      data: { balance: 0, cashbackBalance: 0 },
    })
    cleaned.push('saldo zerado')

    return NextResponse.json({
      success: true,
      message: `Reset completo de ${client.name}: ${cleaned.join(', ')}`,
      cleaned,
    })
  } catch (error) {
    console.error('DELETE reset error:', error)
    return NextResponse.json({ error: 'Erro no reset' }, { status: 500 })
  }
}
