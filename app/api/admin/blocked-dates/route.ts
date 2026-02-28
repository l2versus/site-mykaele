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
    const blockedDates = await prisma.blockedDate.findMany({ orderBy: { date: 'asc' } })
    return NextResponse.json({ blockedDates })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar datas bloqueadas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { date, reason } = await req.json()
    if (!date) return NextResponse.json({ error: 'Data obrigatória' }, { status: 400 })

    const blocked = await prisma.blockedDate.create({ data: { date: new Date(date), reason } })
    return NextResponse.json({ blocked })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao bloquear data' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await prisma.blockedDate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao remover data bloqueada' }, { status: 500 })
  }
}
