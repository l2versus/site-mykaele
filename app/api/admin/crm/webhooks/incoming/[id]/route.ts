// app/api/admin/crm/webhooks/incoming/[id]/route.ts — PUT, DELETE webhook de entrada
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await ctx.params
    const body = await req.json()
    const { name, actionType, actionConfig, isActive } = body

    const sets: string[] = []
    const vals: unknown[] = []
    let idx = 1

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name) }
    if (actionType !== undefined) { sets.push(`"actionType" = $${idx++}`); vals.push(actionType) }
    if (actionConfig !== undefined) { sets.push(`"actionConfig" = $${idx++}::jsonb`); vals.push(JSON.stringify(actionConfig)) }
    if (isActive !== undefined) { sets.push(`"isActive" = $${idx++}`); vals.push(isActive) }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    vals.push(id)
    const result = await prisma.$executeRawUnsafe(
      `UPDATE crm_webhooks_incoming SET ${sets.join(', ')} WHERE id = $${idx}`,
      ...vals,
    )

    if (result === 0) {
      return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 })
    }

    const rows = await prisma.$queryRawUnsafe<Array<{ tenantId: string }>>(
      `SELECT "tenantId" FROM crm_webhooks_incoming WHERE id = $1`, id,
    )
    if (rows[0]) {
      createAuditLog({
        tenantId: rows[0].tenantId,
        userId: payload.userId,
        action: 'WEBHOOK_INCOMING_UPDATED',
        entityId: id,
        details: { name, actionType, isActive },
      })
    }

    return NextResponse.json({ message: 'Webhook atualizado' })
  } catch (err) {
    console.error('[webhooks/incoming] PUT error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await ctx.params

    const rows = await prisma.$queryRawUnsafe<Array<{ tenantId: string; name: string }>>(
      `SELECT "tenantId", name FROM crm_webhooks_incoming WHERE id = $1`, id,
    )

    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM crm_webhooks_incoming WHERE id = $1`, id,
    )

    if (result === 0) {
      return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 })
    }

    if (rows[0]) {
      createAuditLog({
        tenantId: rows[0].tenantId,
        userId: payload.userId,
        action: 'WEBHOOK_INCOMING_DELETED',
        entityId: id,
        details: { name: rows[0].name },
      })
    }

    return NextResponse.json({ message: 'Webhook excluído' })
  } catch (err) {
    console.error('[webhooks/incoming] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
