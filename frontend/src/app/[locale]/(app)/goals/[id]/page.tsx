'use client'

import { use, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ErrorBanner } from '@/components/ErrorBanner'
import { Loading } from '@/components/Loading'
import { useGoal } from '@/modules/goals/hooks/useGoals'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { GoalMilestone, GoalStatus } from '@/types'

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations('goals')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const { goal, isLoading, error, refetch } = useGoal(id)
  const { user } = useAuth()

  const STATUS_CONFIG: Record<GoalStatus, { label: string; pct: number; color: string }> = {
    Draft:             { label: t('statusLabel.Draft'),           pct: 0,   color: 'bg-gray-300' },
    PendingApproval:   { label: t('statusLabel.PendingApproval'), pct: 30,  color: 'bg-yellow-400' },
    Approved:          { label: t('statusLabel.Approved'),        pct: 65,  color: 'bg-indigo-500' },
    Completed:         { label: t('statusLabel.Completed'),       pct: 100, color: 'bg-green-500' },
    Rejected:          { label: t('statusLabel.Rejected'),        pct: 0,   color: 'bg-red-400' },
  }

  const SMART_LABELS = [
    { key: 'description', label: t('detail.smart.description') },
    { key: 'metric',      label: t('detail.smart.metric') },
    { key: 'targetValue', label: t('detail.smart.targetValue') },
    { key: 'relevance',   label: t('detail.smart.relevance') },
  ]

  const [newTitle, setNewTitle]           = useState('')
  const [adding, setAdding]               = useState(false)
  const [showInput, setShowInput]         = useState(false)
  const [draggedId, setDraggedId]         = useState<string | null>(null)
  const [localMilestones, setLocalMilestones] = useState<GoalMilestone[]>([])
  const [approving, setApproving]         = useState(false)
  const [submitting, setSubmitting]        = useState(false)
  const [showRejectPanel, setShowRejectPanel] = useState(false)
  const [rejectReason, setRejectReason]       = useState('')

  // Auto-open milestone input when redirected from goal creation (?m=1)
  useEffect(() => {
    const url = new URL(globalThis.location.href)
    if (url.searchParams.get('m') === '1') {
      setShowInput(true)
      url.searchParams.delete('m')
      globalThis.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Sync local milestones from server only when server data actually changes
  // (not when draggedId changes — that would overwrite optimistic reorder)
  useEffect(() => {
    if (goal) setLocalMilestones(goal.milestones ?? [])
  }, [goal])

  if (isLoading) return <Loading />
  if (error)    return <ErrorBanner message={error} />
  if (!goal)    return <p className="text-sm text-red-500 p-8">{t('detail.notFound')}</p>

  const config     = STATUS_CONFIG[goal.status]
  const milestones = localMilestones
  const doneCount  = milestones.filter((m) => m.completedAt).length
  const totalCount = milestones.length
  // If milestones exist, derive progress from them; otherwise use status
  const progressPct = totalCount > 0
    ? Math.round((doneCount / totalCount) * 100)
    : config.pct
  const activeColor   = progressPct === 100 ? 'bg-green-500' : 'bg-indigo-500'
  const progressColor = totalCount > 0 ? activeColor : config.color

  const dueDate    = new Date(goal.dueDate)
  const daysLeft   = Math.ceil((dueDate.getTime() - Date.now()) / 86400000)
  const isToday    = daysLeft === 0
  const isOverdue  = dueDate < new Date() && !isToday && goal.status !== 'Completed'
  const canApprove = (user?.role === 'Supervisor' || user?.role === 'Manager') && goal.status === 'PendingApproval'
  const isOwner    = user?.id === goal.userId
  const canSubmit  = isOwner && (goal.status === 'Draft' || goal.status === 'Rejected')

  // 麵包屑：擁有者 → 我的目標；主管/經理看別人 → 團隊目標
  const breadcrumbLabel = isOwner ? t('detail.breadcrumb') : tNav('teamGoals')
  const breadcrumbHref  = isOwner ? '/goals' : '/goals/team'

  let deadlineLabel: string
  if (goal.status === 'Completed') deadlineLabel = t('deadline.completed')
  else if (isToday)   deadlineLabel = '今天截止'
  else if (isOverdue) deadlineLabel = t('deadline.overdue', { days: Math.abs(daysLeft) })
  else                deadlineLabel = t('deadline.due', { date: dueDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) })

  async function handleSubmitForApproval() {
    setSubmitting(true)
    try { await api.patch(`/goals/${id}/submit`, {}); refetch() } finally { setSubmitting(false) }
  }

  async function handleApprove() {
    setApproving(true)
    try { await api.patch(`/goals/${id}/approve`, {}); refetch() } finally { setApproving(false) }
  }

  async function handleReject() {
    setApproving(true)
    try {
      await api.patch(`/goals/${id}/reject`, { reason: rejectReason.trim() || undefined })
      setShowRejectPanel(false)
      setRejectReason('')
      refetch()
    } finally {
      setApproving(false)
    }
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setAdding(true)
    setNewTitle('')
    setShowInput(false)
    const tempId = `temp-${Date.now()}`
    setLocalMilestones((prev) => [
      ...prev,
      { id: tempId, goalId: id, title, completedAt: null, note: null, url: null, orderIndex: prev.length, createdAt: new Date().toISOString() },
    ])
    try {
      const created = await api.post<GoalMilestone>(`/goals/${id}/milestones`, { title })
      setLocalMilestones((prev) => prev.map((m) => (m.id === tempId ? created : m)))
    } catch {
      setLocalMilestones((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setAdding(false)
    }
  }

  async function handleToggleMilestone(milestone: GoalMilestone) {
    const completing = !milestone.completedAt
    setLocalMilestones((prev) =>
      prev.map((m) =>
        m.id === milestone.id
          ? { ...m, completedAt: completing ? new Date().toISOString() : null, note: null }
          : m
      )
    )
    try {
      await api.patch(`/goals/${id}/milestones/${milestone.id}`, {})
    } catch {
      refetch()
    }
  }

  async function handleUpdateNote(milestone: GoalMilestone, note: string | null) {
    setLocalMilestones((prev) =>
      prev.map((m) => (m.id === milestone.id ? { ...m, note } : m))
    )
    try {
      await api.patch(`/goals/${id}/milestones/${milestone.id}/note`, { note })
    } catch {
      refetch()
    }
  }

  async function handleUpdateUrl(milestone: GoalMilestone, url: string | null) {
    setLocalMilestones((prev) =>
      prev.map((m) => (m.id === milestone.id ? { ...m, url } : m))
    )
    try {
      await api.patch(`/goals/${id}/milestones/${milestone.id}/url`, { url })
    } catch {
      refetch()
    }
  }

  async function handleDelete(milestoneId: string) {
    setLocalMilestones((prev) => prev.filter((m) => m.id !== milestoneId))
    try {
      await api.delete(`/goals/${id}/milestones/${milestoneId}`)
    } catch {
      refetch()
    }
  }

  function handleDragOver(targetId: string, e: React.DragEvent) {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return
    setLocalMilestones((prev) => {
      const fromIdx = prev.findIndex((m) => m.id === draggedId)
      const toIdx   = prev.findIndex((m) => m.id === targetId)
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }

  async function handleDrop() {
    const orderedIds = localMilestones.map((m) => m.id)
    setDraggedId(null)
    try {
      await api.put(`/goals/${id}/milestones/reorder`, { ids: orderedIds })
    } catch {
      refetch()  // revert to server state on error
    }
  }

  const STATUS_BADGE_CLASS: Partial<Record<string, string>> = {
    Completed:       'bg-green-100 text-green-700',
    Approved:        'bg-indigo-100 text-indigo-700',
    PendingApproval: 'bg-yellow-100 text-yellow-700',
    Rejected:        'bg-red-100 text-red-700',
  }
  const statusBadgeClass = STATUS_BADGE_CLASS[goal.status] ?? 'bg-gray-100 text-gray-500'

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href={breadcrumbHref} className="hover:text-gray-600">{breadcrumbLabel}</Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-xs">{goal.title}</span>
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold text-gray-900">{goal.title}</h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass}`}
          >
            {config.label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-1">
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mb-4">
          <span>
            {totalCount > 0
              ? t('detail.milestonesProgress', { done: doneCount, total: totalCount })
              : config.label}
          </span>
          <span>{progressPct}%</span>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-5">
          <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{deadlineLabel}</span>
          <span>{goal.type === 'Personal' ? t('type.Personal') : t('type.Team')}</span>
        </div>

        {/* SMART breakdown */}
        <div className="space-y-3 border-t border-gray-100 pt-4">
          {SMART_LABELS.map(({ key, label }) => (
            <div key={key} className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 mt-2" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm text-gray-700">{(goal as unknown as Record<string, unknown>)[key] as string}</p>
              </div>
            </div>
          ))}
        </div>

        <GoalActionsPanel
          goalStatus={goal.status}
          rejectionReason={goal.rejectionReason ?? null}
          canSubmit={canSubmit}
          canApprove={canApprove}
          submitting={submitting}
          approving={approving}
          showRejectPanel={showRejectPanel}
          rejectReason={rejectReason}
          onSubmit={handleSubmitForApproval}
          onApprove={handleApprove}
          onReject={handleReject}
          onSetShowRejectPanel={setShowRejectPanel}
          onSetRejectReason={setRejectReason}
        />
      </div>

      {/* Milestones */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">{t('detail.milestone.heading')}</h2>
          {isOwner && (
            <button
              onClick={() => setShowInput((v) => !v)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {t('detail.milestone.addBtn')}
            </button>
          )}
        </div>

        {/* Add milestone input */}
        {showInput && (
          <form onSubmit={handleAddMilestone} className="mb-4 flex gap-2">
            <input
              autoFocus
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
              placeholder={t('detail.milestone.placeholder')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button type="submit" disabled={adding || !newTitle.trim()} className="btn-primary text-sm disabled:opacity-40">
              {t('detail.milestone.add')}
            </button>
            <button type="button" onClick={() => setShowInput(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">
              {tCommon('cancel')}
            </button>
          </form>
        )}

        {/* Milestone list */}
        {milestones.length === 0 && !showInput ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {t('detail.milestone.empty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {milestones.map((m) => (
              <MilestoneItem
                key={m.id}
                milestone={m}
                isOwner={isOwner}
                isDragging={draggedId === m.id}
                onToggle={() => handleToggleMilestone(m)}
                onComplete={() => handleToggleMilestone(m)}
                onUpdateNote={(note) => handleUpdateNote(m, note)}
                onUpdateUrl={(url) => handleUpdateUrl(m, url)}
                onDelete={() => handleDelete(m.id)}
                onDragStart={() => setDraggedId(m.id)}
                onDragOver={(e) => handleDragOver(m.id, e)}
                onDrop={handleDrop}
                onDragEnd={() => setDraggedId(null)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function GoalActionsPanel({
  goalStatus, rejectionReason, canSubmit, canApprove,
  submitting, approving, showRejectPanel, rejectReason,
  onSubmit, onApprove, onReject, onSetShowRejectPanel, onSetRejectReason,
}: Readonly<{
  goalStatus: string
  rejectionReason: string | null
  canSubmit: boolean
  canApprove: boolean
  submitting: boolean
  approving: boolean
  showRejectPanel: boolean
  rejectReason: string
  onSubmit: () => void
  onApprove: () => void
  onReject: () => void
  onSetShowRejectPanel: (v: boolean) => void
  onSetRejectReason: (v: string) => void
}>) {
  const t = useTranslations('goals')
  return (
    <>
      {goalStatus === 'Rejected' && rejectionReason && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-1">退回原因</p>
          <p className="text-sm text-red-600">{rejectionReason}</p>
        </div>
      )}
      {canSubmit && (
        <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400">{t('detail.submit.draftNote')}</p>
          <button data-testid="goal-submit-approval" onClick={onSubmit} disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
            {submitting ? t('detail.submit.submitting') : t('detail.submit.submitBtn')}
          </button>
        </div>
      )}
      {canApprove && !showRejectPanel && (
        <div className="mt-5 flex gap-3 border-t border-yellow-100 pt-4">
          <p className="flex-1 text-xs text-yellow-700">{t('detail.submit.pendingNote')}</p>
          <button onClick={() => onSetShowRejectPanel(true)} disabled={approving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            {t('detail.submit.rejectBtn')}
          </button>
          <button onClick={onApprove} disabled={approving}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
            {approving ? t('detail.submit.processing') : t('detail.submit.approveBtn')}
          </button>
        </div>
      )}
      {canApprove && showRejectPanel && (
        <div className="mt-5 border-t border-red-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-red-700">確定要退回此目標嗎？</p>
          <textarea value={rejectReason} onChange={(e) => onSetRejectReason(e.target.value)}
            placeholder="請填寫退回原因（選填），員工將看到此訊息" rows={3}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
          />
          <div className="flex items-center gap-2">
            <button onClick={onReject} disabled={approving}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40">
              {approving ? t('detail.submit.processing') : '確定退回'}
            </button>
            <button onClick={() => { onSetShowRejectPanel(false); onSetRejectReason('') }} disabled={approving}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              取消
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function urlDisplay(raw: string) {
  try { return new URL(raw).hostname } catch { return raw }
}

function MilestoneItem({
  milestone, isOwner, isDragging,
  onToggle, onComplete, onUpdateNote, onUpdateUrl,
  onDelete, onDragStart, onDragOver, onDrop, onDragEnd,
}: Readonly<{
  milestone: GoalMilestone
  isOwner: boolean
  isDragging: boolean
  onToggle: () => void
  onComplete: () => void
  onUpdateNote: (note: string | null) => void
  onUpdateUrl: (url: string | null) => void
  onDelete: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}>) {
  const t = useTranslations('goals')

  const [noteInput, setNoteInput]       = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)  // new note after check-off
  const [editingNote, setEditingNote]   = useState(false)    // editing existing note
  const [noteEdit, setNoteEdit]         = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput]         = useState('')
  const done = !!milestone.completedAt

  function handleCheck() {
    if (done) { onToggle(); return }
    onComplete()
    setShowNoteInput(true)
    setNoteInput('')
  }

  function submitNewNote() {
    const n = noteInput.trim()
    setShowNoteInput(false)
    setNoteInput('')
    if (n) onUpdateNote(n)
  }

  function startEditNote() {
    setNoteEdit(milestone.note ?? '')
    setEditingNote(true)
  }

  function submitNoteEdit() {
    const n = noteEdit.trim()
    setEditingNote(false)
    onUpdateNote(n || null)
  }

  function submitUrl() {
    const u = urlInput.trim()
    setShowUrlInput(false)
    setUrlInput('')
    if (u) onUpdateUrl(u.startsWith('http') ? u : `https://${u}`)
  }

  return (
    <li
      draggable={isOwner && !done}
      onDragStart={isOwner ? onDragStart : undefined}
      onDragOver={isOwner ? onDragOver : undefined}
      onDrop={isOwner ? onDrop : undefined}
      onDragEnd={isOwner ? onDragEnd : undefined}
      className={`group relative rounded-xl border pl-6 pr-4 py-3 transition-all
        ${done ? 'border-green-100 bg-green-50' : 'border-gray-100 bg-gray-50'}
        ${isDragging ? 'opacity-40' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Notion-style drag grip — left side, hover only, only for undone items */}
        {isOwner && !done && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
            <svg className="w-3 h-4 text-gray-300" viewBox="0 0 8 14" fill="currentColor">
              <circle cx="2" cy="2"  r="1.2"/><circle cx="6" cy="2"  r="1.2"/>
              <circle cx="2" cy="7"  r="1.2"/><circle cx="6" cy="7"  r="1.2"/>
              <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
            </svg>
          </div>
        )}

        {/* Notion-style square checkbox */}
        <button
          onClick={isOwner ? handleCheck : undefined}
          disabled={!isOwner}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            done ? 'border-gray-800 bg-gray-800' : 'border-gray-300 hover:border-gray-500'
          } ${isOwner ? '' : 'cursor-default'}`}
        >
          {done && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
            {milestone.title}
          </p>

          {/* ── Note section (done state only) ── */}
          {done && isOwner && showNoteInput && (
            <input autoFocus value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { submitNewNote() } else if (e.key === 'Escape') { setShowNoteInput(false); setNoteInput('') } }}
              onBlur={submitNewNote}
              placeholder={t('detail.milestone.notePlaceholder')}
              className="mt-1.5 w-full text-xs text-gray-500 placeholder-gray-300 bg-transparent outline-none border-b border-gray-200 pb-0.5 focus:border-indigo-300"
            />
          )}
          {done && isOwner && !showNoteInput && editingNote && (
            <input autoFocus value={noteEdit} onChange={(e) => setNoteEdit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { submitNoteEdit() } else if (e.key === 'Escape') { setEditingNote(false) } }}
              onBlur={submitNoteEdit}
              className="mt-1.5 w-full text-xs text-gray-600 bg-transparent outline-none border-b border-indigo-300 pb-0.5"
            />
          )}
          {done && !showNoteInput && !editingNote && milestone.note && (
            <div className="mt-1 flex items-center gap-1 group/note">
              {isOwner ? (
                <button
                  type="button"
                  onClick={startEditNote}
                  className="text-xs text-gray-400 flex-1 cursor-text hover:text-gray-600 text-left bg-transparent border-none p-0"
                >
                  {milestone.note}
                </button>
              ) : (
                <p className="text-xs text-gray-400 flex-1">{milestone.note}</p>
              )}
              {isOwner && (
                <button onClick={() => onUpdateNote(null)} className="opacity-0 group-hover/note:opacity-100 text-gray-300 hover:text-red-400 text-xs leading-none transition-opacity">×</button>
              )}
            </div>
          )}
          {done && isOwner && !showNoteInput && !editingNote && !milestone.note && (
            <button onClick={() => { setShowNoteInput(true); setNoteInput('') }}
              className="mt-1 text-xs text-gray-300 hover:text-gray-500 transition-colors">
              {t('detail.milestone.addNote')}
            </button>
          )}

          {/* ── URL section (always) ── */}
          {isOwner && showUrlInput && (
            <input autoFocus value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { submitUrl() } else if (e.key === 'Escape') { setShowUrlInput(false); setUrlInput('') } }}
              onBlur={submitUrl}
              placeholder={t('detail.milestone.urlPlaceholder')}
              className="mt-1.5 w-full text-xs text-gray-500 placeholder-gray-300 bg-transparent outline-none border-b border-gray-200 pb-0.5 focus:border-indigo-300"
            />
          )}
          {!showUrlInput && milestone.url && (
            <div className="mt-1 flex items-center gap-1 group/url">
              <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <a href={milestone.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-600 hover:underline flex-1 truncate">
                {urlDisplay(milestone.url)}
              </a>
              {isOwner && (
                <button onClick={() => onUpdateUrl(null)} className="opacity-0 group-hover/url:opacity-100 text-gray-300 hover:text-red-400 text-xs leading-none transition-opacity">×</button>
              )}
            </div>
          )}
          {isOwner && !showUrlInput && !milestone.url && (
            <button onClick={() => { setShowUrlInput(true); setUrlInput('') }}
              className="mt-1 text-xs text-gray-300 hover:text-gray-500 transition-colors">
              {t('detail.milestone.addUrl')}
            </button>
          )}
        </div>

        {/* Delete (visible on hover, owner only) */}
        {isOwner && !done && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 text-lg leading-none shrink-0"
          >
            ×
          </button>
        )}
      </div>
    </li>
  )
}
