// POST /api/admin/crm/automations/[id]/trigger — Disparo manual de automação
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { automationQueue } from '@/lib/queues'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

export async function POST(
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

    const { id: automationId } = await params

    // Body opcional — leadId pode ser fornecido ou não
    let body: { leadId?: string } = {}
    try {
      body = await req.json()
    } catch {
      // Body vazio é válido
    }

    const tenantSlug = req.nextUrl.searchParams.get('tenantId')
      ?? process.env.DEFAULT_TENANT_ID
      ?? 'clinica-mykaele-procopio'

    // Resolver tenant
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    const tenantId = tenant?.id ?? tenantSlug

    // Verificar que automação existe e pertence ao tenant
    const automation = await prisma.crmAutomation.findFirst({
      where: { id: automationId, tenantId },
    })

    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 })
    }

    // Resolver leadId — se não fornecido, busca primeiro lead ativo (modo teste)
    let leadId = body.leadId
    if (!leadId) {
      const firstLead = await prisma.lead.findFirst({
        where: { tenantId, deletedAt: null, status: { notIn: ['LOST'] } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (!firstLead) {
        return NextResponse.json(
          { error: 'Nenhum lead ativo encontrado para teste' },
          { status: 400 },
        )
      }
      leadId = firstLead.id
    } else {
      // Validar que o lead existe e pertence ao tenant
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, tenantId, deletedAt: null },
        select: { id: true },
      })
      if (!lead) {
        return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
      }
    }

    // Enfileirar na fila de automação
    const timestamp = Date.now()
    const jobId = `manual:${automationId}:${leadId}:${timestamp}`

    const result = await automationQueue.add('execute-automation-manual', {
      type: 'execute-automation' as const,
      automationId,
      tenantId,
      leadId,
      context: {
        scheduledBy: 'manual-trigger',
        triggeredBy: payload.userId,
        trigger: 'MANUAL',
      },
    }, { jobId })

    // Registrar no audit log
    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.AUTOMATION_TRIGGERED,
      entityId: automationId,
      details: {
        triggeredBy: 'MANUAL',
        leadId,
        jobId,
      },
    })

    // Registrar no CrmAutomationLog
    await prisma.crmAutomationLog.create({
      data: {
        tenantId,
        automationId,
        status: 'SUCCESS',
        jobId,
        payload: { triggeredBy: 'MANUAL', leadId, userId: payload.userId },
      },
    }).catch((err: unknown) => {
      console.error('[trigger] Falha ao gravar log:', err instanceof Error ? err.message : err)
    })

    return NextResponse.json({
      jobId,
      automationId,
      leadId,
      queuedAt: new Date(timestamp).toISOString(),
      bullJobId: result?.id ?? null,
    })
  } catch (err) {
    console.error('[automations/trigger] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
