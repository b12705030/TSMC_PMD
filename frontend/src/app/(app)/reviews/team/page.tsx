'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { useTeamReviews } from '@/modules/reviews/hooks/useReviews'
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

const STATUS_ACTION: Partial<Record<ReviewStatus, string>> = {
  PendingSupervisorReview: '→ 待您評核',
  PendingManagerApproval:  '待經理審核',
}


export default function TeamReviewsPage() {
  const { reviews, isLoading } = useTeamReviews()

  const pendingCount = reviews.filter((r) => r.status === 'PendingSupervisorReview').length

  return (
    <div>
      <PageHeader
        title="團隊評核"
        description="查看並完成您的下屬績效評核。"
      />

      {!isLoading && pendingCount > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-sm font-medium text-amber-700">
            您有 {pendingCount} 份評核待處理
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted">載入中...</p>
      ) : reviews.length === 0 ? (
        <EmptyState title="目前沒有團隊評核" description="週期開始並員工完成自評後，評核會出現在這裡。" />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <TeamReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  )
}

function TeamReviewCard({ review }: { review: PerformanceReviewDetail }) {
  const actionLabel = STATUS_ACTION[review.status]
  const needsAction = review.status === 'PendingSupervisorReview'

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
          <StatusBadge status={review.status} />
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
