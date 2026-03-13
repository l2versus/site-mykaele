// app/api/admin/crm/bots/route.ts — CRUD de fluxos de bot
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
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
    }

    let resolvedTenantId = tenantId
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
    if (tenant) resolvedTenantId = tenant.id

    const bots = await prisma.crmBotFlow.findMany({
      where: { tenantId: resolvedTenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        triggerType: true,
        triggerConfig: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sessions: true } },
      },
    })

    return NextResponse.json({ bots })
  } catch (err) {
    console.error('[bots] GET error:', err instanceof Error ? err.message : err)
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
    const { tenantId, name, description, triggerType, triggerConfig, nodes, edges } = body

    if (!tenantId || !name || !triggerType) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenantId, name, triggerType' }, { status: 400 })
    }

    let resolvedTenantId = tenantId
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
    if (tenant) resolvedTenantId = tenant.id

    // Nó trigger padrão se não enviou nodes
    const defaultNodes = [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: { label: 'Gatilho', triggerType },
      },
    ]

    const bot = await prisma.crmBotFlow.create({
      data: {
        tenantId: resolvedTenantId,
        name,
        description: description ?? null,
        triggerType,
        triggerConfig: triggerConfig ?? null,
        nodes: nodes ?? defaultNodes,
        edges: edges ?? [],
        isActive: false,
      },
    })

    createAuditLog({
      tenantId: resolvedTenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.AUTOMATION_CREATED,
      entityId: bot.id,
      details: { name, triggerType, type: 'bot_flow' },
    })

    return NextResponse.json(bot, { status: 201 })
  } catch (err) {
    console.error('[bots] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
