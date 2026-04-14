'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ReviewTemplate } from '@/types'

export function useTemplates() {
  const [templates, setTemplates] = useState<ReviewTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<ReviewTemplate[]>('/templates')
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setIsLoading(false))
  }, [])

  return { templates, isLoading }
}
