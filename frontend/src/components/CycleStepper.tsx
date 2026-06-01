'use client'

import { useTranslations } from 'next-intl'
import type { CycleStatus } from '@/types'

// 8 visual slots: companyGoal(0) goalSetting(1) inProgress(2) ◆(3) employeeReview(4) supervisorReview(5) calibration(6) completed(7)
const STATUS_VISUAL_INDEX: Record<CycleStatus, number> = {
  GoalSetting:      1,
  InProgress:       2,
  EmployeeReview:   4,
  SupervisorReview: 5,
  Calibration:      6,
  Completed:        7,
}

export function CycleStepper({ status }: { status: CycleStatus }) {
  const t = useTranslations('cycleStepper')

  const STEPS = [
    { id: 'company-goal',      kind: 'regular'     as const, label: t('companyGoal'),        description: t('companyGoalDesc') },
    { id: 'goal-setting',      kind: 'regular'     as const, label: t('goalSetting'),        description: t('goalSettingDesc') },
    { id: 'in-progress',       kind: 'regular'     as const, label: t('inProgress'),         description: t('inProgressDesc') },
    { id: 'convergence',       kind: 'convergence' as const, label: t('reviewStart'),        description: '' },
    { id: 'employee-review',   kind: 'regular'     as const, label: t('employeeReview'),     description: t('employeeReviewDesc') },
    { id: 'supervisor-review', kind: 'regular'     as const, label: t('supervisorReview'),   description: t('supervisorReviewDesc') },
    { id: 'calibration',       kind: 'regular'     as const, label: t('calibration'),        description: t('calibrationDesc') },
    { id: 'completed',         kind: 'regular'     as const, label: t('completed'),          description: t('completedDesc') },
  ]

  const currentVIndex = STATUS_VISUAL_INDEX[status]
  let stepNum = 0

  return (
    <div className="flex items-start gap-0">
      {STEPS.map((step, index) => {
        const isDone    = index < currentVIndex
        const isCurrent = index === currentVIndex
        const isLast    = index === STEPS.length - 1
        const isConv    = step.kind === 'convergence'
        if (!isConv) stepNum++
        const displayNum = stepNum

        let convClass: string
        if (isDone)          convClass = 'bg-primary-600 text-white'
        else if (isCurrent)  convClass = 'border-2 border-primary-600 text-primary-600 bg-white'
        else                 convClass = 'border-2 border-gray-300 text-gray-400 bg-white'

        let labelClass: string
        if (isCurrent)       labelClass = 'text-primary-600'
        else if (isDone)     labelClass = 'text-gray-700'
        else                 labelClass = 'text-gray-400'

        return (
          <div key={step.id} className="flex flex-1 items-start">
            <div className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {isConv ? (
                  <div className={`flex h-7 w-7 shrink-0 rotate-45 items-center justify-center text-xs font-semibold ${convClass}`}>
                    <span className="-rotate-45">{isDone ? '✓' : ''}</span>
                  </div>
                ) : (
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${convClass}`}>
                    {isDone ? '✓' : displayNum}
                  </div>
                )}
                {!isLast && (
                  <div className={`h-0.5 flex-1 ${isDone ? 'bg-primary-600' : 'bg-gray-200'}`} />
                )}
              </div>

              <div className="mt-2 pr-2 text-left w-full">
                <p className={`text-xs font-medium ${labelClass}`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-400 leading-tight">{step.description}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
