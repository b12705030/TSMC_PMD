'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { PerformanceReviewDetail } from '@/types'

export function useReviews() {
  const [reviews, setReviews] = useState<PerformanceReviewDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<PerformanceReviewDetail[]>('/reviews')
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { reviews, isLoading, refetch: fetch }
}

export function useReview(id: string) {
  const [review, setReview] = useState<PerformanceReviewDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<PerformanceReviewDetail>(`/reviews/${id}`)
      .then(setReview)
      .catch(() => setReview(null))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { review, isLoading, refetch: fetch }
}

export function useTeamReviews() {
  const [reviews, setReviews] = useState<PerformanceReviewDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<PerformanceReviewDetail[]>('/reviews/team')
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { reviews, isLoading, refetch: fetch }
}
