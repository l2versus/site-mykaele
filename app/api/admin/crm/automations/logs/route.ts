// GET /api/admin/crm/automations/logs — Busca logs reais de execução de automações
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantSlug = req.nextUrl.searchParams.get('tenantId')
    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 })
    }

    // Resolver tenant por slug
    let resolvedTenantId = tenantSlug
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    if (tenant) resolvedTenantId = tenant.id

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30'), 100)
    const automationId = req.nextUrl.searchParams.get('automationId')

    const where: Record<string, unknown> = { tenantId: resolvedTenantId }
    if (automationId) where.automationId = automationId

    const logs = await prisma.crmAutomationLog.findMany({
      where,
      orderBy: { executedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        automationId: true,
        status: true,
        error: true,
        jobId: true,
        payload: true,
        executedAt: true,
        automation: {
          select: {
            name: true,
            trigger: true,
          },
        },
      },
    })

    return NextResponse.json({ logs })
  } catch (err) {
    console.error('[automations/logs] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
