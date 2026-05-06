import type { CycleStatus } from '@/types'

interface StepDef {
  kind: 'regular' | 'convergence'
  label: string
  description: string
}

// 8 個視覺格：公司目標(0) 目標設定(1) 執行中(2) ◆(3) 員工自評(4) 主管初評(5) 校準(6) 已完成(7)
const STEPS: StepDef[] = [
  { kind: 'regular',     label: '公司/部門目標公布', description: '提供員工設定目標的方向' },
  { kind: 'regular',     label: '目標設定',          description: '員工設定 SMART 目標' },
  { kind: 'regular',     label: '執行中',            description: '目標追蹤進行中' },
  { kind: 'convergence', label: '績效評核期開始',    description: '' },
  { kind: 'regular',     label: '員工自評',          description: '填寫績效表單' },
  { kind: 'regular',     label: '主管初評',          description: '主管進行評核' },
  { kind: 'regular',     label: '校準發布',          description: '經理調整並發布結果' },
  { kind: 'regular',     label: '已完成',            description: '結果已發布' },
]

// 公司/部門目標公布(0) 是週期建立的前提，GoalSetting 開始時視為已完成
const STATUS_VISUAL_INDEX: Record<CycleStatus, number> = {
  GoalSetting:      1,
  InProgress:       2,
  EmployeeReview:   4,
  SupervisorReview: 5,
  Calibration:      6,
  Completed:        7,
}

export function CycleStepper({ status }: { status: CycleStatus }) {
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
                    isDone    ? 'bg-primary-600 text-white'
                    : isCurrent ? 'border-2 border-primary-600 text-primary-600 bg-white'
                    : 'border-2 border-gray-300 text-gray-400 bg-white',
                  ].join(' ')}>
                    <span className="-rotate-45">{isDone ? '✓' : ''}</span>
                  </div>
                ) : (
                  <div className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isDone    ? 'bg-primary-600 text-white'               : '',
                    isCurrent ? 'border-2 border-primary-600 text-primary-600 bg-white' : '',
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
