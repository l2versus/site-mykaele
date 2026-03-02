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
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const appointmentId = searchParams.get('appointmentId')
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}
    if (appointmentId) where.appointmentId = appointmentId
    if (userId) where.userId = userId

    const receipts = await prisma.digitalReceipt.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 50,
    })
    return NextResponse.json({ receipts })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  try {
    const { appointmentId, userId, content, totalAmount, paymentMethod, splitDetails } = await req.json()
    if (!appointmentId || !userId) return NextResponse.json({ error: 'Campos obrigatorios' }, { status: 400 })

    const receipt = await prisma.digitalReceipt.create({
      data: {
        appointmentId, userId,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        totalAmount: totalAmount || 0,
        paymentMethod: paymentMethod || null,
        splitDetails: splitDetails ? JSON.stringify(splitDetails) : null,
        signedAt: new Date(),
      },
    })
    return NextResponse.json({ receipt }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro'
    if (msg.includes('Unique')) return NextResponse.json({ error: 'Comanda ja existe para este agendamento' }, { status: 409 })
    return NextResponse.json({ error: 'Erro ao criar comanda' }, { status: 500 })
  }
}
