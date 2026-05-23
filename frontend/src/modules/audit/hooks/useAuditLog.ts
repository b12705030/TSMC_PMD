'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { AuditLog } from '@/types'

interface AuditFilters {
  q?: string
  outcome?: string
  resource?: string
  from?: number
  size?: number
}

interface AuditResponse {
  data: AuditLog[]
  total: number
}

export function useAuditLog(filters: AuditFilters = {}) {
  const [logs, setLogs]       = useState<AuditLog[]>([])
  const [total, setTotal]     = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const { q = '', outcome = '', resource = '', from = 0, size = 50 } = filters

  useEffect(() => {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (q)        params.set('q', q)
    if (outcome)  params.set('outcome', outcome)
    if (resource) params.set('resource', resource)
    params.set('from', String(from))
    params.set('size', String(size))

    api
      .get<AuditResponse>(`/audit?${params.toString()}`)
      .then((res) => { setLogs(res.data); setTotal(res.total); setError(null) })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '載入失敗'))
      .finally(() => setIsLoading(false))
  }, [q, outcome, resource, from, size])

  return { logs, total, isLoading, error }
}
