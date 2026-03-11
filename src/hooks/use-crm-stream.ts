// src/hooks/use-crm-stream.ts — Hook SSE para tempo real do CRM
'use client'

import { useEffect, useRef, useCallback } from 'react'

interface CrmEvent {
  type: string
  tenantId: string
  data: Record<string, unknown>
}

type EventHandler = (event: CrmEvent) => void

/**
 * Hook que conecta ao SSE do CRM via /api/crm/stream.
 * Reconecta automaticamente em caso de desconexão.
 */
export function useCrmStream(tenantId: string | null, onEvent: EventHandler): void {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const retryCountRef = useRef(0)

  const connect = useCallback(() => {
    if (!tenantId) return undefined

    const eventSource = new EventSource(`/api/crm/stream?tenantId=${encodeURIComponent(tenantId)}`)

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as CrmEvent
        retryCountRef.current = 0 // Reset retry count on successful message
        onEventRef.current(parsed)
      } catch {
        // Mensagem mal-formada — ignorar
      }
    }

    eventSource.onerror = () => {
      eventSource.close()

      // Reconexão com backoff exponencial (máx 30s)
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
      retryCountRef.current++

      setTimeout(() => {
        connect()
      }, delay)
    }

    return eventSource
  }, [tenantId])

  useEffect(() => {
    const eventSource = connect()
    return () => {
      eventSource?.close()
    }
  }, [connect])
}
