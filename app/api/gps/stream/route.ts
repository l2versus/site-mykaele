// app/api/gps/stream/route.ts
// SSE endpoint — Cliente se conecta para receber atualizações em tempo real

import { NextRequest } from 'next/server'
import { addSSEClient, removeSSEClient, getSession } from '../store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const appointmentId = req.nextUrl.searchParams.get('appointmentId')
  if (!appointmentId) {
    return new Response('appointmentId é obrigatório', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Registrar cliente SSE
      const client = addSSEClient(appointmentId, controller)

      // Enviar estado inicial se sessão já existir
      const session = getSession(appointmentId)
      if (session) {
        const initialData = JSON.stringify({
          type: 'init',
          data: {
            status: session.status,
            lastPosition: session.lastPosition,
            destination: session.destination,
            startedAt: session.startedAt,
          },
        })
        controller.enqueue(encoder.encode(`data: ${initialData}\n\n`))
      } else {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'waiting' })}\n\n`))
      }

      // Heartbeat a cada 30s para manter conexão viva
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30000)

      // Cleanup quando o cliente desconectar
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        removeSSEClient(client)
        try { controller.close() } catch { /* já fechado */ }
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
