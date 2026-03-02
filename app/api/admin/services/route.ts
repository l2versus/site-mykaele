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

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { name, description, duration, price, priceReturn, isAddon, travelFee, packageOptions } = await req.json()
    if (!name || !price) return NextResponse.json({ error: 'Nome e preço obrigatórios' }, { status: 400 })

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        duration: duration || 60,
        price,
        priceReturn: priceReturn || null,
        isAddon: isAddon || false,
        travelFee: travelFee || null,
        ...(packageOptions?.length ? {
          packageOptions: {
            create: packageOptions.map((p: { name: string; sessions: number; price: number }) => ({
              name: p.name,
              sessions: p.sessions,
              price: p.price,
            })),
          },
        } : {}),
      },
      include: { packageOptions: true },
    })
    return NextResponse.json({ service }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao criar serviço'
    if (msg.includes('Unique')) return NextResponse.json({ error: 'Já existe um serviço com este nome' }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id, price, priceReturn, description, duration, active, name, isAddon, travelFee } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (price !== undefined) data.price = price
    if (priceReturn !== undefined) data.priceReturn = priceReturn
    if (description !== undefined) data.description = description
    if (duration !== undefined) data.duration = duration
    if (active !== undefined) data.active = active
    if (isAddon !== undefined) data.isAddon = isAddon
    if (travelFee !== undefined) data.travelFee = travelFee

    const service = await prisma.service.update({ where: { id }, data })
    return NextResponse.json({ service })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar serviço' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    await prisma.service.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir serviço' }, { status: 500 })
  }
}
