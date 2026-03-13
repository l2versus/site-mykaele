// app/api/admin/crm/integrations/config/route.ts — Save/load integration credentials
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptCredentials, decryptCredentials } from '@/lib/crypto'
import { createAuditLog, CRM_ACTIONS } from '@/lib/audit'

const ALLOWED_PROVIDERS = ['n8n', 'google-calendar']

// GET — Load integration config (without exposing full credentials)
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId')
    const provider = searchParams.get('provider')

    if (!tenantId || !provider) {
      return NextResponse.json({ error: 'tenantId e provider são obrigatórios' }, { status: 400 })
    }

    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Provider não suportado' }, { status: 400 })
    }

    // Resolve tenant
    const tenant = await prisma.crmTenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    const integration = await prisma.crmIntegration.findUnique({
      where: { tenantId_provider: { tenantId: tenant.id, provider } },
    })

    if (!integration) {
      return NextResponse.json({ configured: false, isActive: false })
    }

    // Decrypt and mask credentials for display
    let maskedCredentials: Record<string, string> = {}
    try {
      const creds = typeof integration.credentials === 'string'
        ? decryptCredentials(integration.credentials as string)
        : integration.credentials as Record<string, unknown>

      for (const [key, value] of Object.entries(creds)) {
        const strVal = String(value)
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
          maskedCredentials[key] = strVal.length > 8
            ? strVal.slice(0, 4) + '****' + strVal.slice(-4)
            : '****'
        } else {
          maskedCredentials[key] = strVal
        }
      }
    } catch {
      // If decryption fails, credentials might be stored as plain JSON
      maskedCredentials = { error: 'Erro ao ler credenciais' }
    }

    return NextResponse.json({
      configured: true,
      isActive: integration.isActive,
      credentials: maskedCredentials,
      settings: integration.settings,
      updatedAt: integration.updatedAt,
    })
  } catch (err) {
    console.error('[integrations/config] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Save or update integration config
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { tenantId, provider, credentials, isActive } = body

    if (!tenantId || !provider || !credentials) {
      return NextResponse.json({ error: 'tenantId, provider e credentials são obrigatórios' }, { status: 400 })
    }

    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Provider não suportado' }, { status: 400 })
    }

    // Resolve tenant
    const tenant = await prisma.crmTenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    // Encrypt credentials
    const encryptedCreds = encryptCredentials(credentials)

    const integration = await prisma.crmIntegration.upsert({
      where: { tenantId_provider: { tenantId: tenant.id, provider } },
      create: {
        tenantId: tenant.id,
        provider,
        credentials: encryptedCreds,
        isActive: isActive ?? true,
        settings: body.settings ?? null,
      },
      update: {
        credentials: encryptedCreds,
        isActive: isActive ?? true,
        settings: body.settings ?? undefined,
      },
    })

    createAuditLog({
      tenantId: tenant.id,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_CONNECTED,
      entityId: integration.id,
      details: { provider, action: 'config_saved' },
    })

    return NextResponse.json({ ok: true, id: integration.id })
  } catch (err) {
    console.error('[integrations/config] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — Remove integration config
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId')
    const provider = searchParams.get('provider')

    if (!tenantId || !provider) {
      return NextResponse.json({ error: 'tenantId e provider são obrigatórios' }, { status: 400 })
    }

    const tenant = await prisma.crmTenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    await prisma.crmIntegration.deleteMany({
      where: { tenantId: tenant.id, provider },
    })

    createAuditLog({
      tenantId: tenant.id,
      userId: payload.userId,
      action: CRM_ACTIONS.INTEGRATION_CONNECTED,
      entityId: provider,
      details: { provider, action: 'config_removed' },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[integrations/config] DELETE error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
