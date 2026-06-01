'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useAppeals } from '@/modules/appeals/hooks/useAppeals'
import type { Appeal } from '@/types'

function fmt(date: string) {
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AppealsPage() {
  const t = useTranslations('appeals')

  const { appeals, isLoading, error, refetch } = useAppeals()

  let content: React.ReactNode
  if (isLoading) {
    content = <Loading />
  } else if (error) {
    content = <ErrorBanner message={error} onRetry={refetch} />
  } else if (appeals.length === 0) {
    content = <EmptyState title={t('empty.title')} description={t('empty.desc')} />
  } else {
    content = (
      <div className="space-y-3">
        {appeals.map((appeal: Appeal) => (
          <div key={appeal.id} className="card flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-gray-900">
                  {appeal.employee?.name ?? appeal.employeeId}
                </p>
                <span className="text-xs text-gray-400">
                  {appeal.employee?.jobTitle} · {appeal.employee?.jobLevel}
                </span>
                <StatusBadge status={appeal.status} />
              </div>
              <p className="text-sm text-gray-500 truncate max-w-xl">
                {t('cycle', { name: appeal.review?.cycle.name ?? '—' })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('submitted', { date: fmt(appeal.createdAt) })}
                {appeal.resolvedAt && t('resolved', { date: fmt(appeal.resolvedAt) })}
              </p>
            </div>
            <Link
              href={`/appeals/${appeal.id}`}
              className="btn-secondary text-xs shrink-0"
            >
              {appeal.status === 'Pending' ? t('reviewBtn') : t('viewBtn')}
            </Link>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('pageTitle')} description={t('pageDesc')} />
      {content}
    </div>
  )
}
