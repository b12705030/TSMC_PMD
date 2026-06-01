'use client'

import { Suspense, useCallback, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Sidebar } from '@/components/Sidebar'
import { IdleWatcher } from '@/components/IdleWatcher'
import { DeadlineToast } from '@/components/DeadlineToast'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter()
  const { user, isLoading, setUser } = useAuth()
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  const handleIdle = useCallback(async () => {
    await api.post('/auth/logout', {}).catch(() => {})
    setUser(null)
    router.push('/login')
  }, [router, setUser])

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        {/* Skeleton Sidebar */}
        <div className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
          <div className="flex h-16 items-center border-b border-gray-200 px-4 gap-2">
            <div className="h-5 w-10 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
          </div>
          <div className="flex-1 px-3 py-4 space-y-1">
            {[
              { id: 'sk-0', w: 80 }, { id: 'sk-1', w: 64 }, { id: 'sk-2', w: 72 },
              { id: 'sk-3', w: 64 }, { id: 'sk-4', w: 72 }, { id: 'sk-5', w: 56 },
              { id: 'sk-6', w: 68 }, { id: 'sk-7', w: 60 }, { id: 'sk-8', w: 72 },
            ].map(({ id, w }) => (
              <div key={id} className="flex items-center gap-3 px-2 py-2">
                <div className="h-4 w-4 rounded bg-gray-200 animate-pulse shrink-0" />
                <div className="h-3 rounded bg-gray-100 animate-pulse" style={{ width: w }} />
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 p-4 space-y-2">
            <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
            <div className="mt-2 h-7 w-full rounded-md bg-gray-100 animate-pulse" />
          </div>
        </div>

        {/* Skeleton Main */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Page title */}
          <div className="h-7 w-48 rounded-lg bg-gray-200 animate-pulse" />

          {/* Cards row */}
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
                <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                <div className="h-8 w-12 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-32 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>

          {/* Wide card */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-full rounded bg-gray-100 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-gray-100 animate-pulse" />
            <div className="h-3 w-4/6 rounded bg-gray-100 animate-pulse" />
          </div>

          {/* List items */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-48 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="h-6 w-16 rounded-full bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
      <DeadlineToast />
      <IdleWatcher onIdle={handleIdle} />
    </div>
  )
}
