import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.substring(7))
}

export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const packages = await prisma.package.findMany({
      where: { userId: user.userId },
      include: {
        packageOption: { include: { service: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ packages })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar pacotes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { packageOptionId, method } = await req.json()
    if (!packageOptionId) return NextResponse.json({ error: 'packageOptionId obrigatório' }, { status: 400 })

    const option = await prisma.packageOption.findUnique({ where: { id: packageOptionId }, include: { service: true } })
    if (!option || !option.active) return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 })

    const [pkg] = await prisma.$transaction([
      prisma.package.create({
        data: {
          userId: user.userId,
          packageOptionId: option.id,
          totalSessions: option.sessions,
          usedSessions: 0,
          status: 'ACTIVE',
        },
      }),
      prisma.payment.create({
        data: {
          userId: user.userId,
          amount: option.price,
          method: method || 'PIX',
          description: `${option.name} - ${option.service.name}`,
          category: 'REVENUE',
          status: 'APPROVED',
        },
      }),
    ])

    return NextResponse.json({ package: pkg }, { status: 201 })
  } catch (error) {
    console.error('Package POST error:', error)
    return NextResponse.json({ error: 'Erro ao adquirir pacote' }, { status: 500 })
  }
}
