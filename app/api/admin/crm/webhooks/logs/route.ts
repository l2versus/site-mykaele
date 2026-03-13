// app/api/admin/crm/webhooks/logs/route.ts — Consultar logs de webhooks
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface LogRow {
  id: string
  webhookId: string
  direction: string
  event: string
  payload: unknown
  responseStatus: number | null
  attempts: number
  lastAttemptAt: Date
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

    const webhookId = req.nextUrl.searchParams.get('webhookId')
    const direction = req.nextUrl.searchParams.get('direction')
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)

    let query = `SELECT id, "webhookId", direction, event, payload, "responseStatus", attempts, "lastAttemptAt", "createdAt"
                 FROM crm_webhook_logs
                 WHERE "tenantId" = $1`
    const params: unknown[] = [resolvedId]
    let idx = 2

    if (webhookId) {
      query += ` AND "webhookId" = $${idx++}`
      params.push(webhookId)
    }
    if (direction === 'in' || direction === 'out') {
      query += ` AND direction = $${idx++}`
      params.push(direction)
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${idx}`
    params.push(limit)

    const logs = await prisma.$queryRawUnsafe<LogRow[]>(query, ...params)

    return NextResponse.json({ logs })
  } catch (err) {
    console.error('[webhooks/logs] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
