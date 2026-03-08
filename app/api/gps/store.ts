// app/api/gps/store.ts
// In-memory store para posições GPS em tempo real
// Em produção, pode ser substituído por Redis para multi-instância

export type GpsPosition = {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
  heading?: number
  speed?: number
}

export type GpsSession = {
  appointmentId: string
  professionalId: string
  status: 'active' | 'arrived' | 'stopped'
  positions: GpsPosition[]
  lastPosition: GpsPosition | null
  startedAt: number
  destination: { lat: number; lng: number } | null
}

type SSEClient = {
  controller: ReadableStreamDefaultController
  appointmentId: string
}

// Store de sessões GPS ativas (por appointmentId)
const sessions = new Map<string, GpsSession>()

// Clientes SSE conectados (por appointmentId)
const sseClients = new Map<string, Set<SSEClient>>()

export function getSession(appointmentId: string): GpsSession | undefined {
  return sessions.get(appointmentId)
}

export function startSession(
  appointmentId: string,
  professionalId: string,
  destination?: { lat: number; lng: number }
): GpsSession {
  const session: GpsSession = {
    appointmentId,
    professionalId,
    status: 'active',
    positions: [],
    lastPosition: null,
    startedAt: Date.now(),
    destination: destination ?? null,
  }
  sessions.set(appointmentId, session)
  return session
}

export function updatePosition(appointmentId: string, position: GpsPosition): boolean {
  const session = sessions.get(appointmentId)
  if (!session || session.status !== 'active') return false

  session.lastPosition = position
  // Manter apenas as últimas 200 posições para economizar memória
  session.positions.push(position)
  if (session.positions.length > 200) {
    session.positions = session.positions.slice(-200)
  }

  // Notificar todos os clientes SSE
  broadcastToClients(appointmentId, {
    type: 'position',
    data: position,
  })

  return true
}

export function setArrived(appointmentId: string): boolean {
  const session = sessions.get(appointmentId)
  if (!session) return false

  session.status = 'arrived'

  broadcastToClients(appointmentId, {
    type: 'arrived',
    data: { timestamp: Date.now() },
  })

  return true
}

export function stopSession(appointmentId: string): boolean {
  const session = sessions.get(appointmentId)
  if (!session) return false

  session.status = 'stopped'

  broadcastToClients(appointmentId, {
    type: 'stopped',
    data: { timestamp: Date.now() },
  })

  // Limpar sessão após 5 minutos
  setTimeout(() => {
    sessions.delete(appointmentId)
  }, 5 * 60 * 1000)

  return true
}

// SSE Client management
export function addSSEClient(appointmentId: string, controller: ReadableStreamDefaultController): SSEClient {
  const client: SSEClient = { controller, appointmentId }
  if (!sseClients.has(appointmentId)) {
    sseClients.set(appointmentId, new Set())
  }
  sseClients.get(appointmentId)!.add(client)
  return client
}

export function removeSSEClient(client: SSEClient) {
  const clients = sseClients.get(client.appointmentId)
  if (clients) {
    clients.delete(client)
    if (clients.size === 0) {
      sseClients.delete(client.appointmentId)
    }
  }
}

function broadcastToClients(appointmentId: string, message: { type: string; data: unknown }) {
  const clients = sseClients.get(appointmentId)
  if (!clients) return

  const encoder = new TextEncoder()
  const payload = `data: ${JSON.stringify(message)}\n\n`

  const deadClients: SSEClient[] = []
  for (const client of clients) {
    try {
      client.controller.enqueue(encoder.encode(payload))
    } catch {
      deadClients.push(client)
    }
  }

  // Limpar clientes desconectados
  for (const client of deadClients) {
    clients.delete(client)
  }
}
