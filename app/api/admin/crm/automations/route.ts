// app/api/admin/crm/automations/route.ts — CRUD de automações CRM
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

    // Buscar tenant por slug se necessário
    let resolvedTenantId = tenantId
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
    if (tenant) resolvedTenantId = tenant.id

    const automations = await prisma.crmAutomation.findMany({
      where: { tenantId: resolvedTenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        trigger: true,
        isActive: true,
        flowJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ automations })
  } catch (err) {
    console.error('[automations] GET error:', err instanceof Error ? err.message : err)
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
    const { tenantId, name, trigger, flowJson } = body

    if (!tenantId || !name || !trigger) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenantId, name, trigger' }, { status: 400 })
    }

    // Resolver tenant por slug
    let resolvedTenantId = tenantId
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
    if (tenant) resolvedTenantId = tenant.id

    const automation = await prisma.crmAutomation.create({
      data: {
        tenantId: resolvedTenantId,
        name,
        trigger,
        flowJson: flowJson ?? { nodes: [], edges: [] },
        isActive: false,
      },
    })

    createAuditLog({
      tenantId: resolvedTenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.AUTOMATION_CREATED,
      entityId: automation.id,
      details: { name, trigger },
    })

    return NextResponse.json(automation, { status: 201 })
  } catch (err) {
    console.error('[automations] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
