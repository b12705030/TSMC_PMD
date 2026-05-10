'use client'

import { use, useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { ErrorBanner } from '@/components/ErrorBanner'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useCycleReviews } from '@/modules/reviews/hooks/useReviews'
import { api } from '@/lib/api'
import type { PerformanceReviewDetail, ReviewGrade } from '@/types'

const GRADES: ReviewGrade[] = ['O', 'S_Plus', 'S', 'S_Minus', 'I', 'U']

const GRADE_DISPLAY: Record<ReviewGrade, string> = {
  O: 'O', S_Plus: 'S+', S: 'S', S_Minus: 'S-', I: 'I', U: 'U',
}

const GRADE_COLOR: Record<ReviewGrade, string> = {
  O:       'bg-green-100 text-green-800 ring-green-300',
  S_Plus:  'bg-indigo-100 text-indigo-800 ring-indigo-300',
  S:       'bg-indigo-100 text-indigo-700 ring-indigo-300',
  S_Minus: 'bg-indigo-50 text-indigo-600 ring-indigo-200',
  I:       'bg-amber-100 text-amber-800 ring-amber-300',
  U:       'bg-red-100 text-red-800 ring-red-300',
}

export default function CalibratePage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = use(params)
  const { reviews: serverReviews, isLoading, error, refetch } = useCycleReviews(cycleId)
  const [reviews, setReviews] = useState<PerformanceReviewDetail[]>([])
  const [publishing, setPublishing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Sync server state to local (only on initial load / refetch)
  useEffect(() => { setReviews(serverReviews) }, [serverReviews])

  const pendingCount = reviews.filter((r) => r.status === 'PendingManagerApproval').length
  const cycleName    = serverReviews[0]?.cycle?.name ?? cycleId

  async function handleGradeChange(review: PerformanceReviewDetail, grade: ReviewGrade) {
    setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, grade } : r))
    try {
      await api.put(`/reviews/${review.id}/calibrate`, { grade })
    } catch {
      setReviews(serverReviews)
    }
  }

  async function handleRankChange(review: PerformanceReviewDetail, rank: number) {
    if (!review.grade) return
    setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, rank } : r))
    try {
      await api.put(`/reviews/${review.id}/calibrate`, { grade: review.grade, rank })
    } catch {
      setReviews(serverReviews)
    }
  }

  async function handlePublishAll() {
    setPublishing(true)
    try {
      await api.post(`/reviews/cycle/${cycleId}/publish`, {})
      refetch()
    } finally {
      setPublishing(false)
      setShowConfirm(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={`校準：${cycleName}`}
        description="設定每位員工的等第與排名，確認後一次發布所有評核結果。"
        breadcrumbs={[{ label: '團隊評核', href: '/reviews/team' }, { label: '校準' }]}
      />

      {/* Summary bar */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600">
            共 <span className="font-semibold text-gray-900">{reviews.length}</span> 份評核・
            待發布 <span className="font-semibold text-amber-600">{pendingCount}</span> 份
          </p>
          <Link
            href={`/reviews/compare/${cycleId}`}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            並排比較 →
          </Link>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={pendingCount === 0 || publishing}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {publishing ? '發布中...' : `發布全部（${pendingCount} 份）`}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {isLoading ? (
        <p className="text-muted">載入中...</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          此週期目前沒有進入校準階段的評核。
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">員工</th>
                <th className="px-5 py-3 text-left font-medium">職稱 / 職等</th>
                <th className="px-4 py-3 text-left font-medium">狀態</th>
                <th className="px-4 py-3 text-left font-medium">等第</th>
                <th className="px-4 py-3 text-left font-medium">排名</th>
                <th className="px-3 py-3 text-left font-medium">詳情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reviews.map((review) => (
                <CalibrateRow
                  key={review.id}
                  review={review}
                  onGradeChange={(g) => handleGradeChange(review, g)}
                  onRankChange={(r) => handleRankChange(review, r)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="確認發布所有評核？"
        description={`即將發布 ${pendingCount} 份等待審核的評核結果，員工將可查看等第。此操作無法撤銷。`}
        confirmLabel="確認發布"
        onConfirm={handlePublishAll}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

function CalibrateRow({
  review, onGradeChange, onRankChange,
}: {
  review: PerformanceReviewDetail
  onGradeChange: (g: ReviewGrade) => void
  onRankChange: (r: number) => void
}) {
  const [rankInput, setRankInput] = useState(review.rank?.toString() ?? '')
  const isPending = review.status === 'PendingManagerApproval'

  // Sync when parent rank changes (e.g. from server)
  useEffect(() => { setRankInput(review.rank?.toString() ?? '') }, [review.rank])

  return (
    <tr className="transition-colors hover:bg-gray-50">
      <td className="px-5 py-3">
        <p className="font-medium text-gray-900">{review.employee.name}</p>
        <p className="text-xs text-gray-400">{review.employee.employeeId}</p>
      </td>
      <td className="px-5 py-3 text-gray-500">
        {review.employee.jobTitle}
        <span className="mx-1 text-gray-300">·</span>
        {review.employee.jobLevel}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={review.status} />
      </td>
      <td className="px-4 py-3">
        {isPending ? (
          <div className="flex flex-wrap gap-1">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => onGradeChange(g)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset transition-all ${
                  review.grade === g
                    ? GRADE_COLOR[g]
                    : 'bg-gray-50 text-gray-400 ring-gray-200 hover:bg-gray-100'
                }`}
              >
                {GRADE_DISPLAY[g]}
              </button>
            ))}
          </div>
        ) : (
          review.grade ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${GRADE_COLOR[review.grade]}`}>
              {GRADE_DISPLAY[review.grade]}
            </span>
          ) : <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isPending ? (
          <input
            type="number"
            min={1}
            value={rankInput}
            disabled={!review.grade}
            onChange={(e) => setRankInput(e.target.value)}
            onBlur={() => {
              const n = parseInt(rankInput)
              if (!isNaN(n) && n > 0) onRankChange(n)
            }}
            placeholder={review.grade ? '—' : '請先選等第'}
            title={review.grade ? '' : '請先選擇等第才能填排名'}
            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed"
          />
        ) : (
          <span className="text-gray-500">{review.rank ?? '—'}</span>
        )}
      </td>
      <td className="px-3 py-3">
        <Link href={`/reviews/${review.id}`} className="btn-link text-xs">
          查看
        </Link>
      </td>
    </tr>
  )
}
