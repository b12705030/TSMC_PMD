'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { AppNotification } from '@/types'

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [isLoading, setIsLoading]         = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.get<AppNotification[]>('/notifications')
      setNotifications(data)
      setUnreadCount(data.filter((n) => !n.read).length)
    } catch {
      // silent fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // 每 60 秒輪詢一次
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    await api.patch(`/notifications/${id}/read`, {})
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    setUnreadCount((c) => Math.max(0, c - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/read-all', {})
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  return { notifications, unreadCount, isLoading, markRead, markAllRead, refetch: fetchNotifications }
}
