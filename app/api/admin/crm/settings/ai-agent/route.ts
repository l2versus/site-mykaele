// app/api/admin/crm/settings/ai-agent/route.ts — Config do Agente Recepcionista IA
// Armazena em CrmIntegration (provider: 'ai-agent') para consistência com auto-reply
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

async function resolveTenantId(slug: string): Promise<string> {
  const tenant = await prisma.crmTenant.findUnique({ where: { slug } })
  if (tenant) return tenant.id
  const tenantById = await prisma.crmTenant.findUnique({ where: { id: slug } })
  return tenantById?.id ?? slug
}

// GET — Retorna config atual do agente IA
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

    const integration = await prisma.crmIntegration.findFirst({
      where: { tenantId, provider: 'ai-agent' },
    })

    if (!integration) {
      return NextResponse.json({
        config: {
          enabled: false,
          agentName: 'Assistente Myka',
          tone: 'profissional',
          extraInstructions: '',
          maxInteractions: 10,
          schedule: 'always',
          businessHoursStart: '08:00',
          businessHoursEnd: '18:00',
          model: 'gemini-2.0-flash',
          delayMs: 3000,
        },
      })
    }

    const creds = integration.credentials as Record<string, unknown> | null
    return NextResponse.json({
      config: {
        enabled: creds?.enabled ?? false,
        agentName: creds?.agentName ?? 'Assistente Myka',
        tone: creds?.tone ?? 'profissional',
        extraInstructions: creds?.extraInstructions ?? '',
        maxInteractions: creds?.maxInteractions ?? 10,
        schedule: creds?.schedule ?? 'always',
        businessHoursStart: creds?.businessHoursStart ?? '08:00',
        businessHoursEnd: creds?.businessHoursEnd ?? '18:00',
        model: creds?.model ?? 'gemini-2.0-flash',
        delayMs: creds?.delayMs ?? 3000,
      },
    })
  } catch (err) {
    console.error('[ai-agent config] GET error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Salvar config do agente IA
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const {
      enabled, agentName, tone, extraInstructions,
      maxInteractions, schedule, businessHoursStart, businessHoursEnd,
      model, delayMs, tenantId: tenantSlug,
    } = body

    const tenantId = await resolveTenantId(
      tenantSlug || process.env.DEFAULT_TENANT_ID || 'clinica-mykaele-procopio'
    )

    const credentials = {
      enabled: enabled === true,
      agentName: agentName || 'Assistente Myka',
      tone: tone || 'profissional',
      extraInstructions: extraInstructions || '',
      maxInteractions: typeof maxInteractions === 'number' ? maxInteractions : 10,
      schedule: schedule || 'always',
      businessHoursStart: businessHoursStart || '08:00',
      businessHoursEnd: businessHoursEnd || '18:00',
      model: model || 'gemini-2.0-flash',
      delayMs: typeof delayMs === 'number' ? delayMs : 3000,
    }

    // Upsert: criar ou atualizar
    const existing = await prisma.crmIntegration.findFirst({
      where: { tenantId, provider: 'ai-agent' },
    })

    if (existing) {
      await prisma.crmIntegration.update({
        where: { id: existing.id },
        data: {
          credentials,
          isActive: credentials.enabled,
        },
      })
    } else {
      await prisma.crmIntegration.create({
        data: {
          tenantId,
          provider: 'ai-agent',
          credentials,
          isActive: credentials.enabled,
        },
      })
    }

    createAuditLog({
      tenantId,
      userId: payload.userId,
      action: 'AI_AGENT_CONFIG_UPDATED',
      details: { enabled: credentials.enabled, agentName: credentials.agentName },
    })

    return NextResponse.json({ ok: true, config: credentials })
  } catch (err) {
    console.error('[ai-agent config] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
