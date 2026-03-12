// app/api/public/proposals/[token]/route.ts — API pública da proposta (sem auth)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — Buscar proposta por token público
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const proposal = await prisma.crmProposal.findUnique({
      where: { publicToken: token },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    // Mark as viewed
    if (!proposal.viewedAt) {
      await prisma.crmProposal.update({
        where: { id: proposal.id },
        data: { viewedAt: new Date(), status: proposal.status === 'SENT' ? 'VIEWED' : proposal.status },
      })
    }

    // Check if expired
    if (proposal.validUntil && new Date(proposal.validUntil) < new Date() && proposal.status !== 'ACCEPTED' && proposal.status !== 'REJECTED') {
      await prisma.crmProposal.update({
        where: { id: proposal.id },
        data: { status: 'EXPIRED' },
      })
      proposal.status = 'EXPIRED'
    }

    // Get tenant info for branding
    const tenant = await prisma.crmTenant.findUnique({
      where: { id: proposal.tenantId },
      select: { name: true },
    })

    return NextResponse.json({
      proposal: {
        title: proposal.title,
        description: proposal.description,
        items: proposal.items,
        discount: proposal.discount,
        discountType: proposal.discountType,
        totalValue: proposal.totalValue,
        validUntil: proposal.validUntil,
        status: proposal.status,
        leadName: proposal.leadName,
        createdAt: proposal.createdAt,
      },
      clinicName: tenant?.name || 'Clínica',
    })
  } catch (err) {
    console.error('[public/proposals] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Aceitar ou recusar proposta
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json()
    const { action } = body // "accept" or "reject"

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const proposal = await prisma.crmProposal.findUnique({
      where: { publicToken: token },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    if (['ACCEPTED', 'REJECTED', 'EXPIRED'].includes(proposal.status)) {
      return NextResponse.json({ error: 'Esta proposta já foi respondida ou expirou' }, { status: 400 })
    }

    if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
      await prisma.crmProposal.update({
        where: { id: proposal.id },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json({ error: 'Esta proposta expirou' }, { status: 400 })
    }

    const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED'

    await prisma.crmProposal.update({
      where: { id: proposal.id },
      data: { status: newStatus, respondedAt: new Date() },
    })

    // Create lead activity
    await prisma.leadActivity.create({
      data: {
        leadId: proposal.leadId,
        type: action === 'accept' ? 'PROPOSAL_ACCEPTED' : 'PROPOSAL_REJECTED',
        payload: { proposalId: proposal.id, title: proposal.title, totalValue: proposal.totalValue },
      },
    })

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err) {
    console.error('[public/proposals] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
