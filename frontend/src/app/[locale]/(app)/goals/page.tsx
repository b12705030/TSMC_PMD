'use client'

import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { useGoals } from '@/modules/goals/hooks/useGoals'
import type { Goal, GoalStatus } from '@/types'

const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; pct: number }> = {
  Draft:             { label: '草稿',   color: 'bg-gray-300',   pct: 0   },
  PendingApproval:   { label: '待審核', color: 'bg-yellow-400', pct: 30  },
  Approved:          { label: '進行中', color: 'bg-indigo-500', pct: 65  },
  Completed:         { label: '已完成', color: 'bg-green-500',  pct: 100 },
}

export default function GoalsPage() {
  const { goals, isLoading } = useGoals()

  const completedCount = goals.filter((g) => g.status === 'Completed').length
  const activeCount    = goals.filter((g) => g.status === 'Approved').length

  return (
    <div>
      <PageHeader
        title="我的目標"
        description="設定並追蹤這個績效週期的 SMART 目標。"
        actions={
          <Link href="/goals/new" className="btn-primary">
            + 新增目標
          </Link>
        }
      />

      {/* Summary bar */}
      {!isLoading && goals.length > 0 && (
        <div className="mb-6 flex gap-4">
          <StatChip icon="total"    value={goals.length}   label="目標總數" />
          <StatChip icon="active"   value={activeCount}    label="進行中" />
          <StatChip icon="complete" value={completedCount} label="已完成" />
        </div>
      )}

      {isLoading ? (
        <p className="text-muted">載入中...</p>
      ) : goals.length === 0 ? (
        <EmptyState
          title="還沒有任何目標"
          description="設定你的第一個 SMART 目標，讓這個績效週期有個好的開始。"
          action={
            <Link href="/goals/new" className="btn-primary">
              設定第一個目標
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal }: { goal: Goal }) {
  const config  = STATUS_CONFIG[goal.status]
  const dueDate = new Date(goal.dueDate)
  const isOverdue = dueDate < new Date() && goal.status !== 'Completed'
  const daysLeft  = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <Link href={`/goals/${goal.id}`} className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{goal.title}</h3>
          <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">{goal.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium
          ${goal.status === 'Completed'       ? 'bg-green-100 text-green-700'
          : goal.status === 'Approved'        ? 'bg-indigo-100 text-indigo-700'
          : goal.status === 'PendingApproval' ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-500'}`}
        >
          {config.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div
            className={`h-1.5 rounded-full transition-all ${config.color}`}
            style={{ width: `${config.pct}%` }}
          />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
          {goal.status === 'Completed'
            ? `已完成`
            : isOverdue
            ? `已逾期 ${Math.abs(daysLeft)} 天`
            : daysLeft <= 7
            ? `還剩 ${daysLeft} 天`
            : `截止 ${dueDate.toLocaleDateString('zh-TW')}`
          }
        </span>
        <span>{goal.type === 'Personal' ? '個人目標' : '團隊目標'}</span>
        {goal.progressUpdates.length > 0 && (
          <span>{goal.progressUpdates.length} 次進度更新</span>
        )}
      </div>
    </Link>
  )
}

const STAT_ICONS = {
  total:    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>,
  active:   <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  complete: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>,
}

function StatChip({ icon, value, label }: { icon: keyof typeof STAT_ICONS; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      {STAT_ICONS[icon]}
      <div>
        <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
