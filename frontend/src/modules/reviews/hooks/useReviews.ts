'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { PerformanceReview } from '@/types'

export function useReviews() {
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<PerformanceReview[]>('/reviews')
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setIsLoading(false))
  }, [])

  return { reviews, isLoading }
}

export function useReview(id: string) {
  const [review, setReview] = useState<PerformanceReview | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    api
      .get<PerformanceReview>(`/reviews/${id}`)
      .then(setReview)
      .catch(() => setReview(null))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { review, isLoading, refetch: fetch }
}
