// app/api/admin/crm/automations/[id]/route.ts — Atualizar automação (toggle, editar fluxo)
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
    const { tenantId, isActive, name, trigger, flowJson } = body

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
    }

    // Resolver tenant por slug
    let resolvedTenantId = tenantId
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
    if (tenant) resolvedTenantId = tenant.id

    // Verificar que a automação pertence ao tenant
    const existing = await prisma.crmAutomation.findFirst({
      where: { id, tenantId: resolvedTenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 })
    }

    // Montar dados de atualização (apenas campos enviados)
    const updateData: Record<string, unknown> = {}
    if (typeof isActive === 'boolean') updateData.isActive = isActive
    if (name) updateData.name = name
    if (trigger) updateData.trigger = trigger
    if (flowJson) updateData.flowJson = flowJson

    const updated = await prisma.crmAutomation.update({
      where: { id },
      data: updateData,
    })

    createAuditLog({
      tenantId: resolvedTenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.AUTOMATION_UPDATED,
      entityId: id,
      details: { changes: Object.keys(updateData) },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[automations] PATCH error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const tenantId = req.nextUrl.searchParams.get('tenantId')
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
    }

    // Resolver tenant por slug
    let resolvedTenantId = tenantId
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
    if (tenant) resolvedTenantId = tenant.id

    const existing = await prisma.crmAutomation.findFirst({
      where: { id, tenantId: resolvedTenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 })
    }

    await prisma.crmAutomation.delete({ where: { id } })

    createAuditLog({
      tenantId: resolvedTenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.AUTOMATION_DELETED,
      entityId: id,
      details: { name: existing.name },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[automations] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
