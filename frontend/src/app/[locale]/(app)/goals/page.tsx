'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useGoals } from '@/modules/goals/hooks/useGoals'
import type { Goal, GoalStatus } from '@/types'

export default function GoalsPage() {
  const t = useTranslations('goals')

  const { goals, isLoading, error, refetch, deleteGoal } = useGoals()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  async function handleDeleteConfirm() {
    if (!deletingId) return
    try {
      await deleteGoal(deletingId)
      setDeletingId(null)
    } catch {
      setDeleteError('刪除失敗，請再試一次')
    }
  }

  const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; pct: number }> = {
    Draft:             { label: t('statusLabel.Draft'),           color: 'bg-gray-300',   pct: 0   },
    PendingApproval:   { label: t('statusLabel.PendingApproval'), color: 'bg-yellow-400', pct: 30  },
    Approved:          { label: t('statusLabel.Approved'),        color: 'bg-indigo-500', pct: 65  },
    Completed:         { label: t('statusLabel.Completed'),       color: 'bg-green-500',  pct: 100 },
    Rejected:          { label: t('statusLabel.Rejected'),        color: 'bg-red-400',    pct: 0   },
  }

  const completedCount = goals.filter((g) => g.status === 'Completed').length
  const activeCount    = goals.filter((g) => g.status === 'Approved').length

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDesc')}
        actions={
          <Link href="/goals/new" className="btn-primary" data-testid="goals-add">
            {t('addBtn')}
          </Link>
        }
      />

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={refetch} /></div>}

      {!isLoading && !error && goals.length > 0 && (
        <div className="mb-6 flex gap-4">
          <StatChip icon="total"    value={goals.length}   label={t('stats.total')} />
          <StatChip icon="active"   value={activeCount}    label={t('stats.active')} />
          <StatChip icon="complete" value={completedCount} label={t('stats.completed')} />
        </div>
      )}

      {isLoading ? (
        <Loading />
      ) : error ? null : goals.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.desc')}
          action={
            <Link href="/goals/new" className="btn-primary">
              {t('empty.btn')}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const onDelete = goal.status === 'Draft' ? () => { setDeleteError(''); setDeletingId(goal.id) } : undefined
            return (
              <GoalCard
                key={goal.id}
                goal={goal}
                STATUS_CONFIG={STATUS_CONFIG}
                onDelete={onDelete}
              />
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="刪除目標"
        description="確定要刪除這個草稿目標嗎？此操作無法復原。"
        confirmLabel="刪除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingId(null)}
      >
        {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
      </ConfirmDialog>
    </div>
  )
}

function GoalCard({ goal, STATUS_CONFIG, onDelete }: Readonly<{ goal: Goal; STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; pct: number }>; onDelete?: () => void }>) {
  const t = useTranslations('goals')
  const config      = STATUS_CONFIG[goal.status]
  const dueDate     = new Date(goal.dueDate)
  const mTotal      = goal.milestones.length
  const mDone       = goal.milestones.filter((m) => m.completedAt).length
  const progressPct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : config.pct
  const progressColor = mTotal > 0
    ? (progressPct === 100 ? 'bg-green-500' : 'bg-indigo-500')
    : config.color
  const allMilestonesDone = mTotal > 0 && mDone === mTotal
  const lastCompletedAt   = allMilestonesDone
    ? goal.milestones.reduce((latest, m) => m.completedAt && m.completedAt > (latest ?? '') ? m.completedAt : latest, null as string | null)
    : null
  const daysLeft  = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isToday   = daysLeft === 0
  const isOverdue = dueDate < new Date() && !isToday && goal.status !== 'Completed' && !allMilestonesDone

  let statusBadgeClass: string
  if (goal.status === 'Completed')       statusBadgeClass = 'bg-green-100 text-green-700'
  else if (goal.status === 'Approved')        statusBadgeClass = 'bg-indigo-100 text-indigo-700'
  else if (goal.status === 'PendingApproval') statusBadgeClass = 'bg-yellow-100 text-yellow-700'
  else if (goal.status === 'Rejected')        statusBadgeClass = 'bg-red-100 text-red-700'
  else                                        statusBadgeClass = 'bg-gray-100 text-gray-500'

  let deadlineClass: string
  if (isOverdue)          deadlineClass = 'text-red-500 font-medium'
  else if (allMilestonesDone) deadlineClass = 'text-green-600 font-medium'
  else                    deadlineClass = ''

  let deadlineLabel: string
  if (goal.status === 'Completed') {
    deadlineLabel = t('deadline.completed')
  } else if (allMilestonesDone) {
    deadlineLabel = `里程碑已全部完成 · ${new Date(lastCompletedAt!).toLocaleDateString()}`
  } else if (isOverdue) {
    deadlineLabel = t('deadline.overdue', { days: Math.abs(daysLeft) })
  } else if (isToday) {
    deadlineLabel = '今天截止'
  } else if (daysLeft <= 7) {
    deadlineLabel = t('deadline.remaining', { days: daysLeft })
  } else {
    deadlineLabel = t('deadline.due', { date: dueDate.toLocaleDateString() })
  }

  return (
    <div className="relative">
      <Link href={`/goals/${goal.id}`} className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{goal.title}</h3>
          <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">{goal.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
          {config.label}
        </span>
      </div>

      <div className="mb-3">
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div
            className={`h-1.5 rounded-full transition-all ${progressColor}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className={deadlineClass}>
          {deadlineLabel}
        </span>
        <span>{goal.type === 'Personal' ? t('type.Personal') : t('type.Team')}</span>
        {goal.progressUpdates.length > 0 && (
          <span>{t('progressCount', { count: goal.progressUpdates.length })}</span>
        )}
      </div>
    </Link>
    {onDelete && (
      <button
        onClick={(e) => { e.preventDefault(); onDelete() }}
        className="absolute right-3 top-3 rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
        title="刪除草稿"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    )}
    </div>
  )
}

const STAT_ICONS = {
  total:    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>,
  active:   <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  complete: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>,
}

function StatChip({ icon, value, label }: Readonly<{ icon: keyof typeof STAT_ICONS; value: number; label: string }>) {
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
