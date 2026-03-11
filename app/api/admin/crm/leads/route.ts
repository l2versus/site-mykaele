// app/api/admin/crm/leads/route.ts — CRUD de leads
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId')
    const pipelineId = req.nextUrl.searchParams.get('pipelineId')

    if (!tenantId || !pipelineId) {
      return NextResponse.json({ error: 'tenantId e pipelineId são obrigatórios' }, { status: 400 })
    }

    // Query 2 do padrão anti-N+1: buscar todos os leads do pipeline
    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        pipelineId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        stageId: true,
        position: true,
        expectedValue: true,
        aiScore: true,
        aiScoreLabel: true,
        churnRisk: true,
        bestContactDays: true,
        bestContactHours: true,
        bestContactBasis: true,
        tags: true,
        source: true,
        lastInteractionAt: true,
        createdAt: true,
      },
      orderBy: { position: 'asc' },
    })

    return NextResponse.json({ leads })
  } catch (err) {
    console.error('[leads] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { tenantId, pipelineId, stageId, name, phone, email, expectedValue, source, tags } = body

    if (!tenantId || !pipelineId || !stageId || !name || !phone) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Calcular posição (último da coluna + 1)
    const lastLead = await prisma.lead.findFirst({
      where: { tenantId, stageId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const position = lastLead ? lastLead.position + 1.0 : 1.0

    const lead = await prisma.$transaction(async (tx) => {
      const newLead = await tx.lead.create({
        data: {
          tenantId,
          pipelineId,
          stageId,
          name,
          phone,
          email: email || null,
          expectedValue: expectedValue ?? null,
          source: source || null,
          tags: tags ?? [],
          status: 'WARM',
          position,
        },
      })

      // Atualizar cache do estágio
      await tx.stage.update({
        where: { id: stageId },
        data: {
          cachedLeadCount: { increment: 1 },
          cachedTotalValue: { increment: expectedValue ?? 0 },
          cacheUpdatedAt: new Date(),
        },
      })

      return newLead
    })

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.LEAD_CREATED,
      entityId: lead.id,
      details: { name, phone, stageId },
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (err) {
    console.error('[leads] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
