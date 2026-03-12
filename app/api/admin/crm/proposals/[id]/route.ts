// app/api/admin/crm/proposals/[id]/route.ts — Detalhes, atualizar, enviar, excluir proposta
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'
import { createAuditLog } from '@/lib/audit'

export async function GET(
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
    const proposal = await prisma.crmProposal.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

    return NextResponse.json({ proposal })
  } catch (err) {
    console.error('[proposals] GET [id] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Actions: send, duplicate
export async function POST(
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
    const { action } = body

    const proposal = await prisma.crmProposal.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

    // SEND via WhatsApp
    if (action === 'send') {
      const lead = await prisma.lead.findFirst({
        where: { id: proposal.leadId, tenantId: proposal.tenantId },
      })

      if (!lead?.phone) {
        return NextResponse.json({ error: 'Lead não tem telefone' }, { status: 400 })
      }

      const channel = await prisma.crmChannel.findFirst({
        where: { tenantId: proposal.tenantId, type: 'whatsapp', isActive: true },
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mykaeleprocopio.com.br'
      const proposalUrl = `${appUrl}/proposta/${proposal.publicToken}`

      const message = `Olá ${lead.name.split(' ')[0]}!\n\nPreparei uma proposta especial para você:\n*${proposal.title}*\n\nValor: R$ ${proposal.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nVeja os detalhes e aceite aqui:\n${proposalUrl}\n\n— Mykaele Procópio`

      if (channel?.instanceId) {
        try {
          await evolutionApi.sendText(channel.instanceId, lead.phone, message)
        } catch (err) {
          console.error('[proposals] Send error:', err instanceof Error ? err.message : err)
        }
      }

      await prisma.crmProposal.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date() },
      })

      createAuditLog({
        tenantId: proposal.tenantId,
        userId: payload.userId,
        action: 'PROPOSAL_SENT',
        entityId: id,
        details: { leadId: proposal.leadId, title: proposal.title },
      })

      return NextResponse.json({ success: true, status: 'SENT' })
    }

    // DUPLICATE
    if (action === 'duplicate') {
      const newProposal = await prisma.crmProposal.create({
        data: {
          tenantId: proposal.tenantId,
          leadId: proposal.leadId,
          leadName: proposal.leadName,
          title: `${proposal.title} (cópia)`,
          description: proposal.description,
          discount: proposal.discount,
          discountType: proposal.discountType,
          totalValue: proposal.totalValue,
          validUntil: proposal.validUntil,
          createdBy: payload.userId,
          items: {
            create: proposal.items.map(item => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              sortOrder: item.sortOrder,
            })),
          },
        },
        include: { items: true },
      })

      return NextResponse.json({ proposal: newProposal }, { status: 201 })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (err) {
    console.error('[proposals] POST [id] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — Update proposal
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
    const { title, description, items, discount, discountType, validUntil, status } = body

    const existing = await prisma.crmProposal.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

    // Recalculate total if items changed
    let totalValue = existing.totalValue
    if (items) {
      const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + (item.quantity || 1) * (item.unitPrice || 0), 0
      )
      const disc = discount ?? existing.discount
      const discType = discountType ?? existing.discountType
      totalValue = subtotal
      if (discType === 'percent' && disc > 0) totalValue = subtotal * (1 - disc / 100)
      else if (discType === 'fixed' && disc > 0) totalValue = subtotal - disc
      totalValue = Math.max(0, totalValue)
    }

    // Update proposal + replace items
    const proposal = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.crmProposalItem.deleteMany({ where: { proposalId: id } })
        await tx.crmProposalItem.createMany({
          data: items.map((item: { name: string; description?: string; quantity?: number; unitPrice: number }, i: number) => ({
            id: undefined,
            proposalId: id,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            sortOrder: i,
          })),
        })
      }

      return tx.crmProposal.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(discount !== undefined && { discount }),
          ...(discountType && { discountType }),
          ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
          ...(status && { status }),
          totalValue,
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })
    })

    return NextResponse.json({ proposal })
  } catch (err) {
    console.error('[proposals] PUT error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE
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
    await prisma.crmProposal.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[proposals] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
