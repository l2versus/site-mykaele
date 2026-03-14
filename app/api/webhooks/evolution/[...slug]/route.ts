// app/api/webhooks/evolution/[...slug]/route.ts — Catch-all para webhookByEvents
// Evolution API com webhookByEvents=true envia para URLs como:
//   /api/webhooks/evolution/messages-upsert
//   /api/webhooks/evolution/connection-update
// Este catch-all redireciona tudo para o handler principal.
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { inboxQueue } from '@/lib/queues'
import { processWebhookInline } from '@/lib/webhook-processor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HANDLED_EVENTS = new Set([
  'messages.upsert',
  'messages.update',
  'connection.update',
])

function normalizeEventName(event: string): string {
  return event.toLowerCase().replace(/_/g, '.').replace(/-/g, '.')
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const ip = getClientIP(req)
    const { allowed, resetIn } = rateLimit(`webhook:evolution:${ip}`, 120, 60_000)
    if (!allowed) return rateLimitResponse(resetIn)

    const rawBody = await req.text()

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    // Extrair evento do body OU do slug da URL
    const rawEvent = (payload.event as string) ?? ''
    const event = normalizeEventName(rawEvent)
    const instance = (payload.instance as string) ?? ''

    if (!HANDLED_EVENTS.has(event)) {
      return NextResponse.json({ status: 'ignored', event: rawEvent })
    }

    let rawData = (payload.data ?? payload) as Record<string, unknown> | Record<string, unknown>[]
    if (Array.isArray(rawData)) {
      if (rawData.length === 0) {
        return NextResponse.json({ status: 'ignored', reason: 'empty data array' })
      }
      rawData = rawData[0]
    }

    const webhookData = {
      event,
      instance,
      data: rawData as Record<string, unknown>,
      receivedAt: new Date().toISOString(),
    }

    const jobId = `${instance}:${event}:${Date.now()}`
    const queued = await inboxQueue.add('webhook-event', webhookData, { jobId })

    if (queued) {
      return NextResponse.json({ status: 'queued', jobId })
    }

    try {
      await processWebhookInline(webhookData as Parameters<typeof processWebhookInline>[0])
      return NextResponse.json({ status: 'processed-inline', jobId })
    } catch (fallbackErr) {
      console.error('[webhook/evolution/catch-all] Fallback falhou:', fallbackErr instanceof Error ? fallbackErr.message : fallbackErr)
      return NextResponse.json({ error: 'Falha no processamento' }, { status: 500 })
    }
  } catch (err) {
    console.error('[webhook/evolution/catch-all] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
