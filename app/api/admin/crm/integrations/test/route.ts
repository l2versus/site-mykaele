// app/api/admin/crm/integrations/test/route.ts — Test integration connectivity
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// POST — Test connection to an external service
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { provider, url, apiKey } = body

    if (!provider) {
      return NextResponse.json({ error: 'provider é obrigatório' }, { status: 400 })
    }

    if (provider === 'n8n') {
      if (!url) {
        return NextResponse.json({ error: 'URL da instância n8n é obrigatória' }, { status: 400 })
      }

      // Normalize URL
      const baseUrl = url.replace(/\/+$/, '')

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8_000)

        // Try the n8n health endpoint
        const headers: Record<string, string> = { 'Accept': 'application/json' }
        if (apiKey) {
          headers['X-N8N-API-KEY'] = apiKey
        }

        const res = await fetch(`${baseUrl}/api/v1/workflows?limit=1`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (res.ok) {
          return NextResponse.json({
            ok: true,
            message: 'Conexão com n8n estabelecida com sucesso!',
            status: res.status,
          })
        }

        // 401/403 means it's reachable but auth failed
        if (res.status === 401 || res.status === 403) {
          return NextResponse.json({
            ok: false,
            message: apiKey
              ? 'n8n acessível, mas a API Key é inválida. Verifique a chave.'
              : 'n8n acessível, mas requer autenticação. Forneça uma API Key.',
            status: res.status,
          })
        }

        // Other errors - try just a simple GET to the base URL
        const fallbackRes = await fetch(baseUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5_000),
        })
        if (fallbackRes.ok || fallbackRes.status < 500) {
          return NextResponse.json({
            ok: true,
            message: `n8n acessível (status ${fallbackRes.status}). API retornou ${res.status} — verifique a API Key.`,
            status: fallbackRes.status,
          })
        }

        return NextResponse.json({
          ok: false,
          message: `n8n retornou status ${res.status}. Verifique a URL e a API Key.`,
          status: res.status,
        })
      } catch (err) {
        const isTimeout = err instanceof DOMException && err.name === 'AbortError'
        const isConnRefused = err instanceof TypeError && (
          String(err.message).includes('ECONNREFUSED') ||
          String(err.message).includes('fetch failed')
        )
        return NextResponse.json({
          ok: false,
          message: isTimeout
            ? 'Timeout: n8n não respondeu em 8 segundos. Verifique se está rodando.'
            : isConnRefused
              ? 'Conexão recusada. Verifique se o n8n está rodando e a URL está correta.'
              : `Erro de conexão: ${err instanceof Error ? err.message : 'desconhecido'}`,
        })
      }
    }

    if (provider === 'google-calendar') {
      if (!apiKey) {
        return NextResponse.json({ error: 'API Key ou Client ID é obrigatório' }, { status: 400 })
      }

      // For Google Calendar, we can verify the API key by making a simple request
      try {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/colors?key=${apiKey}`,
          { signal: AbortSignal.timeout(8_000) }
        )
        if (res.ok) {
          return NextResponse.json({
            ok: true,
            message: 'API Key do Google Calendar é válida!',
          })
        }
        const data = await res.json().catch(() => null)
        return NextResponse.json({
          ok: false,
          message: data?.error?.message ?? `Google API retornou status ${res.status}`,
        })
      } catch (err) {
        return NextResponse.json({
          ok: false,
          message: `Erro de conexão: ${err instanceof Error ? err.message : 'desconhecido'}`,
        })
      }
    }

    return NextResponse.json({ error: 'Provider não suportado para teste' }, { status: 400 })
  } catch (err) {
    console.error('[integrations/test] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
