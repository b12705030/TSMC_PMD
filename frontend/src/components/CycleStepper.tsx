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
    { kind: 'regular'     as const, label: t('companyGoal'),        description: t('companyGoalDesc') },
    { kind: 'regular'     as const, label: t('goalSetting'),        description: t('goalSettingDesc') },
    { kind: 'regular'     as const, label: t('inProgress'),         description: t('inProgressDesc') },
    { kind: 'convergence' as const, label: t('reviewStart'),        description: '' },
    { kind: 'regular'     as const, label: t('employeeReview'),     description: t('employeeReviewDesc') },
    { kind: 'regular'     as const, label: t('supervisorReview'),   description: t('supervisorReviewDesc') },
    { kind: 'regular'     as const, label: t('calibration'),        description: t('calibrationDesc') },
    { kind: 'regular'     as const, label: t('completed'),          description: t('completedDesc') },
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

        return (
          <div key={index} className="flex flex-1 items-start">
            <div className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {isConv ? (
                  <div className={[
                    'flex h-7 w-7 shrink-0 rotate-45 items-center justify-center text-xs font-semibold',
                    isDone      ? 'bg-primary-600 text-white'
                    : isCurrent ? 'border-2 border-primary-600 text-primary-600 bg-white'
                    :             'border-2 border-gray-300 text-gray-400 bg-white',
                  ].join(' ')}>
                    <span className="-rotate-45">{isDone ? '✓' : ''}</span>
                  </div>
                ) : (
                  <div className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isDone      ? 'bg-primary-600 text-white' : '',
                    isCurrent   ? 'border-2 border-primary-600 text-primary-600 bg-white' : '',
                    !isDone && !isCurrent ? 'border-2 border-gray-300 text-gray-400 bg-white' : '',
                  ].join(' ')}>
                    {isDone ? '✓' : displayNum}
                  </div>
                )}
                {!isLast && (
                  <div className={['h-0.5 flex-1', isDone ? 'bg-primary-600' : 'bg-gray-200'].join(' ')} />
                )}
              </div>

              <div className="mt-2 pr-2 text-left w-full">
                <p className={[
                  'text-xs font-medium',
                  isCurrent ? 'text-primary-600' : isDone ? 'text-gray-700' : 'text-gray-400',
                ].join(' ')}>
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
