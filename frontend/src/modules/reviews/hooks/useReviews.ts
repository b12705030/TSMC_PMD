'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { PerformanceReviewDetail } from '@/types'

const errMsg = (err: unknown) => err instanceof Error ? err.message : '載入失敗'

export function useReviews() {
  const [reviews, setReviews] = useState<PerformanceReviewDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<PerformanceReviewDetail[]>('/reviews')
      .then((data) => { setReviews(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { reviews, isLoading, error, refetch: fetch }
}

export function useReview(id: string) {
  const [review, setReview] = useState<PerformanceReviewDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<PerformanceReviewDetail>(`/reviews/${id}`)
      .then((data) => { setReview(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { review, isLoading, error, refetch: fetch }
}

export function useTeamReviews() {
  const [reviews, setReviews] = useState<PerformanceReviewDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<PerformanceReviewDetail[]>('/reviews/team')
      .then((data) => { setReviews(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { reviews, isLoading, error, refetch: fetch }
}

export interface ReviewStats {
  total: number
  gradeDistribution: Record<string, number>
  statusCount: Record<string, number>
}

export function useReviewStats() {
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api.get<ReviewStats>('/reviews/stats')
      .then((data) => { setStats(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { stats, isLoading, error }
}

export function useCycleReviews(cycleId: string) {
  const [reviews, setReviews] = useState<PerformanceReviewDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api
      .get<PerformanceReviewDetail[]>(`/reviews/calibrate/${cycleId}`)
      .then((data) => { setReviews(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [cycleId])

  useEffect(() => { fetch() }, [fetch])

  return { reviews, isLoading, error, refetch: fetch }
}
