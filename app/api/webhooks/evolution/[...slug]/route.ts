// app/api/webhooks/evolution/[...slug]/route.ts — Catch-all para webhookByEvents
// Evolution API com webhookByEvents=true envia para URLs como:
//   /api/webhooks/evolution/messages-upsert
//   /api/webhooks/evolution/connection-update
// Este catch-all redireciona tudo para o handler principal.
//
// v2: Auto-heal — reconfigura webhooks ao detectar reconexão.
// v2: Retry inline — se processamento falha, tenta novamente 1x.
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
  'qrcode.updated',
])

// Track do último webhook recebido (health check)
let lastWebhookAt = Date.now()
export function getLastWebhookTimestamp(): number { return lastWebhookAt }

function normalizeEventName(event: string): string {
  return event.toLowerCase().replace(/_/g, '.').replace(/-/g, '.')
}

/**
 * Auto-heal: quando a conexão reconecta, reconfigurar os webhooks.
 * Issue #1559 da Evolution API — toggles de webhook resetam após reconexão.
 */
async function handleConnectionUpdate(instance: string, data: Record<string, unknown>): Promise<void> {
  const state = data.state as string | undefined
  const statusReason = data.statusReason as number | undefined

  console.error(`[webhook/connection] Instance=${instance} state=${state} statusReason=${statusReason}`)

  // Só reconfigura quando conecta (não quando desconecta)
  if (state !== 'open') return

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mykaprocopio.com.br'
  const webhookUrl = `${siteUrl}/api/webhooks/evolution`
  const apiUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY

  if (!apiUrl || !apiKey) return

  try {
    const res = await fetch(`${apiUrl}/webhook/set/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: true,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ],
      }),
      signal: AbortSignal.timeout(5_000),
    })

    if (res.ok) {
      console.error(`[webhook/auto-heal] ✓ Webhook reconfigurado para instance=${instance}`)
    } else {
      console.error(`[webhook/auto-heal] ✗ Falha ao reconfigurar webhook: ${res.status}`)
    }
  } catch (err) {
    console.error('[webhook/auto-heal] Erro ao reconfigurar:', err instanceof Error ? err.message : err)
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  lastWebhookAt = Date.now()

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

    // Auto-heal: reconfigurar webhooks quando reconecta
    if (event === 'connection.update') {
      void handleConnectionUpdate(instance, (payload.data ?? payload) as Record<string, unknown>)
      return NextResponse.json({ status: 'connection-update-processed' })
    }

    // QR code — apenas logar
    if (event === 'qrcode.updated') {
      console.error(`[webhook/qrcode] Instance=${instance} QR code atualizado`)
      return NextResponse.json({ status: 'qrcode-logged' })
    }

    if (!event.startsWith('messages.')) {
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

    // Tentar enfileirar no BullMQ (se Redis disponível)
    const msgId = (rawData as Record<string, unknown>)?.key && typeof (rawData as Record<string, unknown>).key === 'object'
      ? ((rawData as Record<string, unknown>).key as Record<string, unknown>)?.id as string
      : undefined
    const jobId = msgId ? `${instance}:${msgId}` : `${instance}:${event}:${Date.now()}`

    const queued = await inboxQueue.add('webhook-event', webhookData, { jobId })
    if (queued) {
      return NextResponse.json({ status: 'queued', jobId })
    }

    // Fallback: processar inline com retry
    try {
      await processWebhookInline(webhookData as Parameters<typeof processWebhookInline>[0])
      return NextResponse.json({ status: 'processed-inline', jobId })
    } catch (firstErr) {
      console.error('[webhook] Primeiro processamento falhou, tentando retry:', firstErr instanceof Error ? firstErr.message : firstErr)

      // RETRY: tentar uma segunda vez após 500ms
      try {
        await new Promise(resolve => setTimeout(resolve, 500))
        await processWebhookInline(webhookData as Parameters<typeof processWebhookInline>[0])
        return NextResponse.json({ status: 'processed-inline-retry', jobId })
      } catch (retryErr) {
        console.error('[webhook] RETRY também falhou:', retryErr instanceof Error ? retryErr.message : retryErr)
        return NextResponse.json({ error: 'Falha no processamento (2 tentativas)' }, { status: 500 })
      }
    }
  } catch (err) {
    console.error('[webhook/evolution/catch-all] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
