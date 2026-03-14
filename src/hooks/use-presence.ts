'use client'

// src/hooks/use-presence.ts — Hook de presença em tempo real
// Envia heartbeat a cada 30s e lista usuários online
import { useEffect, useState, useCallback, useRef } from 'react'

const HEARTBEAT_INTERVAL = 30_000 // 30s
const FETCH_INTERVAL = 15_000 // 15s

interface OnlineUser {
  userId: string
  userName: string
  status: 'online' | 'offline'
  lastSeen: string
  currentPage?: string
}

export function usePresence(tenantId: string, currentPage?: string) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const getToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('admin_token') || localStorage.getItem('token')
  }

  // Enviar heartbeat
  const sendHeartbeat = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      await fetch('/api/admin/crm/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId, currentPage }),
      })
    } catch {
      // Silencioso — heartbeat é best-effort
    }
  }, [tenantId, currentPage])

  // Buscar usuários online
  const fetchOnline = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch(`/api/admin/crm/presence?tenantId=${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.users)) setOnlineUsers(data.users)
    } catch {
      // Silencioso
    }
  }, [tenantId])

  // Marcar como offline ao sair
  const markOffline = useCallback(async () => {
    const token = getToken()
    if (!token) return
    try {
      // keepalive garante envio mesmo durante unload (substitui sendBeacon)
      await fetch(`/api/admin/crm/presence?tenantId=${tenantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      })
    } catch {
      // Best-effort
    }
  }, [tenantId])

  useEffect(() => {
    // Heartbeat imediato + intervalo
    sendHeartbeat()
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    // Fetch online users imediato + intervalo
    fetchOnline()
    fetchRef.current = setInterval(fetchOnline, FETCH_INTERVAL)

    // Marcar offline no unload/visibilitychange
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        markOffline()
      } else {
        sendHeartbeat()
      }
    }

    const handleBeforeUnload = () => {
      markOffline()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (fetchRef.current) clearInterval(fetchRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      markOffline()
    }
  }, [sendHeartbeat, fetchOnline, markOffline])

  return { onlineUsers }
}
