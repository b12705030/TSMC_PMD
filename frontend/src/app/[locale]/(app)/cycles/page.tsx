'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { PageHeader } from '@/components/PageHeader'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CycleStepper } from '@/components/CycleStepper'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useCycles, type CreateCyclePayload, type UpdateCyclePayload } from '@/modules/cycles/hooks/useCycles'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { PerformanceCycle, ReviewTemplate } from '@/types'

const CYCLE_TYPES = ['Annual', 'Quarterly', 'Probation'] as const

function fmt(date: string, locale: string) {
  return new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Shared icon helpers ──────────────────────────────────────────────────────

function WarnIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  )
}

function WarnText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
      <WarnIcon />
      {children}
    </p>
  )
}

// ─── Region Select ────────────────────────────────────────────────────────────

function RegionSelect({
  allRegions,
  value,
  onChange,
}: {
  allRegions: { id: string; name: string; code: string }[]
  value: string
  onChange: (regionId: string) => void
}) {
  const tCommon = useTranslations('common')
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— 選擇地區 —</option>
      {allRegions.map((r) => (
        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
      ))}
      {allRegions.length === 0 && <option disabled>{tCommon('loading')}</option>}
    </select>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CyclesPage() {
  const t       = useTranslations('cycles')
  const tCommon = useTranslations('common')
  const locale  = useLocale()
  const { cycles, isLoading, error: loadError, createCycle, updateCycle, advanceStatus, refetch } = useCycles()
  const { user } = useAuth()
  const isAdmin   = user?.role === 'Admin'
  const isHR      = user?.role === 'RegionalHR' || user?.role === 'GlobalHR'
  const isManager = user?.role === 'Manager'
  const canEdit   = isAdmin || isHR

  const [allRegions, setAllRegions]   = useState<{ id: string; name: string; code: string }[]>([])
  const [showModal, setShowModal]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [pendingAdvance, setPendingAdvance] = useState<PerformanceCycle | null>(null)
  const [editingCycle, setEditingCycle]     = useState<PerformanceCycle | null>(null)
  const [managerQStatus, setManagerQStatus] = useState<{ complete: {id:string;name:string}[]; pending: {id:string;name:string}[] } | null>(null)
  const [templates, setTemplates] = useState<ReviewTemplate[]>([])
  const showTemplateTrack = canEdit || isManager

  // 確認自動推進 / 延期
  const [confirmingCycle, setConfirmingCycle]   = useState<PerformanceCycle | null>(null)
  const [postponingCycle, setPostponingCycle]   = useState<PerformanceCycle | null>(null)
  const [newReviewStart, setNewReviewStart]     = useState('')
  const [actionLoading, setActionLoading]       = useState(false)
  const [actionError, setActionError]           = useState('')

  async function handleConfirmAdvance() {
    if (!confirmingCycle) return
    setActionLoading(true); setActionError('')
    try {
      await api.patch(`/cycles/${confirmingCycle.id}/confirm-advance`, {})
      setConfirmingCycle(null)
      refetch()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePostpone(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!postponingCycle || !newReviewStart) return
    setActionLoading(true); setActionError('')
    try {
      await api.patch(`/cycles/${postponingCycle.id}/postpone`, { newReviewStart })
      setPostponingCycle(null); setNewReviewStart('')
      refetch()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setActionLoading(false)
    }
  }

  const [form, setForm] = useState<CreateCyclePayload>({
    name:             '',
    type:             'Annual',
    regionId:         '',
    goalSettingStart: '',
    goalSettingEnd:   '',
    reviewStart:      '',
    reviewEnd:        '',
  })

  function getDateWarning(cycle: PerformanceCycle): string | null {
    const today = new Date(); today.setHours(0, 0, 0, 0)

    if (cycle.status === 'GoalSetting') {
      const goalEnd = new Date(cycle.goalSettingEnd)
      if (today < goalEnd) {
        const days = Math.ceil((goalEnd.getTime() - today.getTime()) / 86400000)
        return t('dateWarning.goalEndEarly', { date: fmt(cycle.goalSettingEnd, locale), days })
      }
    }
    if (cycle.status === 'InProgress') {
      const reviewStart = new Date(cycle.reviewStart)
      if (today < reviewStart) {
        const days = Math.ceil((reviewStart.getTime() - today.getTime()) / 86400000)
        return t('dateWarning.reviewStartEarly', { date: fmt(cycle.reviewStart, locale), days })
      }
      if (today > reviewStart) {
        const days = Math.ceil((today.getTime() - reviewStart.getTime()) / 86400000)
        return t('dateWarning.reviewStartLate', { date: fmt(cycle.reviewStart, locale), days })
      }
    }
    if (cycle.status === 'Calibration') {
      const reviewEnd = new Date(cycle.reviewEnd)
      if (today < reviewEnd) {
        const days = Math.ceil((reviewEnd.getTime() - today.getTime()) / 86400000)
        return t('dateWarning.reviewEndEarly', { date: fmt(cycle.reviewEnd, locale), days })
      }
    }
    return null
  }

  const nextStatusLabel: Record<string, string> = {
    GoalSetting:      t('advance.GoalSetting'),
    InProgress:       t('advance.InProgress'),
    EmployeeReview:   t('advance.EmployeeReview'),
    SupervisorReview: t('advance.SupervisorReview'),
    Calibration:      t('advance.Calibration'),
  }

  useEffect(() => {
    if (isAdmin) {
      api.get<{ id: string; name: string; code: string }[]>('/users/regions').then(setAllRegions).catch(() => {})
    }
  }, [isAdmin])

  useEffect(() => {
    if (showTemplateTrack) {
      api.get<ReviewTemplate[]>('/templates').then(setTemplates).catch(() => {})
    }
  }, [showTemplateTrack])

  function updateForm<K extends keyof CreateCyclePayload>(field: K, value: CreateCyclePayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setForm({ name: '', type: 'Annual', regionId: '', goalSettingStart: '', goalSettingEnd: '', reviewStart: '', reviewEnd: '' })
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (isAdmin && !form.regionId) { setError(t('modal.errorRegion')); return }
    setError('')
    setSubmitting(true)
    try {
      await createCycle(form)
      setShowModal(false)
      resetForm()
    } catch {
      setError('Failed to create cycle. Please check the dates and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAdvanceClick(cycle: PerformanceCycle) {
    setManagerQStatus(null)
    setPendingAdvance(cycle)
    if (cycle.status === 'InProgress') {
      try {
        const status = await api.get<{ complete: {id:string;name:string}[]; pending: {id:string;name:string}[] }>(
          `/cycles/${cycle.id}/manager-questionnaire-status`
        )
        setManagerQStatus(status)
      } catch {
        // non-critical, proceed without status
      }
    }
  }

  async function handleAdvanceConfirmed() {
    if (!pendingAdvance) return
    try { await advanceStatus(pendingAdvance.id) }
    finally { setPendingAdvance(null); setManagerQStatus(null) }
  }

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDesc')}
        actions={canEdit ? (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            {t('addCycle')}
          </button>
        ) : undefined}
      />

      {isLoading ? (
        <Loading />
      ) : loadError ? (
        <ErrorBanner message={loadError} />
      ) : cycles.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={canEdit ? t('emptyDescAdmin') : t('emptyDescUser')}
          action={canEdit ? <button className="btn-primary" onClick={() => setShowModal(true)}>{t('addCycle')}</button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {cycles.map((cycle) => (
            <CycleCard
              key={cycle.id}
              cycle={cycle}
              canEdit={canEdit}
              isAdmin={isAdmin}
              cycleTemplates={showTemplateTrack ? templates.filter((tt) => tt.cycleId === cycle.id) : null}
              nextStatusLabel={nextStatusLabel}
              onAdvance={canEdit ? () => handleAdvanceClick(cycle) : undefined}
              onEdit={isAdmin ? () => setEditingCycle(cycle) : undefined}
              onConfirmAdvance={canEdit ? () => setConfirmingCycle(cycle) : undefined}
              onPostpone={canEdit ? () => { setPostponingCycle(cycle); setNewReviewStart(cycle.reviewStart.slice(0, 10)) } : undefined}
            />
          ))}
        </div>
      )}

      {/* Advance confirmation */}
      <ConfirmDialog
        open={!!pendingAdvance}
        title={t('confirmAdvanceTitle')}
        description={t('confirmAdvanceDesc', {
          name:      pendingAdvance?.name ?? '',
          nextLabel: nextStatusLabel[pendingAdvance?.status ?? ''] ?? '',
        })}
        confirmLabel={t('confirmAdvanceLabel')}
        onConfirm={handleAdvanceConfirmed}
        onCancel={() => { setPendingAdvance(null); setManagerQStatus(null) }}
      >
        {pendingAdvance && getDateWarning(pendingAdvance) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-amber-700">
              <WarnIcon />
              {getDateWarning(pendingAdvance)}
            </p>
          </div>
        )}
        {managerQStatus && managerQStatus.pending.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <WarnIcon />
              {t('pendingManagersWarning', { count: managerQStatus.pending.length })}
            </p>
            <ul className="space-y-0.5">
              {managerQStatus.pending.map((m) => (
                <li key={m.id} className="text-xs text-amber-700">· {m.name}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-600">{t('pendingManagersNote')}</p>
          </div>
        )}
        {managerQStatus && managerQStatus.pending.length === 0 && (
          <p className="mt-2 text-xs text-green-700">{t('allManagersDone')}</p>
        )}
      </ConfirmDialog>

      {/* Edit Cycle Modal（Admin only） */}
      {editingCycle && (
        <EditCycleModal
          cycle={editingCycle}
          onClose={() => setEditingCycle(null)}
          onSave={updateCycle}
        />
      )}

      {/* Confirm Auto-Advance Modal */}
      {confirmingCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">確認如期自動推進</h2>
            <p className="mb-4 text-sm text-gray-600">
              確認後，系統將於 <strong>{new Date(confirmingCycle.reviewStart).toLocaleDateString('zh-TW')}</strong> 自動將<strong>【{confirmingCycle.name}】</strong>推進至員工自評期，並通知所有參與者。
            </p>
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 mb-4">
              若需延後，請點「取消」後改用「延期」功能設定新日期。
            </div>
            {actionError && <p className="mb-3 text-sm text-red-500">{actionError}</p>}
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => { setConfirmingCycle(null); setActionError('') }} disabled={actionLoading}>
                取消
              </button>
              <button className="btn-primary" onClick={handleConfirmAdvance} disabled={actionLoading}>
                {actionLoading ? '處理中…' : '確認如期開始'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Postpone Modal */}
      {postponingCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">延期評核開始日</h2>
            <p className="mb-4 text-sm text-gray-600">
              為 <strong>【{postponingCycle.name}】</strong> 設定新的評核開始日期。系統將自動通知所有員工與主管。
            </p>
            <form onSubmit={handlePostpone} className="space-y-4">
              <div>
                <label htmlFor="postpone-date" className="label">新的評核開始日期</label>
                <input
                  id="postpone-date"
                  type="date"
                  className="input"
                  required
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  value={newReviewStart}
                  onChange={(e) => setNewReviewStart(e.target.value)}
                />
              </div>
              {actionError && <p className="text-sm text-red-500">{actionError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" className="btn-secondary" onClick={() => { setPostponingCycle(null); setActionError('') }} disabled={actionLoading}>
                  {tCommon('cancel')}
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading || !newReviewStart}>
                  {actionLoading ? '處理中…' : '確認延期並通知'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Cycle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('modal.newTitle')}</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">{t('modal.cycleName')}</label>
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder={t('modal.cycleNamePlaceholder')}
                />
              </div>

              <div>
                <label className="label">{t('modal.cycleType')}</label>
                <select className="input" value={form.type} onChange={(e) => updateForm('type', e.target.value as CreateCyclePayload['type'])}>
                  {CYCLE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>

              <div>
                <label className="label">{t('modal.regions')}</label>
                {isAdmin ? (
                  <RegionSelect
                    allRegions={allRegions}
                    value={form.regionId ?? ''}
                    onChange={(r) => updateForm('regionId', r)}
                  />
                ) : (
                  <div className="mt-1 flex gap-1.5 flex-wrap">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {user?.region}
                    </span>
                    <span className="text-xs text-gray-400">{t('modal.autoRegion')}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="label">{t('modal.goalPeriod')}</p>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{t('modal.startDate')}</label>
                    <input type="date" className="input" required value={form.goalSettingStart} onChange={(e) => updateForm('goalSettingStart', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{t('modal.endDate')}</label>
                    <input type="date" className="input" required value={form.goalSettingEnd} onChange={(e) => updateForm('goalSettingEnd', e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <p className="label">{t('modal.reviewPeriod')}</p>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{t('modal.startDate')}</label>
                    <input type="date" className="input" required value={form.reviewStart} onChange={(e) => updateForm('reviewStart', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{t('modal.endDate')}</label>
                    <input type="date" className="input" required value={form.reviewEnd} onChange={(e) => updateForm('reviewEnd', e.target.value)} />
                  </div>
                </div>
              </div>

              {error && <p className="text-error">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>{tCommon('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? t('modal.creating') : t('modal.createBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Template Prep Track ─────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = {
  GoalSetting: 0, InProgress: 1, EmployeeReview: 2,
  SupervisorReview: 3, Calibration: 4, Completed: 5,
}

function TemplatePrepTrack({
  cycleTemplates,
  cycleStatus,
  canEdit,
}: {
  cycleTemplates: ReviewTemplate[]
  cycleStatus: string
  canEdit: boolean
}) {
  const t = useTranslations('cycles')

  const hasTemplate   = cycleTemplates.length > 0
  const anyPublished  = cycleTemplates.some((tmpl) => tmpl.status === 'Published')
  const hasCustomQ    = cycleTemplates.some((tmpl) => tmpl.questions.some((q) => q.isCustom))
  const reviewStarted = STATUS_ORDER[cycleStatus] >= STATUS_ORDER['EmployeeReview']
  const isAboutToStart = cycleStatus === 'InProgress' && canEdit

  const preNodes = [
    {
      label:       t('templateTrack.node0Label'),
      description: t('templateTrack.node0Desc'),
      done:        hasTemplate,
      detail:      hasTemplate ? `${cycleTemplates.length} ${cycleTemplates.length === 1 ? 'template' : 'templates'}` : '',
    },
    {
      label:       t('templateTrack.node1Label'),
      description: t('templateTrack.node1Desc'),
      done:        anyPublished,
      detail:      '',
    },
    {
      label:       t('templateTrack.node2Label'),
      description: t('templateTrack.node2Desc'),
      done:        hasCustomQ,
      detail:      '',
    },
  ]

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('templateTrack.title')}</p>
        {canEdit && !hasTemplate && (
          <Link href="/templates" className="text-xs text-indigo-500 hover:text-indigo-700">
            {t('templateTrack.goCreate')}
          </Link>
        )}
      </div>

      <div className="flex items-start gap-0">
        {preNodes.map((node, i) => (
          <div key={i} className="flex flex-1 items-start">
            <div className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  node.done ? 'bg-green-500 text-white' : 'border-2 border-gray-200 text-gray-300 bg-white',
                ].join(' ')}>
                  {node.done ? '✓' : i + 1}
                </div>
                <div className={['h-0.5 flex-1', node.done ? 'bg-green-200' : 'bg-gray-100'].join(' ')} />
              </div>
              <div className="mt-2 pr-2 w-full">
                <p className={['text-xs font-medium', node.done ? 'text-gray-700' : 'text-gray-400'].join(' ')}>
                  {node.label}
                </p>
                <p className="text-xs text-gray-400 leading-tight">{node.description}</p>
                {node.detail && <p className="text-xs text-gray-400 leading-tight">{node.detail}</p>}
              </div>
            </div>
          </div>
        ))}

        {/* ◆ Review period convergence node */}
        <div className="flex flex-1 items-start">
          <div className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className={[
                'flex h-7 w-7 shrink-0 rotate-45 items-center justify-center text-xs font-semibold',
                reviewStarted ? 'bg-indigo-500 text-white' : 'border-2 border-gray-200 text-gray-300 bg-white',
              ].join(' ')}>
                <span className="-rotate-45">{reviewStarted ? '✓' : ''}</span>
              </div>
            </div>
            <div className="mt-2 pr-2 w-full">
              <p className={['text-xs font-medium', reviewStarted ? 'text-indigo-600' : 'text-gray-400'].join(' ')}>
                {t('templateTrack.reviewStart')}
              </p>
            </div>
          </div>
        </div>

        {[4, 5, 6, 7].map((i) => (
          <div key={i} className="flex flex-1" />
        ))}
      </div>

      {isAboutToStart && !hasTemplate && (
        <WarnText>{t('templateTrack.warnNoTemplate')}</WarnText>
      )}
      {isAboutToStart && hasTemplate && !anyPublished && (
        <WarnText>{t('templateTrack.warnNotPublished')}</WarnText>
      )}
      {isAboutToStart && anyPublished && !hasCustomQ && (
        <WarnText>{t('templateTrack.warnNoCustomQ')}</WarnText>
      )}
    </div>
  )
}

// ─── Cycle Card ───────────────────────────────────────────────────────────────

function CycleCard({
  cycle, canEdit, isAdmin, cycleTemplates, nextStatusLabel, onAdvance, onEdit, onConfirmAdvance, onPostpone,
}: {
  cycle: PerformanceCycle
  canEdit: boolean
  isAdmin: boolean
  cycleTemplates: ReviewTemplate[] | null
  nextStatusLabel: Record<string, string>
  onAdvance?: () => void
  onEdit?: () => void
  onConfirmAdvance?: () => void
  onPostpone?: () => void
}) {
  const t      = useTranslations('cycles')
  const locale = useLocale()

  const nextLabel  = nextStatusLabel[cycle.status]
  const regionName = cycle.region?.name ?? ''

  // 7 天前提醒：評核期還沒到、還沒確認、HR 可操作
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const reviewStart = new Date(cycle.reviewStart)
  const daysUntilReview = Math.ceil((reviewStart.getTime() - today.getTime()) / 86400000)
  const showAdvanceBanner = (
    canEdit &&
    cycle.status === 'InProgress' &&
    daysUntilReview <= 7 &&
    !cycle.advanceConfirmed
  )
  const showConfirmedBadge = canEdit && cycle.status === 'InProgress' && cycle.advanceConfirmed
  const reviewStartPast = cycle.status === 'InProgress' && reviewStart < today && !cycle.advanceConfirmed

  return (
    <div className="card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{cycle.name}</h3>
          <p className="text-sm text-gray-500">{cycle.type}{regionName ? ` · ${regionName}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && cycle.status === 'GoalSetting' && onEdit && (
            <button className="btn-secondary text-xs" onClick={onEdit}>{t('card.edit')}</button>
          )}
          {canEdit && nextLabel && onAdvance && (
            <button className="btn-secondary text-xs" onClick={onAdvance}>
              {nextLabel} →
            </button>
          )}
        </div>
      </div>

      {/* 評核期已過但未確認 → 橘色警示 */}
      {reviewStartPast && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium text-amber-800">評核期已於 {reviewStart.toLocaleDateString('zh-TW')} 到期，尚未推進</p>
            <p className="mt-0.5 text-xs text-amber-600">請確認如期開始，或設定新的評核日期。</p>
            <div className="mt-2 flex gap-2">
              {onConfirmAdvance && <button onClick={onConfirmAdvance} className="rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors">確認立即推進</button>}
              {onPostpone && <button onClick={onPostpone} className="rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors">設定新日期</button>}
            </div>
          </div>
        </div>
      )}

      {/* 7 天前提醒 → 藍色確認橫幅 */}
      {showAdvanceBanner && !reviewStartPast && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium text-blue-800">
              評核期將於 {reviewStart.toLocaleDateString('zh-TW')}（{daysUntilReview} 天後）開始
            </p>
            <p className="mt-0.5 text-xs text-blue-600">請確認是否如期開始，或設定延期日期。確認後系統將在當天自動推進並通知所有參與者。</p>
            <div className="mt-2 flex gap-2">
              {onConfirmAdvance && <button onClick={onConfirmAdvance} className="rounded-md bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 transition-colors">確認如期開始</button>}
              {onPostpone && <button onClick={onPostpone} className="rounded-md border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">延期</button>}
            </div>
          </div>
        </div>
      )}

      {/* 已確認自動推進 → 綠色標示 */}
      {showConfirmedBadge && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm">
          <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-green-700">
            已確認：系統將於 <strong>{reviewStart.toLocaleDateString('zh-TW')}</strong> 自動推進至員工自評期
          </p>
          {onPostpone && (
            <button onClick={onPostpone} className="ml-auto text-xs text-green-600 underline hover:text-green-800">需要延期？</button>
          )}
        </div>
      )}

      {cycleTemplates !== null && cycle.status !== 'Completed' ? (
        <>
          <TemplatePrepTrack
            cycleTemplates={cycleTemplates}
            cycleStatus={cycle.status}
            canEdit={canEdit}
          />
          <div className="my-4 border-t border-dashed border-gray-100" />
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">{t('card.reviewProcess')}</p>
          <CycleStepper status={cycle.status} />
        </>
      ) : (
        <CycleStepper status={cycle.status} />
      )}

      <div className="mt-4 flex gap-6 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>{t('card.goalRange', { start: fmt(cycle.goalSettingStart, locale), end: fmt(cycle.goalSettingEnd, locale) })}</span>
        <span>{t('card.reviewRange', { start: fmt(cycle.reviewStart, locale), end: fmt(cycle.reviewEnd, locale) })}</span>
      </div>
    </div>
  )
}

// ─── Edit Cycle Modal（Admin only）────────────────────────────────────────────

function EditCycleModal({
  cycle, onClose, onSave,
}: {
  cycle: PerformanceCycle
  onClose: () => void
  onSave: (id: string, payload: UpdateCyclePayload) => Promise<void>
}) {
  const t       = useTranslations('cycles')
  const tCommon = useTranslations('common')

  const [form, setForm] = useState({
    name:             cycle.name,
    goalSettingStart: cycle.goalSettingStart.slice(0, 10),
    goalSettingEnd:   cycle.goalSettingEnd.slice(0, 10),
    reviewStart:      cycle.reviewStart.slice(0, 10),
    reviewEnd:        cycle.reviewEnd.slice(0, 10),
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSave(cycle.id, form)
      onClose()
    } catch {
      setError('Failed to save changes.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('modal.editTitle')}</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">{t('modal.cycleName')}</label>
            <input className="input" required value={form.name} onChange={(e) => updateField('name', e.target.value)} />
          </div>

          <div>
            <p className="label">{t('modal.goalPeriod')}</p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t('modal.startDate')}</label>
                <input type="date" className="input" required value={form.goalSettingStart} onChange={(e) => updateField('goalSettingStart', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t('modal.endDate')}</label>
                <input type="date" className="input" required value={form.goalSettingEnd} onChange={(e) => updateField('goalSettingEnd', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <p className="label">{t('modal.reviewPeriod')}</p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t('modal.startDate')}</label>
                <input type="date" className="input" required value={form.reviewStart} onChange={(e) => updateField('reviewStart', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t('modal.endDate')}</label>
                <input type="date" className="input" required value={form.reviewEnd} onChange={(e) => updateField('reviewEnd', e.target.value)} />
              </div>
            </div>
          </div>

          {error && <p className="text-error">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>{tCommon('cancel')}</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? t('modal.saving') : t('modal.saveBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
