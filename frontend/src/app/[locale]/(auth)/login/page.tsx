'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import type { User } from '@/types'

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuth()
  const t = useTranslations('login')
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
