// app/api/admin/crm/channels/email/connect/route.ts — Configurar canal de email
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { fromEmail, fromName } = await req.json()

    // Validar que o Resend API key está configurado
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'RESEND_API_KEY não configurada. Configure nas variáveis de ambiente.',
      }, { status: 400 })
    }

    // Testar conexão com Resend
    const resend = new Resend(apiKey)
    const { data: domains, error } = await resend.domains.list()
    if (error) {
      return NextResponse.json({ error: `Erro ao conectar Resend: ${error.message}` }, { status: 500 })
    }

    const verifiedDomains = domains?.data?.filter(d => d.status === 'verified') ?? []
    const displayName = fromName
      ? `${fromName} <${fromEmail || 'contato@mykaprocopio.com.br'}>`
      : fromEmail || 'Email CRM'

    let tenantId = process.env.DEFAULT_TENANT_ID ?? ''
    const tenantById = await prisma.crmTenant.findUnique({ where: { id: tenantId } })
    if (!tenantById) {
      const tenantBySlug = await prisma.crmTenant.findUnique({ where: { slug: tenantId } })
      if (tenantBySlug) tenantId = tenantBySlug.id
    }

    // Criar ou atualizar canal de email
    const existingChannel = await prisma.crmChannel.findFirst({
      where: { tenantId, type: 'email' },
    })

    const channelData = {
      tenantId,
      type: 'email' as const,
      name: displayName,
      instanceId: 'resend',
      isActive: true,
    }

    const channel = existingChannel
      ? await prisma.crmChannel.update({
          where: { id: existingChannel.id },
          data: { name: channelData.name, isActive: true },
        })
      : await prisma.crmChannel.create({ data: channelData })

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_CONNECTED,
      entityId: channel.id,
      details: { channel: 'email', fromEmail },
    })

    return NextResponse.json({
      success: true,
      channel: {
        id: channel.id,
        name: channel.name,
        verifiedDomains: verifiedDomains.map(d => d.name),
      },
    })
  } catch (err) {
    console.error('[email-connect] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao configurar email' }, { status: 500 })
  }
}
