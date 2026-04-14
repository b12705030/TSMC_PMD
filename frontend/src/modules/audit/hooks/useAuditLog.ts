'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { AuditLog } from '@/types'

export function useAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<AuditLog[]>('/audit')
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setIsLoading(false))
  }, [])

  return { logs, isLoading }
}
