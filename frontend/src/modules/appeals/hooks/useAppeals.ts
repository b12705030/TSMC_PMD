'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Appeal } from '@/types'

export function useAppeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<Appeal[]>('/appeals')
      .then(setAppeals)
      .catch(() => setAppeals([]))
      .finally(() => setIsLoading(false))
  }, [])

  return { appeals, isLoading }
}
