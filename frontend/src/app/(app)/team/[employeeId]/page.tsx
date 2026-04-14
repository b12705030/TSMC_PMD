'use client'

import { use } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { useEmployee } from '@/modules/users/hooks/useTeam'

export default function EmployeeDetailPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params)
  const { employee, goals, reviews, isLoading } = useEmployee(employeeId)

  if (isLoading) return <p className="text-muted">Loading...</p>
  if (!employee) return <p className="text-error">Employee not found.</p>

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={employee.name}
        breadcrumbs={[{ label: 'Team', href: '/team' }, { label: employee.name }]}
      />

      {/* Employee info card */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">{employee.name}</p>
            <p className="text-sm text-gray-500">{employee.employeeId} · {employee.email}</p>
          </div>
          <RoleBadge role={employee.role} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="label-caps">Department</p>
            <p className="font-medium text-gray-700">{employee.department}</p>
          </div>
          <div>
            <p className="label-caps">Job Level</p>
            <p className="font-medium text-gray-700">{employee.jobLevel}</p>
          </div>
          <div>
            <p className="label-caps">Job Title</p>
            <p className="font-medium text-gray-700">{employee.jobTitle}</p>
          </div>
        </div>
      </div>

      {/* Goals */}
      <h2 className="section-heading">Goals</h2>
      {goals.length === 0 ? (
        <p className="text-muted mb-6">No goals set yet.</p>
      ) : (
        <div className="mb-6 space-y-2">
          {goals.map((goal) => (
            <div key={goal.id} className="card-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{goal.title}</p>
                <p className="text-xs text-gray-400">Due: {new Date(goal.dueDate).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={goal.status} />
            </div>
          ))}
        </div>
      )}

      {/* Historical reviews */}
      <h2 className="section-heading">Review History</h2>
      {reviews.length === 0 ? (
        <p className="text-muted">No past reviews.</p>
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <div key={review.id} className="card-sm flex items-center justify-between">
              <p className="text-sm text-gray-700">Cycle: {review.cycleId}</p>
              <div className="flex items-center gap-3">
                {review.grade && (
                  <span className="text-sm font-bold text-gray-900">Grade: {review.grade}</span>
                )}
                <StatusBadge status={review.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
