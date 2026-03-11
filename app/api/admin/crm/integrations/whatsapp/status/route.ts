// app/api/admin/crm/integrations/whatsapp/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evolutionApi } from '@/lib/evolution-api'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

  // Buscar canal WhatsApp do tenant
  const channel = await prisma.crmChannel.findFirst({
    where: { tenantId, type: 'whatsapp', isActive: true },
  })

  if (!channel?.instanceId) {
    return NextResponse.json({ status: 'disconnected', instanceId: null })
  }

  try {
    const result = await evolutionApi.getStatus(channel.instanceId)
    const state = result.instance.state

    return NextResponse.json({
      status: state === 'open' ? 'connected' : 'disconnected',
      instanceId: channel.instanceId,
    })
  } catch {
    return NextResponse.json({ status: 'disconnected', instanceId: channel.instanceId })
  }
}
