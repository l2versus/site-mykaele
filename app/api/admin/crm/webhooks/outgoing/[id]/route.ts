// app/api/admin/crm/webhooks/outgoing/[id]/route.ts — GET, PUT, DELETE webhook de saída
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await ctx.params

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, name, url, events, headers, "isActive", "createdAt"
       FROM crm_webhooks_outgoing WHERE id = $1`,
      id,
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 })
    }

    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('[webhooks/outgoing] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

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
    const { name, url, events, headers, isActive } = body

    // Validar URL se fornecida
    if (url) {
      try {
        new URL(url)
      } catch {
        return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
      }
    }

    const sets: string[] = []
    const vals: unknown[] = []
    let idx = 1

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name) }
    if (url !== undefined) { sets.push(`url = $${idx++}`); vals.push(url) }
    if (events !== undefined) { sets.push(`events = $${idx++}::jsonb`); vals.push(JSON.stringify(events)) }
    if (headers !== undefined) { sets.push(`headers = $${idx++}::jsonb`); vals.push(headers ? JSON.stringify(headers) : null) }
    if (isActive !== undefined) { sets.push(`"isActive" = $${idx++}`); vals.push(isActive) }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    vals.push(id)
    const result = await prisma.$executeRawUnsafe(
      `UPDATE crm_webhooks_outgoing SET ${sets.join(', ')} WHERE id = $${idx}`,
      ...vals,
    )

    if (result === 0) {
      return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 })
    }

    // Buscar tenantId para audit log
    const rows = await prisma.$queryRawUnsafe<Array<{ tenantId: string }>>(
      `SELECT "tenantId" FROM crm_webhooks_outgoing WHERE id = $1`, id,
    )
    if (rows[0]) {
      createAuditLog({
        tenantId: rows[0].tenantId,
        userId: payload.userId,
        action: 'WEBHOOK_OUTGOING_UPDATED',
        entityId: id,
        details: { name, url, events, isActive },
      })
    }

    return NextResponse.json({ message: 'Webhook atualizado' })
  } catch (err) {
    console.error('[webhooks/outgoing] PUT error:', err instanceof Error ? err.message : err)
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

    // Buscar tenantId antes de deletar
    const rows = await prisma.$queryRawUnsafe<Array<{ tenantId: string; name: string }>>(
      `SELECT "tenantId", name FROM crm_webhooks_outgoing WHERE id = $1`, id,
    )

    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM crm_webhooks_outgoing WHERE id = $1`, id,
    )

    if (result === 0) {
      return NextResponse.json({ error: 'Webhook não encontrado' }, { status: 404 })
    }

    if (rows[0]) {
      createAuditLog({
        tenantId: rows[0].tenantId,
        userId: payload.userId,
        action: 'WEBHOOK_OUTGOING_DELETED',
        entityId: id,
        details: { name: rows[0].name },
      })
    }

    return NextResponse.json({ message: 'Webhook excluído' })
  } catch (err) {
    console.error('[webhooks/outgoing] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
