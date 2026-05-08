'use client'

import { useTranslations } from 'next-intl'
import type { CycleStatus, ReviewStatus, GoalStatus, AppealStatus } from '@/types'

type BadgeStatus = CycleStatus | ReviewStatus | GoalStatus | AppealStatus

const STATUS_CLASS: Record<string, string> = {
  GoalSetting:              'bg-blue-100 text-blue-700',
  InProgress:               'bg-yellow-100 text-yellow-700',
  EmployeeReview:           'bg-indigo-100 text-indigo-700',
  SupervisorReview:         'bg-purple-100 text-purple-700',
  Calibration:              'bg-violet-100 text-violet-700',
  Completed:                'bg-green-100 text-green-700',
  Draft:                    'bg-gray-100 text-gray-600',
  PendingApproval:          'bg-yellow-100 text-yellow-700',
  Approved:                 'bg-green-100 text-green-700',
  PendingEmployeeSubmit:    'bg-blue-100 text-blue-700',
  PendingSupervisorReview:  'bg-yellow-100 text-yellow-700',
  PendingManagerApproval:   'bg-purple-100 text-purple-700',
  Published:                'bg-green-100 text-green-700',
  Appealed:                 'bg-red-100 text-red-700',
  Pending:                  'bg-yellow-100 text-yellow-700',
  Resolved:                 'bg-green-100 text-green-700',
}

interface StatusBadgeProps {
  status: BadgeStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const t = useTranslations('status')
  const label = t.has(status) ? t(status) : status
  const className = STATUS_CLASS[status] ?? 'bg-gray-100 text-gray-600'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
