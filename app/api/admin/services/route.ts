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
    const services = await prisma.service.findMany({
      include: { packageOptions: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ services })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar serviços' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id, price, priceReturn, description, duration, active } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (price !== undefined) data.price = price
    if (priceReturn !== undefined) data.priceReturn = priceReturn
    if (description !== undefined) data.description = description
    if (duration !== undefined) data.duration = duration
    if (active !== undefined) data.active = active

    const service = await prisma.service.update({ where: { id }, data })
    return NextResponse.json({ service })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar serviço' }, { status: 500 })
  }
}
