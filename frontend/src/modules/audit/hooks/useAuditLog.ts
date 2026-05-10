'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { AuditLog } from '@/types'

export function useAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<AuditLog[]>('/audit')
      .then((data) => { setLogs(data); setError(null) })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '載入失敗'))
      .finally(() => setIsLoading(false))
  }, [])

  return { logs, isLoading, error }
}
