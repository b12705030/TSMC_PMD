'use client'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { LOGOUT_REASON_KEY } from '@/modules/auth/context/AuthContext'
import type { User } from '@/types'

const LOGOUT_NOTICES: Record<string, string> = {
  idle:    '已超過 30 分鐘未操作，系統自動登出。',
  expired: '登入階段已過期，請重新登入。',
}

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuth()
  const t = useTranslations('login')
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY)
    if (reason && LOGOUT_NOTICES[reason]) {
      setNotice(LOGOUT_NOTICES[reason])
      sessionStorage.removeItem(LOGOUT_REASON_KEY)
    }
  }, [])

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { user } = await api.post<{ user: User }>('/auth/login', { employeeId, password })
      setUser(user)
      router.push('/dashboard')
    } catch {
      setError(t('invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-600">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
        </div>

        {notice && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {notice}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">{t('signIn')}</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">{t('employeeId')}</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder={t('employeeIdPlaceholder')}
                required
                className="input"
              />
            </div>

            <div>
              <label className="label">{t('password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
              />
            </div>

            {error && <p className="text-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
