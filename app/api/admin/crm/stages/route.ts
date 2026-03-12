// app/api/admin/crm/stages/route.ts — CRUD de estágios do pipeline
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

// GET — Listar estágios do pipeline padrão do tenant
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    let tenantId = req.nextUrl.searchParams.get('tenantId')
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
    }

    // Suporte a lookup por slug
    let pipeline = await prisma.pipeline.findFirst({
      where: { tenantId, isDefault: true },
    })

    if (!pipeline) {
      const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenant) {
        tenantId = tenant.id
        pipeline = await prisma.pipeline.findFirst({
          where: { tenantId: tenant.id, isDefault: true },
        })
      }
    }

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrado' }, { status: 404 })
    }

    const stages = await prisma.stage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        order: true,
        color: true,
        cachedLeadCount: true,
        cachedTotalValue: true,
      },
    })

    return NextResponse.json({ pipeline, stages })
  } catch (err) {
    console.error('[stages] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Criar novo estágio
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    let { tenantId, pipelineId, name, color, type } = body as {
      tenantId: string
      pipelineId: string
      name: string
      color: string
      type: 'OPEN' | 'WON' | 'LOST'
    }

    if (!tenantId || !pipelineId || !name || !color || !type) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenantId, pipelineId, name, color, type' }, { status: 400 })
    }

    // Resolver slug → cuid
    const tenantCheck = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantCheck) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    // Buscar o maior order atual para inserir no final dos OPEN (antes de WON/LOST)
    const existingStages = await prisma.stage.findMany({
      where: { pipelineId },
      orderBy: { order: 'asc' },
      select: { id: true, type: true, order: true },
    })

    let newOrder: number
    if (type === 'OPEN') {
      // Inserir após o último OPEN, antes de WON/LOST
      const lastOpen = existingStages.filter(s => s.type === 'OPEN').pop()
      const firstNonOpen = existingStages.find(s => s.type !== 'OPEN')
      if (lastOpen && firstNonOpen) {
        newOrder = lastOpen.order + 1
        // Reordenar os não-OPEN para abrir espaço
        await prisma.$transaction(
          existingStages
            .filter(s => s.type !== 'OPEN' && s.order >= newOrder)
            .map(s => prisma.stage.update({
              where: { id: s.id },
              data: { order: s.order + 1 },
            }))
        )
      } else {
        newOrder = (lastOpen?.order ?? -1) + 1
      }
    } else {
      // WON/LOST vão no final
      const maxOrder = existingStages.length > 0
        ? Math.max(...existingStages.map(s => s.order))
        : -1
      newOrder = maxOrder + 1
    }

    const stage = await prisma.stage.create({
      data: {
        pipelineId,
        tenantId,
        name: name.trim(),
        color,
        type,
        order: newOrder,
      },
    })

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.STAGE_CREATED,
      entityId: stage.id,
      details: { name: stage.name, type: stage.type, color: stage.color },
    })

    return NextResponse.json({ stage }, { status: 201 })
  } catch (err) {
    console.error('[stages] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — Reordenar estágios (batch)
export async function PUT(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    let { tenantId, stages: stageOrder } = body as {
      tenantId: string
      stages: { id: string; order: number }[]
    }

    if (!tenantId || !stageOrder || !Array.isArray(stageOrder)) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenantId, stages[]' }, { status: 400 })
    }

    // Resolver slug → cuid
    const tenantCheck = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantCheck) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    await prisma.$transaction(
      stageOrder.map(s => prisma.stage.update({
        where: { id: s.id },
        data: { order: s.order },
      }))
    )

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.STAGE_REORDERED,
      details: { stageIds: stageOrder.map(s => s.id) },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[stages] PUT error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
