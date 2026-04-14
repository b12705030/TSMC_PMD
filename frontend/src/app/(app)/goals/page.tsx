'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { useGoals } from '@/modules/goals/hooks/useGoals'

export default function GoalsPage() {
  const { goals, isLoading } = useGoals()

  return (
    <div>
      <PageHeader
        title="My Goals"
        description="Set and track your SMART goals for this performance cycle."
        actions={
          <Link href="/goals/new" className="btn-primary">
            + New Goal
          </Link>
        }
      />

      {isLoading ? (
        <p className="text-muted">Loading...</p>
      ) : goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Start by setting your SMART goals for this cycle."
          action={
            <Link href="/goals/new" className="btn-primary">
              Set First Goal
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <Link
              key={goal.id}
              href={`/goals/${goal.id}`}
              className="card-link"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{goal.title}</p>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{goal.description}</p>
                </div>
                <StatusBadge status={goal.status} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                <span>Due: {new Date(goal.dueDate).toLocaleDateString()}</span>
                <span>{goal.type}</span>
                <span>{goal.progressUpdates.length} updates</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
