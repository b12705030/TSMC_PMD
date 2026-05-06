'use client'

import { use } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { useCycleReviews } from '@/modules/reviews/hooks/useReviews'
import type { PerformanceReviewDetail, ReviewGrade } from '@/types'

const GRADE_DISPLAY: Record<ReviewGrade, string> = {
  O: 'O', S_Plus: 'S+', S: 'S', S_Minus: 'S-', I: 'I', U: 'U',
}

const GRADE_COLOR: Record<ReviewGrade, string> = {
  O:       'bg-green-100 text-green-800',
  S_Plus:  'bg-indigo-100 text-indigo-800',
  S:       'bg-indigo-100 text-indigo-700',
  S_Minus: 'bg-indigo-50 text-indigo-600',
  I:       'bg-amber-100 text-amber-800',
  U:       'bg-red-100 text-red-800',
}

const STATUS_LABEL: Record<string, string> = {
  PendingEmployeeSubmit:   '待員工填寫',
  PendingSupervisorReview: '待主管初評',
  PendingManagerApproval:  '待校準',
  Published:               '已發布',
  Appealed:                '申訴中',
}

export default function CompareReviewsPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = use(params)
  const { reviews, isLoading } = useCycleReviews(cycleId)

  const cycleName = reviews[0]?.cycle?.name ?? cycleId

  // Sort: grade first (O→U), then by rank, then by name
  const GRADE_ORDER: Record<string, number> = { O: 0, S_Plus: 1, S: 2, S_Minus: 3, I: 4, U: 5 }
  const sorted = [...reviews].sort((a, b) => {
    const ga = a.grade ? (GRADE_ORDER[a.grade] ?? 9) : 9
    const gb = b.grade ? (GRADE_ORDER[b.grade] ?? 9) : 9
    if (ga !== gb) return ga - gb
    if (a.rank && b.rank) return a.rank - b.rank
    return a.employee.name.localeCompare(b.employee.name)
  })

  return (
    <div>
      <PageHeader
        title={`並排比較：${cycleName}`}
        description="檢視所有員工的評核等第與主管評語，輔助校準決策。"
        breadcrumbs={[
          { label: '團隊評核', href: '/reviews/team' },
          { label: '校準', href: `/reviews/calibrate/${cycleId}` },
          { label: '並排比較' },
        ]}
      />

      {isLoading ? (
        <p className="text-muted">載入中...</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          此週期目前沒有評核資料。
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-gray-400">
            共 {reviews.length} 份評核，已依等第排序（O → U）
          </p>

          {/* Horizontal scroll cards */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {sorted.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ReviewCard({ review }: { review: PerformanceReviewDetail }) {
  const hasGrade = !!review.grade
  const isPending = review.status === 'PendingManagerApproval'

  return (
    <div className={`flex-shrink-0 w-64 rounded-xl border shadow-sm bg-white flex flex-col ${
      isPending ? 'border-amber-200' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className={`px-4 pt-4 pb-3 border-b ${isPending ? 'border-amber-100' : 'border-gray-100'}`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{review.employee.name}</p>
            <p className="text-xs text-gray-400 truncate">{review.employee.jobTitle}</p>
            <p className="text-xs text-gray-400">{review.employee.jobLevel}</p>
          </div>
          {hasGrade ? (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${GRADE_COLOR[review.grade!]}`}>
              {GRADE_DISPLAY[review.grade!]}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-400">—</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs rounded-full px-2 py-0.5 ${
            isPending ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {STATUS_LABEL[review.status] ?? review.status}
          </span>
          {review.rank && (
            <span className="text-xs text-gray-400">排名 #{review.rank}</span>
          )}
        </div>
      </div>

      {/* Supervisor comment */}
      <div className="flex-1 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">主管評語</p>
        {review.supervisorComment ? (
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">{review.supervisorComment}</p>
        ) : (
          <p className="text-xs text-gray-300 italic">尚無評語</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <Link
          href={`/reviews/${review.id}`}
          className="block text-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          查看完整評核
        </Link>
      </div>
    </div>
  )
}
