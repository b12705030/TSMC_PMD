'use client'

import { use } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { useCycleReviews } from '@/modules/reviews/hooks/useReviews'
import type { PerformanceReviewDetail, ReviewGrade, ReviewStatus } from '@/types'

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

export default function CompareReviewsPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = use(params)
  const t = useTranslations('reviews')
  const tCommon = useTranslations('common')
  const { reviews, isLoading } = useCycleReviews(cycleId)

  const STATUS_LABEL: Record<ReviewStatus, string> = {
    PendingEmployeeSubmit:   t('compareStatus.PendingEmployeeSubmit'),
    PendingSupervisorReview: t('compareStatus.PendingSupervisorReview'),
    PendingManagerApproval:  t('compareStatus.PendingManagerApproval'),
    Published:               t('compareStatus.Published'),
    Appealed:                t('compareStatus.Appealed'),
  }

  const cycleName = reviews[0]?.cycle?.name ?? cycleId

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
        title={t('compare.title', { cycleName })}
        description={t('compare.desc')}
        breadcrumbs={[
          { label: t('compare.breadcrumb'), href: '/reviews/team' },
          { label: t('compare.breadcrumbCalib'), href: `/reviews/calibrate/${cycleId}` },
          { label: t('compare.breadcrumbCompare') },
        ]}
      />

      {isLoading ? (
        <p className="text-muted">{tCommon('loading')}</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          {t('compare.empty')}
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-gray-400">
            {t('compare.summary', { count: reviews.length })}
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {sorted.map((review) => (
              <ReviewCard key={review.id} review={review} statusLabel={STATUS_LABEL} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ReviewCard({
  review,
  statusLabel,
}: {
  review: PerformanceReviewDetail
  statusLabel: Record<ReviewStatus, string>
}) {
  const t = useTranslations('reviews')
  const hasGrade = !!review.grade
  const isPending = review.status === 'PendingManagerApproval'

  return (
    <div className={`flex-shrink-0 w-64 rounded-xl border shadow-sm bg-white flex flex-col ${
      isPending ? 'border-amber-200' : 'border-gray-200'
    }`}>
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
            {statusLabel[review.status] ?? review.status}
          </span>
          {review.rank && (
            <span className="text-xs text-gray-400">{t('compare.rank', { rank: review.rank })}</span>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">{t('compare.supComment')}</p>
        {review.supervisorComment ? (
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">{review.supervisorComment}</p>
        ) : (
          <p className="text-xs text-gray-300 italic">{t('compare.noComment')}</p>
        )}
      </div>

      <div className="px-4 pb-4">
        <Link
          href={`/reviews/${review.id}`}
          className="block text-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          {t('compare.viewBtn')}
        </Link>
      </div>
    </div>
  )
}
