import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      include: { packageOptions: { where: { active: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(services, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Services GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar serviços' }, { status: 500 })
  }
}
