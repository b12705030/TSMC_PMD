'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Goal } from '@/types'

const errMsg = (err: unknown) => err instanceof Error ? err.message : '載入失敗'

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<Goal[]>('/goals')
      .then((data) => { setGoals(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { goals, isLoading, error, refetch: fetch }
}

export function useGoal(id: string) {
  const [goal, setGoal] = useState<Goal | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<Goal>(`/goals/${id}`)
      .then((data) => { setGoal(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { goal, isLoading, error, refetch: fetch }
}
