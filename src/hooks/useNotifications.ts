'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * useNotifications — Push notification system
 * Integrates with Service Worker for native push notifications
 * 
 * Features:
 * - Request permission with elegant UI
 * - Subscribe to push notifications
 * - Send local notifications for appointments
 * - Smart reminder scheduling
 */

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    const supported = typeof window !== 'undefined'
      && 'Notification' in window
      && 'serviceWorker' in navigator
    setIsSupported(supported)
    if (supported) {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'denied'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [isSupported])

  // Subscribe to push (server-side push via VAPID)
  const subscribeToPush = useCallback(async () => {
    if (!isSupported) return null
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })
      // Send subscription to server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      return subscription
    } catch (err) {
      console.error('Push subscription failed:', err)
      return null
    }
  }, [isSupported])

  // Schedule a local notification (for appointment reminders)
  const scheduleReminder = useCallback(async (title: string, body: string, scheduledTime: Date) => {
    if (!isSupported || permission !== 'granted') return

    const delay = scheduledTime.getTime() - Date.now()
    if (delay <= 0) return

    // Use setTimeout for client-side scheduling (up to 24h)
    if (delay < 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        const registration = navigator.serviceWorker.ready
        registration.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: `reminder-${scheduledTime.getTime()}`,
            data: { url: '/cliente/agendamentos' },
          } as NotificationOptions)
        })
      }, delay)
    }
  }, [isSupported, permission])

  // Send immediate notification
  const notify = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      ...options,
    } as NotificationOptions)
  }, [isSupported, permission])

  return {
    permission,
    isSupported,
    requestPermission,
    subscribeToPush,
    scheduleReminder,
    notify,
  }
}
