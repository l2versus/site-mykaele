// app/api/admin/crm/settings/route.ts — Persistência de configurações do CRM (IA, geral, etc.)
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const DEFAULT_PROVIDER_KEY = 'ai-settings'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tenantSlug = req.nextUrl.searchParams.get('tenantId') || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    const providerKey = req.nextUrl.searchParams.get('provider') || DEFAULT_PROVIDER_KEY

    let resolvedTenantId = tenantSlug
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    if (tenant) resolvedTenantId = tenant.id

    const integration = await prisma.crmIntegration.findFirst({
      where: { tenantId: resolvedTenantId, provider: providerKey },
    })

    if (!integration) {
      return NextResponse.json({ settings: null })
    }

    // Retorna settings sem expor credentials raw — apenas mascaradas
    const creds = integration.credentials as Record<string, unknown> | null
    const safeSettings: Record<string, unknown> = {}

    if (creds) {
      // Copiar tudo exceto API keys que são mascaradas
      for (const [key, value] of Object.entries(creds)) {
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
          const strVal = String(value || '')
          safeSettings[key] = strVal ? `${strVal.slice(0, 8)}${'*'.repeat(Math.max(0, strVal.length - 12))}${strVal.slice(-4)}` : ''
          safeSettings[`${key}_set`] = strVal.length > 0
        } else {
          safeSettings[key] = value
        }
      }
    }

    return NextResponse.json({
      settings: {
        ...safeSettings,
        isActive: integration.isActive,
      },
    })
  } catch (err) {
    console.error('[settings] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { tenantId: tenantSlug, provider: providerParam, ...settings } = body
    const providerKey = (providerParam as string) || DEFAULT_PROVIDER_KEY

    const slug = tenantSlug || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'

    let resolvedTenantId = slug
    const tenant = await prisma.crmTenant.findUnique({ where: { slug } })
    if (tenant) resolvedTenantId = tenant.id

    // Buscar settings existentes para merge (evitar sobrescrever keys não enviadas)
    const existing = await prisma.crmIntegration.findFirst({
      where: { tenantId: resolvedTenantId, provider: providerKey },
    })

    const existingCreds = (existing?.credentials as Record<string, unknown>) ?? {}

    // Merge: se o valor de uma key contém '*', manter o valor original
    const mergedCreds: Record<string, string | number | boolean | null | unknown[]> = { ...existingCreds as Record<string, string | number | boolean | null | unknown[]> }
    for (const [key, value] of Object.entries(settings)) {
      const strVal = String(value ?? '')
      if (strVal.includes('*') && existingCreds[key]) {
        // Manter valor original — user não quis alterar
        continue
      }
      mergedCreds[key] = value as string | number | boolean | null | unknown[]
    }

    const upserted = await prisma.crmIntegration.upsert({
      where: {
        tenantId_provider: {
          tenantId: resolvedTenantId,
          provider: providerKey,
        },
      },
      update: {
        credentials: mergedCreds as Parameters<typeof prisma.crmIntegration.update>[0]['data']['credentials'],
        isActive: true,
      },
      create: {
        tenantId: resolvedTenantId,
        provider: providerKey,
        credentials: mergedCreds as Parameters<typeof prisma.crmIntegration.create>[0]['data']['credentials'],
        isActive: true,
      },
    })

    createAuditLog({
      tenantId: resolvedTenantId,
      userId: payload.userId,
      action: 'SETTINGS_UPDATED',
      entityId: upserted.id,
      details: { provider: providerKey, keys: Object.keys(settings) },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[settings] PUT error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
