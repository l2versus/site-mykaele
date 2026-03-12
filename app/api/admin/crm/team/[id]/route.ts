// app/api/admin/crm/team/[id]/route.ts — Update and remove team members
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

const VALID_ROLES = ['owner', 'admin', 'manager', 'agent']

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { name, phone, role, isActive } = body

    const existing = await prisma.crmTeamMember.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

    // Can't change owner role
    if (existing.role === 'owner' && role && role !== 'owner') {
      return NextResponse.json({ error: 'Não é possível alterar o papel do proprietário' }, { status: 400 })
    }

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Role inválido. Use: ${VALID_ROLES.join(', ')}` }, { status: 400 })
    }

    const member = await prisma.crmTeamMember.update({
      where: { id },
      data: {
        ...(name?.trim() && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    createAuditLog({
      tenantId: existing.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.TEAM_MEMBER_UPDATED,
      entityId: id,
      details: { name: member.name, role: member.role, isActive: member.isActive },
    })

    return NextResponse.json({ member })
  } catch (err) {
    console.error('[team] PUT error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.crmTeamMember.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

    if (existing.role === 'owner') {
      return NextResponse.json({ error: 'Não é possível remover o proprietário' }, { status: 400 })
    }

    // Soft deactivate instead of hard delete
    await prisma.crmTeamMember.update({
      where: { id },
      data: { isActive: false },
    })

    // Unassign leads and conversations from this member
    await prisma.lead.updateMany({
      where: { assignedToUserId: id, deletedAt: null },
      data: { assignedToUserId: null },
    }).catch(() => {})

    await prisma.conversation.updateMany({
      where: { assignedToUserId: id },
      data: { assignedToUserId: null },
    }).catch(() => {})

    createAuditLog({
      tenantId: existing.tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.TEAM_MEMBER_REMOVED,
      entityId: id,
      details: { name: existing.name, email: existing.email },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[team] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
