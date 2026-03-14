// app/api/admin/crm/conversations/start/route.ts — Create or get conversation for a lead
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { leadId, tenantId } = await req.json()
    if (!leadId || !tenantId) {
      return NextResponse.json({ error: 'leadId e tenantId são obrigatórios' }, { status: 400 })
    }

    // Resolver slug → cuid
    let resolvedTenantId = tenantId
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) resolvedTenantId = tenantBySlug.id
      else return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    // Buscar lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, deletedAt: null },
      select: { id: true, phone: true, name: true, tenantId: true },
    })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    if (!lead.phone) return NextResponse.json({ error: 'Lead não tem número de telefone' }, { status: 400 })

    // Normalizar remoteJid — garantir código do país 55 (Brasil)
    let phone = lead.phone.replace(/\D/g, '')
    if (phone.length === 10 || phone.length === 11) {
      phone = `55${phone}`
    }
    const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

    // Buscar conversa existente
    const existing = await prisma.conversation.findUnique({
      where: { tenantId_remoteJid: { tenantId: resolvedTenantId, remoteJid } },
      select: { id: true, isClosed: true },
    })

    if (existing) {
      // Reabrir se fechada
      if (existing.isClosed) {
        await prisma.conversation.update({
          where: { id: existing.id },
          data: { isClosed: false },
        })
      }
      return NextResponse.json({ conversationId: existing.id, created: false })
    }

    // Buscar canal WhatsApp ativo
    const channel = await prisma.crmChannel.findFirst({
      where: { tenantId: resolvedTenantId, type: 'whatsapp', isActive: true },
      select: { id: true },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Nenhum canal WhatsApp ativo' }, { status: 400 })
    }

    // Criar conversa nova
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: resolvedTenantId,
        leadId,
        channelId: channel.id,
        remoteJid,
      },
    })

    createAuditLog({
      tenantId: resolvedTenantId,
      userId: payload.userId,
      action: 'CONVERSATION_STARTED',
      entityId: conversation.id,
      details: { leadId, leadName: lead.name },
    })

    return NextResponse.json({ conversationId: conversation.id, created: true }, { status: 201 })
  } catch (err) {
    console.error('[conversations/start] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
