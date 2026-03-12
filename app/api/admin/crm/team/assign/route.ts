// app/api/admin/crm/team/assign/route.ts — Assign leads/conversations to team members
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { type, entityId, memberId, tenantId } = body

    if (!type || !entityId || !tenantId) {
      return NextResponse.json({ error: 'type, entityId e tenantId são obrigatórios' }, { status: 400 })
    }

    // Validate member exists (null means unassign)
    if (memberId) {
      const member = await prisma.crmTeamMember.findUnique({ where: { id: memberId } })
      if (!member || !member.isActive) {
        return NextResponse.json({ error: 'Membro não encontrado ou inativo' }, { status: 404 })
      }
    }

    if (type === 'lead') {
      await prisma.lead.update({
        where: { id: entityId },
        data: { assignedToUserId: memberId || null },
      })
    } else if (type === 'conversation') {
      await prisma.conversation.update({
        where: { id: entityId },
        data: { assignedToUserId: memberId || null },
      })
    } else {
      return NextResponse.json({ error: 'type deve ser "lead" ou "conversation"' }, { status: 400 })
    }

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: 'ASSIGNMENT_CHANGED',
      entityId,
      details: { type, memberId: memberId || 'unassigned' },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[team/assign] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
