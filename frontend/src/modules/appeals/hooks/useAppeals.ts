'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Appeal } from '@/types'

export function useAppeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api.get<Appeal[]>('/appeals')
      .then(setAppeals)
      .catch(() => setAppeals([]))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { appeals, isLoading, refetch: fetch }
}

export function useAppeal(id: string) {
  const [appeal, setAppeal] = useState<Appeal | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api.get<Appeal>(`/appeals/${id}`)
      .then(setAppeal)
      .catch(() => setAppeal(null))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { appeal, isLoading, refetch: fetch }
}
