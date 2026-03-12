// app/api/admin/crm/proposals/route.ts — Listar e criar propostas
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

function resolveTenant(tenantId: string) {
  return prisma.crmTenant.findFirst({
    where: { OR: [{ id: tenantId }, { slug: tenantId }] },
    select: { id: true },
  })
}

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

    // Search leads for proposal creation
    const searchLeads = req.nextUrl.searchParams.get('searchLeads')
    if (searchLeads && searchLeads.length >= 2) {
      const leads = await prisma.lead.findMany({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          OR: [
            { name: { contains: searchLeads, mode: 'insensitive' } },
            { phone: { contains: searchLeads } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: 10,
        orderBy: { name: 'asc' },
      })
      return NextResponse.json({ leads })
    }

    const leadId = req.nextUrl.searchParams.get('leadId')
    const status = req.nextUrl.searchParams.get('status')

    const where: Record<string, unknown> = { tenantId: tenant.id }
    if (leadId) where.leadId = leadId
    if (status) where.status = status

    const proposals = await prisma.crmProposal.findMany({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ proposals })
  } catch (err) {
    console.error('[proposals] GET error:', err instanceof Error ? err.message : err)
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
    const { tenantId: tenantParam, leadId, title, description, items, discount, discountType, validUntil } = body

    if (!tenantParam || !leadId || !title || !items?.length) {
      return NextResponse.json({ error: 'tenantId, leadId, title e items são obrigatórios' }, { status: 400 })
    }

    const tenant = await resolveTenant(tenantParam)
    if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId: tenant.id, deletedAt: null },
    })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    // Calculate total
    const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) =>
      sum + (item.quantity || 1) * (item.unitPrice || 0), 0
    )

    let totalValue = subtotal
    const discountAmount = discount || 0
    if (discountType === 'percent' && discountAmount > 0) {
      totalValue = subtotal * (1 - discountAmount / 100)
    } else if (discountType === 'fixed' && discountAmount > 0) {
      totalValue = subtotal - discountAmount
    }
    totalValue = Math.max(0, totalValue)

    const proposal = await prisma.crmProposal.create({
      data: {
        tenantId: tenant.id,
        leadId: lead.id,
        leadName: lead.name,
        title,
        description: description || null,
        discount: discountAmount,
        discountType: discountType || 'percent',
        totalValue,
        validUntil: validUntil ? new Date(validUntil) : null,
        createdBy: payload.userId,
        items: {
          create: items.map((item: { name: string; description?: string; quantity?: number; unitPrice: number }, i: number) => ({
            name: item.name,
            description: item.description || null,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            sortOrder: i,
          })),
        },
      },
      include: { items: true },
    })

    createAuditLog({
      tenantId: tenant.id,
      userId: payload.userId,
      action: 'PROPOSAL_CREATED',
      entityId: proposal.id,
      details: { leadId, title, totalValue },
    })

    return NextResponse.json({ proposal }, { status: 201 })
  } catch (err) {
    console.error('[proposals] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
