// app/api/admin/crm/leads/[id]/activity/route.ts — Add activity to lead
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const { type, payload: activityPayload } = body
    if (!type) {
      return NextResponse.json({ error: 'type é obrigatório' }, { status: 400 })
    }

    // Verify lead exists
    const lead = await prisma.lead.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    })
    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    const activity = await prisma.leadActivity.create({
      data: {
        leadId: id,
        type,
        payload: activityPayload ?? {},
        createdBy: payload.userId,
      },
    })

    return NextResponse.json({ activity }, { status: 201 })
  } catch (err) {
    console.error('[lead activity] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
