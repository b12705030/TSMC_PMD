'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { PerformanceCycle } from '@/types'

export function useCycles() {
  const [cycles, setCycles] = useState<PerformanceCycle[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<PerformanceCycle[]>('/cycles')
      .then(setCycles)
      .catch(() => setCycles([]))
      .finally(() => setIsLoading(false))
  }, [])

  return { cycles, isLoading }
}
