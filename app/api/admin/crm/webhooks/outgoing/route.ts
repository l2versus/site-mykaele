// app/api/admin/crm/webhooks/outgoing/route.ts — CRUD de webhooks de saída
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

interface OutgoingRow {
  id: string
  tenantId: string
  name: string
  url: string
  events: string[]
  headers: Record<string, string> | null
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

    const webhooks = await prisma.$queryRawUnsafe<OutgoingRow[]>(
      `SELECT id, name, url, events, headers, "isActive", "createdAt"
       FROM crm_webhooks_outgoing
       WHERE "tenantId" = $1
       ORDER BY "createdAt" DESC`,
      resolvedId,
    )

    return NextResponse.json({ webhooks })
  } catch (err) {
    console.error('[webhooks/outgoing] GET error:', err instanceof Error ? err.message : err)
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
    const { tenantId, name, url, events, headers } = body

    if (!tenantId || !name || !url || !events) {
      return NextResponse.json({ error: 'Campos obrigatórios: tenantId, name, url, events' }, { status: 400 })
    }

    // Validar URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Selecione ao menos um evento' }, { status: 400 })
    }

    const resolvedId = await resolveTenant(tenantId)

    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO crm_webhooks_outgoing (id, "tenantId", name, url, events, headers, "isActive", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::jsonb, true, NOW())
       RETURNING id`,
      resolvedId,
      name,
      url,
      JSON.stringify(events),
      headers ? JSON.stringify(headers) : null,
    )

    createAuditLog({
      tenantId: resolvedId,
      userId: payload.userId,
      action: 'WEBHOOK_OUTGOING_CREATED',
      entityId: rows[0]?.id,
      details: { name, url, events },
    })

    return NextResponse.json({ id: rows[0]?.id, message: 'Webhook criado' }, { status: 201 })
  } catch (err) {
    console.error('[webhooks/outgoing] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
