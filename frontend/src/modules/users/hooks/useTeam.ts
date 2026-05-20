'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { User, Goal, PerformanceReview } from '@/types'

export interface SupervisorGroup {
  supervisor: User
  employees: User[]
}

export interface TeamHierarchy {
  groups: SupervisorGroup[]
  directReports: User[]
}

const errMsg = (err: unknown) => err instanceof Error ? err.message : '載入失敗'

export function useTeamHierarchy() {
  const [hierarchy, setHierarchy] = useState<TeamHierarchy>({ groups: [], directReports: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<TeamHierarchy>('/users/team/hierarchy')
      .then((data) => { setHierarchy(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [])

  return { ...hierarchy, isLoading, error }
}

export function useTeam() {
  const [members, setMembers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<User[]>('/users/team')
      .then((data) => { setMembers(data); setError(null) })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [])

  return { members, isLoading, error }
}

interface EmployeeDetail {
  employee: User | null
  goals: Goal[]
  reviews: PerformanceReview[]
  isLoading: boolean
  error: string | null
}

export function useEmployee(employeeId: string): EmployeeDetail {
  const [employee, setEmployee] = useState<User | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setError(null)
      })
      .catch((err: unknown) => setError(errMsg(err)))
      .finally(() => setIsLoading(false))
  }, [employeeId])

  useEffect(() => { fetch() }, [fetch])

  return { employee, goals, reviews, isLoading, error }
}
