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
