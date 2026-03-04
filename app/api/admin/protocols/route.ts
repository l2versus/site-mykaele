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
    const protocols = await prisma.treatmentProtocol.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ protocols })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  try {
    const { name, description, serviceId, totalSteps, intervalDays, steps, active } = await req.json()
    if (!name) return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 })
    const protocol = await prisma.treatmentProtocol.create({
      data: {
        name, description: description || null, serviceId: serviceId || null,
        totalSteps: totalSteps || 1, intervalDays: intervalDays || 7,
        active: active !== undefined ? active : true,
        steps: steps ? (typeof steps === 'string' ? steps : JSON.stringify(steps)) : null,
      },
    })
    return NextResponse.json({ protocol }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  try {
    const { id, name, description, serviceId, totalSteps, intervalDays, active, steps } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID obrigatorio' }, { status: 400 })
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (serviceId !== undefined) data.serviceId = serviceId
    if (totalSteps !== undefined) data.totalSteps = totalSteps
    if (intervalDays !== undefined) data.intervalDays = intervalDays
    if (active !== undefined) data.active = active
    if (steps !== undefined) data.steps = typeof steps === 'string' ? steps : JSON.stringify(steps)
    const protocol = await prisma.treatmentProtocol.update({ where: { id }, data })
    return NextResponse.json({ protocol })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  try {
    const { id } = await req.json()
    await prisma.treatmentProtocol.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
