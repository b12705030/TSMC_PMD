'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useReviews } from '@/modules/reviews/hooks/useReviews'
import type { PerformanceReviewDetail, ReviewGrade, ReviewStatus } from '@/types'

const GRADE_DISPLAY: Record<ReviewGrade, string> = {
  O: 'O', S_Plus: 'S+', S: 'S', S_Minus: 'S-', I: 'I', U: 'U',
}

export default function ReviewsPage() {
  const t = useTranslations('reviews')

  const { reviews, isLoading, error, refetch } = useReviews()

  const STATUS_LABEL: Record<ReviewStatus, string> = {
    PendingEmployeeSubmit:   t('statusLabel.PendingEmployeeSubmit'),
    PendingSupervisorReview: t('statusLabel.PendingSupervisorReview'),
    PendingManagerApproval:  t('statusLabel.PendingManagerApproval'),
    Published:               t('statusLabel.Published'),
    Appealed:                t('statusLabel.Appealed'),
  }

  return (
    <div>
      <PageHeader
        title={t('myTitle')}
        description={t('myDesc')}
      />

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : reviews.length === 0 ? (
        <EmptyState title={t('empty.title')} description={t('empty.desc')} />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} statusLabel={STATUS_LABEL} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ review, statusLabel }: { review: PerformanceReviewDetail; statusLabel: Record<ReviewStatus, string> }) {
  const t = useTranslations('reviews')
  const isActionRequired = review.status === 'PendingEmployeeSubmit'

  const cycleTypeLabel = review.cycle.type === 'Annual'
    ? t('cycleType.Annual')
    : review.cycle.type === 'Quarterly'
    ? t('cycleType.Quarterly')
    : t('cycleType.Probation')

  return (
    <Link
      href={`/reviews/${review.id}`}
      className={`block rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
        isActionRequired ? 'border-indigo-200 hover:border-indigo-300' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{review.cycle.name}</p>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {cycleTypeLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{statusLabel[review.status]}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={review.status} />
          {review.grade && (
            <span className="text-lg font-bold text-gray-800">{t('grade', { grade: GRADE_DISPLAY[review.grade] })}</span>
          )}
        </div>
      </div>

      {isActionRequired && (
        <p className="mt-3 text-xs font-medium text-indigo-600">{t('actionRequired')}</p>
      )}
    </Link>
  )
}
