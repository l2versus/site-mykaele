// app/api/admin/crm/broadcasts/route.ts — Listar e criar transmissões
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

function resolveTenantParam(tenantId: string) {
  return prisma.crmTenant.findFirst({
    where: { OR: [{ id: tenantId }, { slug: tenantId }] },
    select: { id: true },
  })
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantParam = req.nextUrl.searchParams.get('tenantId')
    if (!tenantParam) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

    const tenant = await resolveTenantParam(tenantParam)
    if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    // Count leads matching filters (for preview before creating)
    const countOnly = req.nextUrl.searchParams.get('countOnly')
    if (countOnly === 'true') {
      const leadWhere: Record<string, unknown> = {
        tenantId: tenant.id,
        deletedAt: null,
        phone: { not: '' },
      }
      const filterStatus = req.nextUrl.searchParams.get('filterStatus')
      const filterStageId = req.nextUrl.searchParams.get('filterStageId')
      const filterTags = req.nextUrl.searchParams.get('filterTags')
      const filterMinScore = req.nextUrl.searchParams.get('filterMinScore')

      if (filterStatus) leadWhere.status = filterStatus
      if (filterStageId) leadWhere.stageId = filterStageId
      if (filterTags) leadWhere.tags = { hasSome: filterTags.split(',').map((t: string) => t.trim()).filter(Boolean) }
      if (filterMinScore) leadWhere.aiScore = { gte: Number(filterMinScore) }

      const count = await prisma.lead.count({ where: leadWhere })
      return NextResponse.json({ count })
    }

    const status = req.nextUrl.searchParams.get('status')
    const where: Record<string, unknown> = { tenantId: tenant.id }
    if (status) where.status = status

    const broadcasts = await prisma.crmBroadcast.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ broadcasts })
  } catch (err) {
    console.error('[broadcasts] GET error:', err instanceof Error ? err.message : err)
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
    const { tenantId: tenantParam, name, message, templateId, filters } = body

    if (!tenantParam || !name || !message) {
      return NextResponse.json({ error: 'tenantId, name e message são obrigatórios' }, { status: 400 })
    }

    const tenant = await resolveTenantParam(tenantParam)
    if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    // Build lead filter query
    const leadWhere: Record<string, unknown> = {
      tenantId: tenant.id,
      deletedAt: null,
      phone: { not: '' },
    }

    if (filters?.status) leadWhere.status = filters.status
    if (filters?.stageId) leadWhere.stageId = filters.stageId
    if (filters?.tags?.length) leadWhere.tags = { hasSome: filters.tags }
    if (filters?.minScore) leadWhere.aiScore = { gte: filters.minScore }

    const leads = await prisma.lead.findMany({
      where: leadWhere,
      select: { id: true, name: true, phone: true },
    })

    if (leads.length === 0) {
      return NextResponse.json({ error: 'Nenhum lead encontrado com os filtros aplicados' }, { status: 400 })
    }

    const broadcast = await prisma.crmBroadcast.create({
      data: {
        tenantId: tenant.id,
        name,
        templateId: templateId || null,
        message,
        filters: filters || null,
        totalRecipients: leads.length,
        createdBy: payload.userId,
        recipients: {
          create: leads.map(lead => ({
            leadId: lead.id,
            leadName: lead.name,
            phone: lead.phone,
          })),
        },
      },
    })

    createAuditLog({
      tenantId: tenant.id,
      userId: payload.userId,
      action: CRM_ACTIONS.BROADCAST_CREATED || 'BROADCAST_CREATED',
      entityId: broadcast.id,
      details: { name, totalRecipients: leads.length, filters },
    })

    return NextResponse.json({ broadcast }, { status: 201 })
  } catch (err) {
    console.error('[broadcasts] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
