'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Loading } from '@/components/Loading'
import { ErrorBanner } from '@/components/ErrorBanner'
import { EmptyState } from '@/components/EmptyState'
import { api } from '@/lib/api'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import type { GoalStatus } from '@/types'

interface TeamGoal {
  id: string
  title: string
  description: string | null
  status: GoalStatus
  dueDate: string | null
  user: { id: string; name: string; employeeId: string; jobTitle: string; jobLevel: string }
  cycle: { id: string; name: string } | null
  milestones: { id: string; title: string; completed: boolean }[]
}


export default function TeamGoalsPage() {
  const { user } = useAuth()
  const [goals, setGoals]       = useState<TeamGoal[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filterStatus, setFilterStatus]   = useState<GoalStatus | 'all'>('all')
  // 退回確認狀態：null = 未展開；string = 正在輸入原因的 goalId
  const [rejectingId, setRejectingId]       = useState<string | null>(null)
  const [rejectReason, setRejectReason]     = useState('')

  async function fetchGoals() {
    setLoading(true)
    api.get<TeamGoal[]>('/goals/team')
      .then((data) => { setGoals(data); setError(null) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchGoals() }, [])

  async function handleApprove(id: string) {
    setActionLoading(id)
    try {
      await api.patch(`/goals/${id}/approve`, {})
      await fetchGoals()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setActionLoading(null)
    }
  }

  function openReject(id: string) {
    setRejectingId(id)
    setRejectReason('')
  }

  function cancelReject() {
    setRejectingId(null)
    setRejectReason('')
  }

  async function confirmReject(id: string) {
    setActionLoading(id)
    try {
      await api.patch(`/goals/${id}/reject`, { reason: rejectReason.trim() || undefined })
      setRejectingId(null)
      setRejectReason('')
      await fetchGoals()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setActionLoading(null)
    }
  }

  if (!user) return null

  const pendingCount = goals.filter((g) => g.status === 'PendingApproval').length

  // 依 filterStatus 篩選
  const filtered = filterStatus === 'all' ? goals : goals.filter((g) => g.status === filterStatus)

  // 以員工分群
  const byEmployee = new Map<string, { user: TeamGoal['user']; goals: TeamGoal[] }>()
  for (const g of filtered) {
    if (!byEmployee.has(g.user.id)) {
      byEmployee.set(g.user.id, { user: g.user, goals: [] })
    }
    byEmployee.get(g.user.id)!.goals.push(g)
  }

  const statusTabs: { key: GoalStatus | 'all'; label: string }[] = [
    { key: 'all',             label: `全部（${goals.length}）` },
    { key: 'PendingApproval', label: `待審核（${goals.filter(g => g.status === 'PendingApproval').length}）` },
    { key: 'Approved',        label: `進行中（${goals.filter(g => g.status === 'Approved').length}）` },
    { key: 'Completed',       label: `已完成（${goals.filter(g => g.status === 'Completed').length}）` },
    { key: 'Rejected',        label: `已退回（${goals.filter(g => g.status === 'Rejected').length}）` },
  ]

  let teamGoalsContent: React.ReactNode
  if (isLoading) {
    teamGoalsContent = <Loading />
  } else if (byEmployee.size === 0) {
    teamGoalsContent = <EmptyState title="目前沒有目標" description="你的下屬尚未設定任何目標。" />
  } else {
    teamGoalsContent = (
      <div className="space-y-6">
        {Array.from(byEmployee.values()).map(({ user: emp, goals: empGoals }) => (
          <div key={emp.id}>
            {/* 員工標頭 */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {emp.name.slice(0, 1)}
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900">{emp.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{emp.employeeId} · {emp.jobTitle} · {emp.jobLevel}</span>
                </div>
              </div>
              <Link
                href={`/team/${emp.id}`}
                className="text-xs text-indigo-600 hover:underline"
              >
                員工檔案
              </Link>
            </div>

            {/* 此員工的目標清單 */}
            <div className="space-y-2 pl-9">
              {empGoals.map((goal) => {
                const milestoneTotal    = goal.milestones.length
                const milestoneDone     = goal.milestones.filter((m) => m.completed).length
                const isPendingApproval = goal.status === 'PendingApproval'
                const isActioning       = actionLoading === goal.id

                return (
                  <div
                    key={goal.id}
                    className={`rounded-xl border bg-white shadow-sm transition-all ${
                      isPendingApproval
                        ? 'border-amber-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* 可點擊的卡片主體 → 進入目標詳細頁（?from=team 讓 sidebar 高亮「團隊目標」） */}
                    <Link href={`/goals/${goal.id}?from=team`} className="block p-4 hover:bg-gray-50 rounded-t-xl transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{goal.title}</p>
                          {goal.description && (
                            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{goal.description}</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            {goal.cycle && <span>📋 {goal.cycle.name}</span>}
                            {goal.dueDate && (
                              <span>截止 {new Date(goal.dueDate).toLocaleDateString('zh-TW')}</span>
                            )}
                            {milestoneTotal > 0 && (
                              <span>里程碑 {milestoneDone}/{milestoneTotal}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <StatusBadge status={goal.status} />
                          {/* 進度條（只有里程碑時顯示） */}
                          {milestoneTotal > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-1.5 rounded-full bg-indigo-400"
                                  style={{ width: `${(milestoneDone / milestoneTotal) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400">
                                {Math.round((milestoneDone / milestoneTotal) * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* 審核按鈕（獨立區域，不觸發卡片導航） */}
                    {isPendingApproval && rejectingId !== goal.id && (
                      <div className="flex items-center gap-2 border-t border-amber-100 px-4 py-3">
                        <button
                          onClick={() => handleApprove(goal.id)}
                          disabled={isActioning}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {isActioning ? '處理中...' : '核准'}
                        </button>
                        <button
                          onClick={() => openReject(goal.id)}
                          disabled={isActioning}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          退回
                        </button>
                        <span className="text-xs text-amber-600 font-medium">待你審核</span>
                      </div>
                    )}

                    {/* 退回確認展開區 */}
                    {isPendingApproval && rejectingId === goal.id && (
                      <div className="border-t border-red-100 bg-red-50 px-4 py-3 rounded-b-xl space-y-2">
                        <p className="text-xs font-medium text-red-700">確定要退回此目標嗎？</p>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="請填寫退回原因（選填），員工將看到此訊息"
                          rows={2}
                          className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => confirmReject(goal.id)}
                            disabled={isActioning}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {isActioning ? '處理中...' : '確定退回'}
                          </button>
                          <button
                            onClick={cancelReject}
                            disabled={isActioning}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="團隊目標"
        description="查看下屬員工設定的目標，審核待確認的目標。"
      />

      {/* 待審核提示 */}
      {!isLoading && pendingCount > 0 && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-700">
            有 {pendingCount} 個目標等待你審核
          </p>
          <button
            className="text-xs font-medium text-amber-600 underline"
            onClick={() => setFilterStatus('PendingApproval')}
          >
            只顯示待審核
          </button>
        </div>
      )}

      {/* 狀態 Tab 篩選 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchGoals} />}

      {teamGoalsContent}
    </div>
  )
}
