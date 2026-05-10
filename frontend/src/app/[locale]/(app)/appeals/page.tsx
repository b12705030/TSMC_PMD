'use client'

import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useAppeals } from '@/modules/appeals/hooks/useAppeals'
import type { Appeal } from '@/types'

function fmt(date: string) {
  return new Date(date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AppealsPage() {
  const { appeals, isLoading, error, refetch } = useAppeals()

  return (
    <div>
      <PageHeader title="申訴管理" description="審閱並回應員工的績效申訴。" />

      {isLoading ? (
        <p className="text-muted">載入中...</p>
      ) : error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : appeals.length === 0 ? (
        <EmptyState title="尚無申訴" description="目前尚無員工提交申訴。" />
      ) : (
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
                  週期：{appeal.review?.cycle.name ?? '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  提交時間：{fmt(appeal.createdAt)}
                  {appeal.resolvedAt && ` · 解決時間：${fmt(appeal.resolvedAt)}`}
                </p>
              </div>
              <Link
                href={`/appeals/${appeal.id}`}
                className="btn-secondary text-xs shrink-0"
              >
                {appeal.status === 'Pending' ? '審閱申訴' : '查看詳情'}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
