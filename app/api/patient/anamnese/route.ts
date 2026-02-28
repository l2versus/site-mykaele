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
    const anamnese = await prisma.anamnese.findUnique({ where: { userId: user.userId } })
    return NextResponse.json({ anamnese })
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar anamnese' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { userId: _u, id: _id, createdAt: _c, updatedAt: _up, ...data } = body

    const existing = await prisma.anamnese.findUnique({ where: { userId: user.userId } })

    let anamnese
    if (existing) {
      anamnese = await prisma.anamnese.update({
        where: { userId: user.userId },
        data: { ...data, completedAt: new Date(), updatedAt: new Date() },
      })
    } else {
      anamnese = await prisma.anamnese.create({
        data: { ...data, userId: user.userId, completedAt: new Date() },
      })
    }

    return NextResponse.json({ anamnese })
  } catch (error) {
    console.error('Anamnese save error:', error)
    return NextResponse.json({ error: 'Erro ao salvar anamnese' }, { status: 500 })
  }
}
