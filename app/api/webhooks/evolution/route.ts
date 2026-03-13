// app/api/webhooks/evolution/route.ts — Webhook da Evolution API
// HMAC + rate limit + enfileirar (fallback inline se Redis offline)
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { rateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { inboxQueue } from '@/lib/queues'
import { processWebhookInline } from '@/lib/webhook-processor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Tipos de evento que o CRM processa */
const HANDLED_EVENTS = new Set([
  'messages.upsert',
  'messages.update',
  'connection.update',
])

/**
 * Valida HMAC-SHA256 do webhook.
 * Se EVOLUTION_WEBHOOK_SECRET não estiver definida, aceita qualquer request (dev mode).
 */
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (!secret) return true // Dev mode — sem validação

  if (!signature) return false

  const expected = createHmac('sha256', secret).update(body).digest('hex')
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    )
  } catch {
    return false
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit: 120 requests por minuto por IP
    const ip = getClientIP(req)
    const { allowed, resetIn } = rateLimit(`webhook:evolution:${ip}`, 120, 60_000)
    if (!allowed) {
      return rateLimitResponse(resetIn)
    }

    // Ler body como texto para validação HMAC
    const rawBody = await req.text()

    // Verificar assinatura
    const signature = req.headers.get('x-webhook-signature')
      ?? req.headers.get('x-evolution-signature')
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    // Parse do payload
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const event = (payload.event as string) ?? ''
    const instance = (payload.instance as string) ?? ''

    // Ignorar eventos não processados
    if (!HANDLED_EVENTS.has(event)) {
      return NextResponse.json({ status: 'ignored', event })
    }

    // Tentar enfileirar para processamento assíncrono
    const webhookData = {
      event,
      instance,
      data: (payload.data ?? payload) as Record<string, unknown>,
      receivedAt: new Date().toISOString(),
    }

    const jobId = `${instance}:${event}:${Date.now()}`
    const queued = await inboxQueue.add('webhook-event', webhookData, { jobId })

    if (queued) {
      return NextResponse.json({ status: 'queued', jobId })
    }

    // Fallback: Redis offline — processar inline para não perder mensagens
    try {
      await processWebhookInline(webhookData as Parameters<typeof processWebhookInline>[0])
      return NextResponse.json({ status: 'processed-inline', jobId })
    } catch (fallbackErr) {
      console.error('[webhook/evolution] Fallback inline falhou:', fallbackErr instanceof Error ? fallbackErr.message : fallbackErr)
      return NextResponse.json({ error: 'Falha no processamento' }, { status: 500 })
    }
  } catch (err) {
    console.error('[webhook/evolution] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
