import type { CycleStatus } from '@/types'

const STEPS: { status: CycleStatus; label: string; description: string }[] = [
  { status: 'GoalSetting', label: '目標設定', description: '員工設定 SMART 目標' },
  { status: 'InProgress',  label: '執行中',   description: '目標追蹤進行中' },
  { status: 'UnderReview', label: '評核中',   description: '主管進行初評' },
  { status: 'Completed',   label: '已完成',   description: '結果已發布' },
]

const STATUS_INDEX: Record<CycleStatus, number> = {
  GoalSetting: 0,
  InProgress:  1,
  UnderReview: 2,
  Completed:   3,
}

interface CycleStepperProps {
  status: CycleStatus
}

export function CycleStepper({ status }: CycleStepperProps) {
  const currentIndex = STATUS_INDEX[status]

  return (
    <div className="flex items-start gap-0">
      {STEPS.map((step, index) => {
        const isDone    = index < currentIndex
        const isCurrent = index === currentIndex
        const isLast    = index === STEPS.length - 1

        return (
          <div key={step.status} className="flex flex-1 items-start">
            <div className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isDone    ? 'bg-primary-600 text-white'               : '',
                    isCurrent ? 'border-2 border-primary-600 text-primary-600 bg-white' : '',
                    !isDone && !isCurrent ? 'border-2 border-gray-300 text-gray-400 bg-white' : '',
                  ].join(' ')}
                >
                  {isDone ? '✓' : index + 1}
                </div>
                {!isLast && (
                  <div className={['h-0.5 flex-1', isDone ? 'bg-primary-600' : 'bg-gray-200'].join(' ')} />
                )}
              </div>

              <div className="mt-2 pr-2 text-left w-full">
                <p className={['text-xs font-medium', isCurrent ? 'text-primary-600' : isDone ? 'text-gray-700' : 'text-gray-400'].join(' ')}>
                  {step.label}
                </p>
                <p className="text-xs text-gray-400 leading-tight">{step.description}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
