// app/api/admin/crm/integrations/whatsapp/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'

async function resolveTenantId(value: string): Promise<string | null> {
  // Tentar como ID direto
  const byId = await prisma.crmTenant.findUnique({ where: { id: value }, select: { id: true } })
  if (byId) return byId.id

  // Tentar como slug
  const bySlug = await prisma.crmTenant.findUnique({ where: { slug: value }, select: { id: true } })
  return bySlug?.id ?? null
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const rawTenantId = req.nextUrl.searchParams.get('tenantId')
  if (!rawTenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

  const tenantId = await resolveTenantId(rawTenantId)
  if (!tenantId) {
    return NextResponse.json({ status: 'disconnected', instanceId: null, debug: 'Tenant não encontrado' })
  }

  // Buscar canal WhatsApp do tenant
  const channel = await prisma.crmChannel.findFirst({
    where: { tenantId, type: 'whatsapp', isActive: true },
  })

  if (!channel?.instanceId) {
    return NextResponse.json({ status: 'disconnected', instanceId: null })
  }

  try {
    const statusPromise = evolutionApi.getStatus(channel.instanceId)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3_000)
    )
    const result = await Promise.race([statusPromise, timeoutPromise])
    const state = result.instance.state

    return NextResponse.json({
      status: state === 'open' ? 'connected' : 'disconnected',
      instanceId: channel.instanceId,
    })
  } catch {
    return NextResponse.json({ status: 'disconnected', instanceId: channel.instanceId })
  }
}
