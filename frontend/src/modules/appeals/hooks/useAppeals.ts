'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Appeal } from '@/types'

const errMsg = (err: unknown) => err instanceof Error ? err.message : '載入失敗'

export function useAppeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api.get<Appeal[]>('/appeals')
      .then((data) => { setAppeals(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { appeals, isLoading, error, refetch: fetch }
}

// 員工：查詢未讀的申訴結果通知數（每 60 秒輪詢一次）
// enabled: 僅 Employee 角色傳入 true，其他角色不輪詢以避免 403
export function useAppealUnreadCount(enabled = false) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const load = () => {
      api.get<{ count: number }>('/appeals/my-unread-count')
        .then((data) => setCount(data.count))
        .catch(() => {}) // 非關鍵功能，靜默失敗
    }
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [enabled])

  return count
}

export function useAppeal(id: string) {
  const [appeal, setAppeal] = useState<Appeal | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api.get<Appeal>(`/appeals/${id}`)
      .then((data) => { setAppeal(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { appeal, isLoading, error, refetch: fetch }
}
