'use client'

import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useReviews } from '@/modules/reviews/hooks/useReviews'
import type { PerformanceReviewDetail, ReviewGrade, ReviewStatus } from '@/types'

const GRADE_DISPLAY: Record<ReviewGrade, string> = {
  O: 'O', S_Plus: 'S+', S: 'S', S_Minus: 'S-', I: 'I', U: 'U',
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  PendingEmployeeSubmit:   '待您填寫自評',
  PendingSupervisorReview: '主管評核中',
  PendingManagerApproval:  '經理審核中',
  Published:               '已發布',
  Appealed:                '申訴中',
}

export default function ReviewsPage() {
  const { reviews, isLoading, error, refetch } = useReviews()

  return (
    <div>
      <PageHeader
        title="我的績效評核"
        description="查看並完成你的績效評核表單。"
      />

      {isLoading ? (
        <p className="text-muted">載入中...</p>
      ) : error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : reviews.length === 0 ? (
        <EmptyState title="目前沒有評核" description="週期開始後系統會自動建立評核表單。" />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ review }: { review: PerformanceReviewDetail }) {
  const isActionRequired = review.status === 'PendingEmployeeSubmit'

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
              {review.cycle.type === 'Annual' ? '年度' : review.cycle.type === 'Quarterly' ? '季度' : '試用期'}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{STATUS_LABEL[review.status]}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={review.status} />
          {review.grade && (
            <span className="text-lg font-bold text-gray-800">等第 {GRADE_DISPLAY[review.grade]}</span>
          )}
        </div>
      </div>

      {isActionRequired && (
        <p className="mt-3 text-xs font-medium text-indigo-600">→ 需要您的操作</p>
      )}
    </Link>
  )
}
