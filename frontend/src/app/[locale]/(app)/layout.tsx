'use client'

import { Suspense, useCallback, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Sidebar } from '@/components/Sidebar'
import { IdleWatcher } from '@/components/IdleWatcher'
import { DeadlineToast } from '@/components/DeadlineToast'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading, setUser } = useAuth()
  const t = useTranslations('common')

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
      <div className="flex h-screen items-center justify-center">
        <span className="text-muted">{t('loading')}</span>
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
