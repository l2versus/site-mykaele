// app/api/crm/stream/route.ts — SSE com Redis pub/sub para tempo real do CRM
import { NextRequest } from 'next/server'
import IORedis from 'ioredis'
import { isRedisReady } from '@/lib/redis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CRM_CHANNEL = 'crm:events'
const HEARTBEAT_MS = 25_000

export async function GET(req: NextRequest): Promise<Response> {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return new Response('tenantId é obrigatório', { status: 400 })
  }

  // Se Redis offline, retorna SSE vazio com heartbeat (não crasheia)
  if (!isRedisReady()) {
    console.error('[sse] Redis offline — SSE iniciado sem pub/sub')
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Subscriber dedicado (pub/sub exige conexão separada do Redis)
      const subscriber = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
        retryStrategy(times) {
          if (times > 10) return null
          return Math.min(times * 1000, 15_000)
        },
      })

      // Envia evento inicial
      const initPayload = JSON.stringify({ type: 'connected', tenantId })
      controller.enqueue(encoder.encode(`data: ${initPayload}\n\n`))

      // Handler de mensagens Redis pub/sub
      const onMessage = (_channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as { tenantId?: string }
          // Filtrar por tenant
          if (parsed.tenantId && parsed.tenantId !== tenantId) return
          controller.enqueue(encoder.encode(`data: ${message}\n\n`))
        } catch {
          // Mensagem mal-formada — ignorar
        }
      }

      subscriber.subscribe(CRM_CHANNEL).catch((err: unknown) => {
        console.error('[sse] Falha ao subscribar:', err instanceof Error ? err.message : err)
      })
      subscriber.on('message', onMessage)

      // Heartbeat a cada 25s para manter conexão viva
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, HEARTBEAT_MS)

      // Cleanup quando o cliente desconectar
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        subscriber.unsubscribe(CRM_CHANNEL).catch(() => {})
        subscriber.disconnect()
        try {
          controller.close()
        } catch {
          // já fechado
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

/**
 * Helper para publicar evento CRM via Redis.
 * Usar em qualquer lugar do backend para notificar clientes SSE.
 */
export async function publishCrmEvent(
  redis: IORedis,
  event: {
    type: string
    tenantId: string
    data: Record<string, unknown>
  },
): Promise<void> {
  await redis.publish(CRM_CHANNEL, JSON.stringify(event))
}
