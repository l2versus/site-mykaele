// app/api/admin/crm/presence/route.ts — Heartbeat de presença + lista de usuários online
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { recordHeartbeat, getOnlineUsers, markOffline } from '@/lib/presence'

async function resolveTenantId(slug: string): Promise<string> {
  const { prisma } = await import('@/lib/prisma')
  const tenant = await prisma.crmTenant.findUnique({ where: { slug } })
  if (tenant) return tenant.id
  const tenantById = await prisma.crmTenant.findUnique({ where: { id: slug } })
  return tenantById?.id ?? slug
}

// POST — Heartbeat (chamado a cada 30s pelo cliente)
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const tenantSlug = body.tenantId || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    const tenantId = await resolveTenantId(tenantSlug)

    await recordHeartbeat({
      userId: payload.userId,
      userName: payload.email?.split('@')[0] ?? 'Admin',
      tenantId,
      currentPage: body.currentPage,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[presence] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET — Lista usuários online
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantSlug = req.nextUrl.searchParams.get('tenantId') || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    const tenantId = await resolveTenantId(tenantSlug)

    const users = await getOnlineUsers(tenantId)

    return NextResponse.json({ users })
  } catch (err) {
    console.error('[presence] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — Marcar como offline (chamado no unload/visibilitychange)
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantSlug = req.nextUrl.searchParams.get('tenantId') || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    const tenantId = await resolveTenantId(tenantSlug)

    await markOffline(payload.userId, tenantId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[presence] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
