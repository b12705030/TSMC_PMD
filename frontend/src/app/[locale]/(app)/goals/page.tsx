'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useGoals } from '@/modules/goals/hooks/useGoals'
import type { Goal, GoalStatus } from '@/types'

export default function GoalsPage() {
  const t = useTranslations('goals')

  const { goals, isLoading, error, refetch } = useGoals()

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
          {goals.map((goal) => <GoalCard key={goal.id} goal={goal} STATUS_CONFIG={STATUS_CONFIG} />)}
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal, STATUS_CONFIG }: { goal: Goal; STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; pct: number }> }) {
  const t = useTranslations('goals')
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
          : goal.status === 'Rejected'        ? 'bg-red-100 text-red-700'
          : 'bg-gray-100 text-gray-500'}`}
        >
          {config.label}
        </span>
      </div>

      <div className="mb-3">
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div
            className={`h-1.5 rounded-full transition-all ${config.color}`}
            style={{ width: `${config.pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
          {goal.status === 'Completed'
            ? t('deadline.completed')
            : isOverdue
            ? t('deadline.overdue', { days: Math.abs(daysLeft) })
            : daysLeft <= 7
            ? t('deadline.remaining', { days: daysLeft })
            : t('deadline.due', { date: dueDate.toLocaleDateString() })
          }
        </span>
        <span>{goal.type === 'Personal' ? t('type.Personal') : t('type.Team')}</span>
        {goal.progressUpdates.length > 0 && (
          <span>{t('progressCount', { count: goal.progressUpdates.length })}</span>
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
