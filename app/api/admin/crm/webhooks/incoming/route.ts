// app/api/admin/crm/webhooks/incoming/route.ts — CRUD de webhooks de entrada
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { randomUUID } from 'crypto'

interface IncomingRow {
  id: string
  tenantId: string
  name: string
  token: string
  actionType: string
  actionConfig: Record<string, unknown> | null
  isActive: boolean
  createdAt: Date
}

async function resolveTenant(slug: string): Promise<string> {
  const tenant = await prisma.crmTenant.findUnique({ where: { slug } })
  return tenant ? tenant.id : slug
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId')
    if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

    const resolvedId = await resolveTenant(tenantId)

    const webhooks = await prisma.$queryRawUnsafe<IncomingRow[]>(
      `SELECT id, name, token, "actionType", "actionConfig", "isActive", "createdAt"
       FROM crm_webhooks_incoming
       WHERE "tenantId" = $1
       ORDER BY "createdAt" DESC`,
      resolvedId,
    )

    return NextResponse.json({ webhooks })
  } catch (err) {
    console.error('[webhooks/incoming] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authToken = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!authToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(authToken)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { tenantId, name, actionType, actionConfig } = body

    if (!tenantId || !name || !actionType) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenantId, name, actionType' }, { status: 400 })
    }

    const validActions = ['create_lead', 'update_lead', 'custom']
    if (!validActions.includes(actionType)) {
      return NextResponse.json({ error: `actionType deve ser: ${validActions.join(', ')}` }, { status: 400 })
    }

    const resolvedId = await resolveTenant(tenantId)
    const webhookToken = randomUUID()

    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; token: string }>>(
      `INSERT INTO crm_webhooks_incoming (id, "tenantId", name, token, "actionType", "actionConfig", "isActive", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, true, NOW())
       RETURNING id, token`,
      resolvedId,
      name,
      webhookToken,
      actionType,
      actionConfig ? JSON.stringify(actionConfig) : null,
    )

    createAuditLog({
      tenantId: resolvedId,
      userId: payload.userId,
      action: 'WEBHOOK_INCOMING_CREATED',
      entityId: rows[0]?.id,
      details: { name, actionType },
    })

    return NextResponse.json({
      id: rows[0]?.id,
      token: rows[0]?.token,
      url: `/api/webhooks/crm/${rows[0]?.token}`,
      message: 'Webhook de entrada criado',
    }, { status: 201 })
  } catch (err) {
    console.error('[webhooks/incoming] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
