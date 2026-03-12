// app/api/admin/crm/team/route.ts — List and add team members
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

function resolveTenant(tenantId: string) {
  return prisma.crmTenant.findFirst({
    where: { OR: [{ id: tenantId }, { slug: tenantId }] },
    select: { id: true },
  })
}

const VALID_ROLES = ['owner', 'admin', 'manager', 'agent']

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantParam = req.nextUrl.searchParams.get('tenantId')
    if (!tenantParam) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

    const tenant = await resolveTenant(tenantParam)
    if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true'

    const where: Record<string, unknown> = { tenantId: tenant.id }
    if (!includeInactive) where.isActive = true

    const members = await prisma.crmTeamMember.findMany({
      where,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })

    // Stats per member: assigned leads and conversations
    const memberIds = members.map(m => m.id)

    const leadCounts = await prisma.lead.groupBy({
      by: ['assignedToUserId'],
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        assignedToUserId: { in: memberIds },
      },
      _count: true,
    }).catch(() => [])

    const conversationCounts = await prisma.conversation.groupBy({
      by: ['assignedToUserId'],
      where: {
        tenantId: tenant.id,
        isClosed: false,
        assignedToUserId: { in: memberIds },
      },
      _count: true,
    }).catch(() => [])

    const leadCountMap = new Map(leadCounts.map(c => [c.assignedToUserId, c._count]))
    const convCountMap = new Map(conversationCounts.map(c => [c.assignedToUserId, c._count]))

    const membersWithStats = members.map(m => ({
      ...m,
      assignedLeads: leadCountMap.get(m.id) || 0,
      assignedConversations: convCountMap.get(m.id) || 0,
    }))

    return NextResponse.json({ members: membersWithStats })
  } catch (err) {
    console.error('[team] GET error:', err instanceof Error ? err.message : err)
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
    const { tenantId: tenantParam, name, email, phone, role } = body

    if (!tenantParam || !name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'tenantId, name e email são obrigatórios' }, { status: 400 })
    }

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Role inválido. Use: ${VALID_ROLES.join(', ')}` }, { status: 400 })
    }

    const tenant = await resolveTenant(tenantParam)
    if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    // Check duplicate email
    const existing = await prisma.crmTeamMember.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: email.trim().toLowerCase() } },
    })

    if (existing) {
      if (!existing.isActive) {
        // Reactivate
        const reactivated = await prisma.crmTeamMember.update({
          where: { id: existing.id },
          data: { isActive: true, name: name.trim(), role: role || 'agent', phone: phone || null },
        })
        return NextResponse.json({ member: reactivated })
      }
      return NextResponse.json({ error: 'Este email já está na equipe' }, { status: 409 })
    }

    // Check if email matches an existing User
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    })

    const member = await prisma.crmTeamMember.create({
      data: {
        tenantId: tenant.id,
        userId: user?.id || null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        role: role || 'agent',
        invitedBy: payload.userId,
        joinedAt: user ? new Date() : null,
      },
    })

    createAuditLog({
      tenantId: tenant.id,
      userId: payload.userId,
      action: CRM_ACTIONS.TEAM_MEMBER_ADDED,
      entityId: member.id,
      details: { name: member.name, email: member.email, role: member.role },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (err) {
    console.error('[team] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
