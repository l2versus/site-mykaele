// src/lib/webhook-dispatcher.ts — Dispara webhooks de saída para URLs externas
// Quando eventos CRM ocorrem (lead criado, ganho, perdido, mensagem recebida, etc.),
// este módulo busca os webhooks configurados e envia os payloads.
// Retry automático: 1min, 5min, 30min.

import { prisma } from '@/lib/prisma'

export type WebhookEvent =
  | 'lead.created'
  | 'lead.won'
  | 'lead.lost'
  | 'lead.stage_changed'
  | 'message.received'
  | 'proposal.accepted'
  | 'nps.responded'

const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000] // 1min, 5min, 30min

interface WebhookOutgoing {
  id: string
  name: string
  url: string
  events: string[]
  headers: Record<string, string> | null
  isActive: boolean
}

/**
 * Dispara todos os webhooks de saída registrados para um evento.
 * Fire-and-forget — não bloqueia a operação principal.
 */
export function fireOutgoingWebhooks(
  tenantId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): void {
  void _dispatch(tenantId, event, payload).catch((err: unknown) => {
    console.error('[webhook-dispatcher] Erro:', err instanceof Error ? err.message : err)
  })
}

async function _dispatch(
  tenantId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  // Buscar webhooks ativos que escutam este evento
  const rows = await prisma.$queryRawUnsafe<WebhookOutgoing[]>(
    `SELECT id, name, url, events, headers, "isActive"
     FROM crm_webhooks_outgoing
     WHERE "tenantId" = $1 AND "isActive" = true`,
    tenantId,
  )

  const webhooks = rows.filter((w) => {
    const events = Array.isArray(w.events) ? w.events : []
    return events.includes(event) || events.includes('*')
  })

  if (webhooks.length === 0) return

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  })

  for (const webhook of webhooks) {
    void _sendWithRetry(tenantId, webhook, event, body, 0)
  }
}

async function _sendWithRetry(
  tenantId: string,
  webhook: WebhookOutgoing,
  event: string,
  body: string,
  attempt: number,
): Promise<void> {
  let responseStatus: number | null = null
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CRM-Webhook/1.0',
      ...(webhook.headers ?? {}),
    }

    const res = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    })

    responseStatus = res.status

    // Log de sucesso
    await _logWebhook(tenantId, webhook.id, 'out', event, body, responseStatus, attempt + 1)

    // Se não foi sucesso (2xx), tentar novamente
    if (res.status >= 300) {
      throw new Error(`HTTP ${res.status}`)
    }
  } catch (err) {
    // Log de falha
    await _logWebhook(tenantId, webhook.id, 'out', event, body, responseStatus, attempt + 1)

    // Retry se ainda há tentativas
    if (attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[attempt]!
      setTimeout(() => {
        void _sendWithRetry(tenantId, webhook, event, body, attempt + 1)
      }, delay)
    }
  }
}

async function _logWebhook(
  tenantId: string,
  webhookId: string,
  direction: 'in' | 'out',
  event: string,
  payload: string,
  responseStatus: number | null,
  attempts: number,
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO crm_webhook_logs (id, "tenantId", "webhookId", direction, event, payload, "responseStatus", attempts, "lastAttemptAt", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6, $7, NOW(), NOW())`,
      tenantId,
      webhookId,
      direction,
      event,
      payload,
      responseStatus,
      attempts,
    )
  } catch (err) {
    console.error('[webhook-dispatcher] Falha ao gravar log:', err instanceof Error ? err.message : err)
  }
}
