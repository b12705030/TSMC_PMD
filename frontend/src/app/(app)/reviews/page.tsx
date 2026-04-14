'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { useReviews } from '@/modules/reviews/hooks/useReviews'

export default function ReviewsPage() {
  const { reviews, isLoading } = useReviews()

  return (
    <div>
      <PageHeader
        title="Performance Reviews"
        description="View and complete your performance evaluations."
      />

      {isLoading ? (
        <p className="text-muted">Loading...</p>
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="Reviews will appear here when a cycle starts." />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/reviews/${review.id}`}
              className="card-link"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Review #{review.id.slice(0, 8)}</p>
                  <p className="mt-0.5 text-sm text-gray-500">Cycle ID: {review.cycleId}</p>
                </div>
                <StatusBadge status={review.status} />
              </div>
              {review.grade && (
                <div className="mt-3">
                  <span className="text-sm font-semibold text-gray-700">Grade: {review.grade}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
