'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Role, User } from '@/types'

interface UserFilters {
  search?: string
  role?: string
  regionId?: string
  from?: number
  size?: number
}

interface UsersResponse {
  users: User[]
  total: number
}

export interface UpdateUserPayload {
  role?: Role
  regionId?: string
  departmentId?: string
  jobLevel?: string
  jobTitle?: string
}

export interface CreateUserPayload {
  employeeId: string
  name: string
  email: string
  role: Role
  regionId: string
  departmentId: string
  jobLevel: string
  jobTitle: string
}

export function useUsers(filters: UserFilters = {}) {
  const [users, setUsers]       = useState<User[]>([])
  const [total, setTotal]       = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const { search = '', role = '', regionId = '', from = 0, size = 50 } = filters

  const load = useCallback(() => {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (search)   params.set('search', search)
    if (role)     params.set('role', role)
    if (regionId) params.set('regionId', regionId)
    params.set('from', String(from))
    params.set('size', String(size))

    api
      .get<UsersResponse>(`/users?${params.toString()}`)
      .then((res) => { setUsers(res.users); setTotal(res.total); setError(null) })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '載入失敗'))
      .finally(() => setIsLoading(false))
  }, [search, role, regionId, from, size])

  useEffect(() => { load() }, [load])

  async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
    const updated = await api.patch<User>(`/users/${id}`, payload)
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
    return updated
  }

  async function createUser(payload: CreateUserPayload): Promise<User> {
    const created = await api.post<User>('/users', payload)
    load()
    return created
  }

  return { users, total, isLoading, error, refetch: load, updateUser, createUser }
}
