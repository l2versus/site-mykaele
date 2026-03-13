// app/api/admin/crm/integrations/status/route.ts — Check configured integrations
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Map of integration ID → env var names to check
const ENV_VAR_MAP: Record<string, string[]> = {
  'email': ['RESEND_API_KEY'],
  'mercadopago': ['MERCADO_PAGO_ACCESS_TOKEN'],
  'whatsapp-evolution': ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY'],
  'gemini': ['GEMINI_API_KEY'],
  'openai': ['OPENAI_API_KEY'],
  'callmebot': ['CALLMEBOT_API_KEY'],
  'telegram': ['TELEGRAM_BOT_TOKEN'],
  'instagram': ['INSTAGRAM_APP_ID'],
  'google-oauth': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  'cloudinary': ['CLOUDINARY_API_KEY'],
  'redis': ['REDIS_URL'],
}

// Integrations stored in DB (CrmIntegration table)
const DB_PROVIDERS = ['n8n', 'google-calendar']

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

    const configured: Record<string, boolean> = {}

    // Check env-based integrations
    for (const [id, envVars] of Object.entries(ENV_VAR_MAP)) {
      configured[id] = envVars.every(v => {
        const val = process.env[v]
        return val !== undefined && val !== '' && val !== null
      })
    }

    // Check DB-based integrations (n8n, google-calendar)
    if (tenantId) {
      try {
        const tenant = await prisma.crmTenant.findFirst({
          where: { OR: [{ id: tenantId }, { slug: tenantId }] },
        })

        if (tenant) {
          const dbIntegrations = await prisma.crmIntegration.findMany({
            where: {
              tenantId: tenant.id,
              provider: { in: DB_PROVIDERS },
              isActive: true,
            },
            select: { provider: true },
          })

          for (const provider of DB_PROVIDERS) {
            configured[provider] = dbIntegrations.some(i => i.provider === provider)
          }
        }
      } catch {
        // DB check failed, mark as not configured
        for (const provider of DB_PROVIDERS) {
          configured[provider] = false
        }
      }
    }

    return NextResponse.json({ configured })
  } catch (err) {
    console.error('[integrations/status] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
