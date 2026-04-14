'use client'

import { useState } from 'react'
import { use } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useGoal } from '@/modules/goals/hooks/useGoals'
import { api } from '@/lib/api'

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { goal, isLoading, refetch } = useGoal(id)
  const [progressText, setProgressText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitProgress(e: React.FormEvent) {
    e.preventDefault()
    if (!progressText.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/goals/${id}/progress`, { content: progressText })
      setProgressText('')
      refetch()
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return <p className="text-muted">Loading...</p>
  if (!goal) return <p className="text-error">Goal not found.</p>

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={goal.title}
        breadcrumbs={[{ label: 'Goals', href: '/goals' }, { label: goal.title }]}
        actions={<StatusBadge status={goal.status} />}
      />

      {/* SMART breakdown */}
      <div className="card mb-6 space-y-3">
        <SmartRow label="Specific" value={goal.description} />
        <SmartRow label="Measurable" value={goal.metric} />
        <SmartRow label="Achievable" value={goal.targetValue} />
        <SmartRow label="Relevant" value={goal.relevance} />
        <SmartRow label="Time-bound" value={new Date(goal.dueDate).toLocaleDateString()} />
        <SmartRow label="Type" value={goal.type} />
      </div>

      {/* Progress updates */}
      <h2 className="section-heading">Progress Updates</h2>

      <form onSubmit={submitProgress} className="mb-4">
        <textarea
          value={progressText}
          onChange={(e) => setProgressText(e.target.value)}
          rows={3}
          placeholder="Describe your latest progress..."
          className="input resize-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !progressText.trim()}
            className="btn-primary"
          >
            {submitting ? 'Submitting...' : 'Submit Update'}
          </button>
        </div>
      </form>

      {goal.progressUpdates.length === 0 ? (
        <p className="text-muted">No updates yet.</p>
      ) : (
        <ul className="space-y-3">
          {[...goal.progressUpdates].reverse().map((update) => (
            <li key={update.id} className="card !p-4">
              <p className="text-sm text-gray-700">{update.content}</p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(update.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SmartRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="label-caps w-28 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  )
}
