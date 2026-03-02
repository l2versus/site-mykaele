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
    const status = searchParams.get('status') || undefined
    const items = await prisma.waitlist.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
    // enrich with user and service names
    const userIds = [...new Set(items.map(i => i.userId))]
    const serviceIds = [...new Set(items.map(i => i.serviceId))]
    const [users, services] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, phone: true, email: true } }),
      prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }),
    ])
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))
    const svcMap = Object.fromEntries(services.map(s => [s.id, s]))
    const enriched = items.map(i => ({ ...i, user: userMap[i.userId], service: svcMap[i.serviceId] }))
    return NextResponse.json({ items: enriched })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  try {
    const { userId, serviceId, date, timeSlot, notes, priority } = await req.json()
    if (!userId || !serviceId || !date) return NextResponse.json({ error: 'Campos obrigatorios' }, { status: 400 })
    const item = await prisma.waitlist.create({
      data: { userId, serviceId, date, timeSlot: timeSlot || null, notes: notes || null, priority: priority || 0 },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  try {
    const { id, status, notes, priority } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID obrigatorio' }, { status: 400 })
    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes
    if (priority !== undefined) data.priority = priority
    const item = await prisma.waitlist.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.waitlist.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 })
  }
}
