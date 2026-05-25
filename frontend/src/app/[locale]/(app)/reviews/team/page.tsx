'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useTeamReviews } from '@/modules/reviews/hooks/useReviews'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import type { PerformanceReviewDetail, ReviewGrade, ReviewStatus } from '@/types'

const GRADE_DISPLAY: Record<ReviewGrade, string> = {
  O: 'O', S_Plus: 'S+', S: 'S', S_Minus: 'S-', I: 'I', U: 'U',
}

const GRADE_TEXT_COLOR: Record<ReviewGrade, string> = {
  O:       'text-green-600',
  S_Plus:  'text-indigo-600',
  S:       'text-indigo-600',
  S_Minus: 'text-indigo-500',
  I:       'text-amber-600',
  U:       'text-red-500',
}

export default function TeamReviewsPage() {
  const t = useTranslations('reviews')
  const tCommon = useTranslations('common')
  const { reviews, isLoading, error, refetch } = useTeamReviews()
  const { user } = useAuth()
  const isManager    = user?.role === 'Manager'
  const isSupervisor = user?.role === 'Supervisor'

  const pendingCount = reviews.filter((r) => r.status === 'PendingSupervisorReview').length

  const cycleMap = new Map<string, { id: string; name: string; pendingApproval: number }>()
  if (isManager) {
    for (const r of reviews) {
      if (!cycleMap.has(r.cycleId)) {
        cycleMap.set(r.cycleId, { id: r.cycleId, name: r.cycle.name, pendingApproval: 0 })
      }
      if (r.status === 'PendingManagerApproval') {
        cycleMap.get(r.cycleId)!.pendingApproval++
      }
    }
  }

  return (
    <div>
      <PageHeader
        title={t('teamTitle')}
        description={isManager ? t('teamDesc') : t('teamDescSupervisor')}
      />

      {isManager && cycleMap.size > 0 && (
        <div className="mb-5 space-y-2">
          {Array.from(cycleMap.values()).map((cycle) => (
            <div key={cycle.id} className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-indigo-800">{cycle.name}</p>
                {cycle.pendingApproval > 0 && (
                  <p className="text-xs text-indigo-600">{t('teamPendingCalibration', { count: cycle.pendingApproval })}</p>
                )}
              </div>
              <Link
                href={`/reviews/calibrate/${cycle.id}`}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                {t('calibrateBtn')}
              </Link>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isManager && pendingCount > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-sm font-medium text-amber-700">
            {t('teamPendingBanner', { count: pendingCount })}
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted">{tCommon('loading')}</p>
      ) : error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : reviews.length === 0 ? (
        <EmptyState title={t('teamEmpty.title')} description={t('teamEmpty.desc')} />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <TeamReviewCard key={review.id} review={review} isManager={isManager} isSupervisor={isSupervisor} />
          ))}
        </div>
      )}
    </div>
  )
}

function TeamReviewCard({
  review,
  isManager,
  isSupervisor,
}: {
  review: PerformanceReviewDetail
  isManager: boolean
  isSupervisor: boolean
}) {
  // Supervisors should not know an appeal was filed — show Appealed as Published
  const displayStatus = isSupervisor && review.status === 'Appealed' ? 'Published' : review.status

  // 依角色決定「是否需要我動作」與顯示文字
  let actionLabel: string | null = null
  let needsAction = false

  if (isManager) {
    if (displayStatus === 'PendingSupervisorReview') {
      // 這是主管的工作，對 Manager 只是資訊提示
      actionLabel = `待主管初評（${review.supervisor?.name ?? '主管'}）`
      needsAction = false
    } else if (displayStatus === 'PendingManagerApproval') {
      actionLabel = '→ 待你校準確認'
      needsAction = true
    }
  } else {
    // Supervisor
    if (displayStatus === 'PendingSupervisorReview') {
      actionLabel = '→ 待你初評'
      needsAction = true
    }
  }

  return (
    <Link
      href={`/reviews/${review.id}`}
      className={`block rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
        needsAction ? 'border-amber-200 hover:border-amber-300' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-gray-900">{review.employee.name}</p>
            <span className="text-xs text-gray-400">{review.employee.employeeId}</span>
          </div>
          <p className="text-sm text-gray-500">
            {review.employee.jobTitle} · {review.employee.jobLevel}
            <span className="mx-1.5 text-gray-300">·</span>
            {review.cycle.name}
          </p>
          {actionLabel && (
            <p className={`mt-1.5 text-xs font-medium ${needsAction ? 'text-amber-600' : 'text-gray-400'}`}>
              {actionLabel}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={displayStatus as ReviewStatus} />
          {review.grade && (
            <span className={`text-xl font-bold ${GRADE_TEXT_COLOR[review.grade]}`}>
              {GRADE_DISPLAY[review.grade]}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
