'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Goal } from '@/types'

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<Goal[]>('/goals')
      .then(setGoals)
      .catch(() => setGoals([]))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { goals, isLoading, refetch: fetch }
}

export function useGoal(id: string) {
  const [goal, setGoal] = useState<Goal | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<Goal>(`/goals/${id}`)
      .then(setGoal)
      .catch(() => setGoal(null))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { goal, isLoading, refetch: fetch }
}
