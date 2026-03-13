// app/api/admin/crm/integrations/status/route.ts — Check configured integrations
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

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

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const configured: Record<string, boolean> = {}

    for (const [id, envVars] of Object.entries(ENV_VAR_MAP)) {
      // Integration is configured if ALL required env vars are present and non-empty
      configured[id] = envVars.every(v => {
        const val = process.env[v]
        return val !== undefined && val !== '' && val !== null
      })
    }

    return NextResponse.json({ configured })
  } catch (err) {
    console.error('[integrations/status] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
