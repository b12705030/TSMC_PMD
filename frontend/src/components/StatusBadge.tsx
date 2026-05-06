import type { CycleStatus, ReviewStatus, GoalStatus, AppealStatus } from '@/types'

type BadgeStatus = CycleStatus | ReviewStatus | GoalStatus | AppealStatus

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Cycle
  GoalSetting:      { label: '目標設定', className: 'bg-blue-100 text-blue-700' },
  InProgress:       { label: '執行中',   className: 'bg-yellow-100 text-yellow-700' },
  EmployeeReview:   { label: '員工自評', className: 'bg-indigo-100 text-indigo-700' },
  SupervisorReview: { label: '主管初評', className: 'bg-purple-100 text-purple-700' },
  Calibration:      { label: '校準發布', className: 'bg-violet-100 text-violet-700' },
  Completed:        { label: '已完成',   className: 'bg-green-100 text-green-700' },

  // Goal
  Draft:           { label: '草稿',   className: 'bg-gray-100 text-gray-600' },
  PendingApproval: { label: '待審核', className: 'bg-yellow-100 text-yellow-700' },
  Approved:        { label: '已核准', className: 'bg-green-100 text-green-700' },

  // Review
  PendingEmployeeSubmit:   { label: '待員工自評', className: 'bg-blue-100 text-blue-700' },
  PendingSupervisorReview: { label: '待主管初評', className: 'bg-yellow-100 text-yellow-700' },
  PendingManagerApproval:  { label: '待校準',   className: 'bg-purple-100 text-purple-700' },
  Published:               { label: '已發布',   className: 'bg-green-100 text-green-700' },
  Appealed:                { label: '申訴中',   className: 'bg-red-100 text-red-700' },

  // Appeal
  Pending:  { label: '待處理', className: 'bg-yellow-100 text-yellow-700' },
  Resolved: { label: '已解決', className: 'bg-green-100 text-green-700' },
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
