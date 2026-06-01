'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import type { User } from '@/types'

// 登出原因存進 sessionStorage，讓登入頁讀取並顯示提示
export const LOGOUT_REASON_KEY = 'logout-reason'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  // 監聽全域 401 事件（由 api.ts 觸發）
  useEffect(() => {
    const handler = (e: Event) => {
      const reason = (e as CustomEvent<{ reason: 'idle' | 'expired' }>).detail.reason
      sessionStorage.setItem(LOGOUT_REASON_KEY, reason)
      setUser(null)
    }
    globalThis.addEventListener('app:unauthorized', handler)
    return () => globalThis.removeEventListener('app:unauthorized', handler)
  }, [])

  const value = useMemo(() => ({ user, isLoading, setUser }), [user, isLoading, setUser])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
