import type { CycleStatus, ReviewStatus, GoalStatus, AppealStatus } from '@/types'

type BadgeStatus = CycleStatus | ReviewStatus | GoalStatus | AppealStatus

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Cycle
  GoalSetting: { label: 'Goal Setting', className: 'bg-blue-100 text-blue-700' },
  InProgress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
  UnderReview: { label: 'Under Review', className: 'bg-purple-100 text-purple-700' },
  Completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },

  // Goal
  Draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  PendingApproval: { label: 'Pending Approval', className: 'bg-yellow-100 text-yellow-700' },
  Approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },

  // Review
  PendingEmployeeSubmit: { label: 'Awaiting Your Input', className: 'bg-blue-100 text-blue-700' },
  PendingSupervisorReview: { label: 'Awaiting Review', className: 'bg-yellow-100 text-yellow-700' },
  PendingManagerApproval: { label: 'Awaiting Approval', className: 'bg-purple-100 text-purple-700' },
  Published: { label: 'Published', className: 'bg-green-100 text-green-700' },
  Appealed: { label: 'Appealed', className: 'bg-red-100 text-red-700' },

  // Appeal
  Pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  Resolved: { label: 'Resolved', className: 'bg-green-100 text-green-700' },
}

interface StatusBadgeProps {
  status: BadgeStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
