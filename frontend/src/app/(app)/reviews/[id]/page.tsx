'use client'

import { use } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useReview } from '@/modules/reviews/hooks/useReviews'
import { useAuth } from '@/modules/auth/hooks/useAuth'

export default function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { review, isLoading } = useReview(id)
  const { user } = useAuth()

  if (isLoading) return <p className="text-muted">Loading...</p>
  if (!review || !user) return <p className="text-error">Review not found.</p>

  const isEmployee = user.role === 'Employee'
  const isSupervisor = user.role === 'Supervisor'

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Performance Review"
        breadcrumbs={[{ label: 'Reviews', href: '/reviews' }, { label: 'Detail' }]}
        actions={<StatusBadge status={review.status} />}
      />

      {/* Grade (if published) */}
      {review.status === 'Published' && review.grade && (
        <div className="alert-success mb-6">
          <p className="text-sm font-medium">
            Final Grade: <span className="text-2xl font-bold">{review.grade}</span>
          </p>
          {review.supervisorComment && (
            <p className="mt-2 text-sm">{review.supervisorComment}</p>
          )}
        </div>
      )}

      {/* Employee section */}
      {isEmployee && review.status === 'PendingEmployeeSubmit' && (
        <div className="card">
          <h2 className="section-heading mb-4">Your Self-Assessment</h2>
          <p className="text-sm text-gray-500">
            Complete your self-assessment form. (Form questions load from template.)
          </p>
          {/* TODO: render TemplateQuestion fields dynamically */}
          <button className="btn-primary mt-4">Submit Self-Assessment</button>
        </div>
      )}

      {/* Supervisor section */}
      {isSupervisor && review.status === 'PendingSupervisorReview' && (
        <div className="card">
          <h2 className="section-heading mb-4">Supervisor Evaluation</h2>
          <p className="text-sm text-gray-500">
            Review the employee's self-assessment and complete your evaluation.
          </p>
          {/* TODO: render supervisor form fields */}
          <div className="mt-4">
            <label className="label">Comment</label>
            <textarea rows={4} placeholder="Describe your evaluation reasoning..." className="input" />
          </div>
          <button className="btn-primary mt-4">Submit Evaluation</button>
        </div>
      )}

      {/* Appeal option (employee, after published) */}
      {isEmployee && review.status === 'Published' && (
        <div className="alert-warning mt-4">
          <p className="text-sm font-medium">Not satisfied with the result?</p>
          <button className="mt-2 rounded-md border border-yellow-400 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-100">
            Submit Appeal
          </button>
        </div>
      )}
    </div>
  )
}
