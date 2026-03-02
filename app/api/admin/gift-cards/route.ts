import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const user = verifyToken(auth.substring(7))
  return user?.role === 'ADMIN' ? user : null
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'GC-'
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function GET(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const cards = await prisma.giftCard.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ cards })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  try {
    const { amount, recipientName, recipientEmail, recipientPhone, message, expiresAt, purchaserId } = await req.json()
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Valor obrigatorio' }, { status: 400 })
    const code = generateCode()
    const card = await prisma.giftCard.create({
      data: {
        code, amount, balance: amount,
        purchaserId: purchaserId || null,
        recipientName: recipientName || null,
        recipientEmail: recipientEmail || null,
        recipientPhone: recipientPhone || null,
        message: message || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })
    return NextResponse.json({ card }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  try {
    const { id, status, balance } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID obrigatorio' }, { status: 400 })
    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (balance !== undefined) data.balance = balance
    const card = await prisma.giftCard.update({ where: { id }, data })
    return NextResponse.json({ card })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

// Validate / Redeem gift card by code
export async function PATCH(req: NextRequest) {
  try {
    const { code, userId, amount: useAmount } = await req.json()
    if (!code) return NextResponse.json({ error: 'Codigo obrigatorio' }, { status: 400 })
    const card = await prisma.giftCard.findUnique({ where: { code } })
    if (!card) return NextResponse.json({ error: 'Gift card nao encontrado' }, { status: 404 })
    if (card.status !== 'ACTIVE') return NextResponse.json({ error: 'Gift card inativo' }, { status: 400 })
    if (card.expiresAt && new Date(card.expiresAt) < new Date()) {
      await prisma.giftCard.update({ where: { id: card.id }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ error: 'Gift card expirado' }, { status: 400 })
    }
    if (useAmount && useAmount > card.balance) return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
    const amountToUse = useAmount || card.balance
    const newBalance = card.balance - amountToUse
    const data: Record<string, unknown> = { balance: newBalance }
    if (newBalance <= 0) data.status = 'USED'
    if (userId) { data.redeemedById = userId; data.redeemedAt = new Date() }
    const updated = await prisma.giftCard.update({ where: { id: card.id }, data })
    return NextResponse.json({ card: updated, amountUsed: amountToUse })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
