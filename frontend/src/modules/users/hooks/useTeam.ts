'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { User, Goal, PerformanceReview } from '@/types'

export function useTeam() {
  const [members, setMembers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<User[]>('/users/team')
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setIsLoading(false))
  }, [])

  return { members, isLoading }
}

interface EmployeeDetail {
  employee: User | null
  goals: Goal[]
  reviews: PerformanceReview[]
  isLoading: boolean
}

export function useEmployee(employeeId: string): EmployeeDetail {
  const [employee, setEmployee] = useState<User | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(() => {
    setIsLoading(true)
    Promise.all([
      api.get<User>(`/users/${employeeId}`),
      api.get<Goal[]>(`/users/${employeeId}/goals`),
      api.get<PerformanceReview[]>(`/users/${employeeId}/reviews`),
    ])
      .then(([emp, g, r]) => {
        setEmployee(emp)
        setGoals(g)
        setReviews(r)
      })
      .catch(() => {
        setEmployee(null)
        setGoals([])
        setReviews([])
      })
      .finally(() => setIsLoading(false))
  }, [employeeId])

  useEffect(() => { fetch() }, [fetch])

  return { employee, goals, reviews, isLoading }
}
