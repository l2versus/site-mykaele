// app/api/crm/test-ai/route.ts — Testa conexão com provedor de IA (server-side)
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const user = token ? verifyToken(token) : null
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { provider, apiKey: rawApiKey, baseUrl, useStoredKey } = await req.json()

  // Se a key está mascarada ou useStoredKey=true, buscar do banco
  let apiKey = rawApiKey
  if (useStoredKey || !apiKey || apiKey.includes('*')) {
    const tenantSlug = process.env.DEFAULT_TENANT_ID || ''
    let tenantId = tenantSlug
    const tenant = await prisma.crmTenant.findUnique({ where: { slug: tenantSlug } })
    if (tenant) tenantId = tenant.id

    const integration = await prisma.crmIntegration.findFirst({
      where: { tenantId, provider: 'ai-settings' },
    })
    const creds = integration?.credentials as Record<string, unknown> | null
    if (creds?.apiKey && !String(creds.apiKey).includes('*')) {
      apiKey = String(creds.apiKey)
    } else {
      // Fallback: tentar variável de ambiente
      apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || ''
    }
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Nenhuma API key encontrada — insira uma no campo acima' }, { status: 400 })
  }

  try {
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json(
          { error: `Gemini retornou ${res.status}: ${(err as { error?: { message?: string } })?.error?.message ?? 'verifique a API key'}` },
          { status: 400 }
        )
      }
      return NextResponse.json({ ok: true })
    }

    // Claude (Anthropic) — API própria
    if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json(
          { error: `Claude retornou ${res.status}: ${(err as { error?: { message?: string } })?.error?.message ?? 'verifique a API key'}` },
          { status: 400 }
        )
      }
      return NextResponse.json({ ok: true })
    }

    // Outros provedores compatíveis com OpenAI
    const BASE_URLS: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      groq: 'https://api.groq.com/openai/v1',
      together: 'https://api.together.xyz/v1',
      openrouter: 'https://openrouter.ai/api/v1',
    }
    const url = (baseUrl || BASE_URLS[provider] || '') + '/models'
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Erro ${res.status} — verifique a API key` },
        { status: 400 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha na conexão' },
      { status: 500 }
    )
  }
}
