'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { PerformanceCycle } from '@/types'

export interface CreateCyclePayload {
  name: string
  type: 'Annual' | 'Quarterly' | 'Probation'
  regions: string[]
  goalSettingStart: string
  goalSettingEnd: string
  reviewStart: string
  reviewEnd: string
}

export interface UpdateCyclePayload {
  name?: string
  regions?: string[]
  goalSettingStart?: string
  goalSettingEnd?: string
  reviewStart?: string
  reviewEnd?: string
}

export function useCycles() {
  const [cycles, setCycles] = useState<PerformanceCycle[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function fetchCycles() {
    setIsLoading(true)
    api
      .get<PerformanceCycle[]>('/cycles')
      .then(setCycles)
      .catch(() => setCycles([]))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchCycles() }, [])

  async function createCycle(payload: CreateCyclePayload): Promise<PerformanceCycle> {
    const cycle = await api.post<PerformanceCycle>('/cycles', payload)
    setCycles((prev) => [cycle, ...prev])
    return cycle
  }

  async function updateCycle(id: string, payload: UpdateCyclePayload): Promise<void> {
    const updated = await api.patch<PerformanceCycle>(`/cycles/${id}`, payload)
    setCycles((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  async function advanceStatus(id: string): Promise<void> {
    const updated = await api.patch<PerformanceCycle>(`/cycles/${id}/advance`, {})
    setCycles((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  return { cycles, isLoading, createCycle, updateCycle, advanceStatus }
}
