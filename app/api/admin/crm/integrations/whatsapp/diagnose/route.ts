// app/api/admin/crm/integrations/whatsapp/diagnose/route.ts
// Endpoint de diagnóstico — testa conectividade com a Evolution API
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const baseUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY

  const checks: Record<string, unknown> = {
    EVOLUTION_API_URL: baseUrl ? `${baseUrl} (configurada)` : 'NÃO CONFIGURADA',
    EVOLUTION_API_KEY: apiKey ? `${apiKey.slice(0, 4)}...(configurada)` : 'NÃO CONFIGURADA',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NÃO CONFIGURADA (usará localhost:3000)',
    DEFAULT_TENANT_ID: process.env.DEFAULT_TENANT_ID || 'NÃO CONFIGURADO',
    REDIS_URL: process.env.REDIS_URL ? 'configurada' : 'NÃO CONFIGURADA',
  }

  // Testar conectividade com a Evolution API
  if (baseUrl && apiKey) {
    const normalizedBase = baseUrl.replace(/\/+$/, '')
    try {
      const start = Date.now()
      const res = await fetch(`${normalizedBase}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        signal: AbortSignal.timeout(10_000),
      })
      const elapsed = Date.now() - start
      const body = await res.text().catch(() => '')

      checks.connectivity = {
        status: res.status,
        statusText: res.statusText,
        latencyMs: elapsed,
        responsePreview: body.slice(0, 500),
        success: res.ok,
      }

      if (res.ok) {
        try {
          const instances = JSON.parse(body)
          checks.instances = Array.isArray(instances)
            ? instances.map((i: { instance?: { instanceName?: string; status?: string } }) => ({
                name: i.instance?.instanceName,
                status: i.instance?.status,
              }))
            : 'Resposta não é array'
        } catch {
          checks.instances = 'Erro ao parsear resposta'
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      checks.connectivity = {
        success: false,
        error: msg,
        hint: msg.includes('timeout')
          ? 'A Evolution API não respondeu em 10s. Pode estar offline ou inacessível.'
          : msg.includes('ECONNREFUSED')
          ? `Conexão recusada em ${normalizedBase}. A porta pode estar fechada ou o serviço parado.`
          : 'Erro de rede. Verifique se o servidor Coolify consegue acessar o IP da Evolution API.',
      }
    }
  }

  return NextResponse.json(checks)
}
