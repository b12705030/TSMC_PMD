'use client'

import { use, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/PageHeader'
import { Loading } from '@/components/Loading'
import { ErrorBanner } from '@/components/ErrorBanner'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useReview } from '@/modules/reviews/hooks/useReviews'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { TemplateQuestion, ReviewGrade, Goal, GoalStatus } from '@/types'

const GRADE_DISPLAY: Record<ReviewGrade, string> = {
  O:       'O',
  S_Plus:  'S+',
  S:       'S',
  S_Minus: 'S-',
  I:       'I',
  U:       'U',
}

const GRADE_COLOR: Record<ReviewGrade, string> = {
  O:       'border-green-500 bg-green-500 text-white',
  S_Plus:  'border-indigo-500 bg-indigo-500 text-white',
  S:       'border-indigo-600 bg-indigo-600 text-white',
  S_Minus: 'border-indigo-400 bg-indigo-400 text-white',
  I:       'border-amber-500 bg-amber-500 text-white',
  U:       'border-red-500 bg-red-500 text-white',
}

const GRADES: ReviewGrade[] = ['O', 'S_Plus', 'S', 'S_Minus', 'I', 'U']

// ─── Grade scale tooltip ──────────────────────────────────────────────────────

function GradeScaleTip() {
  const t = useTranslations('reviews')

  const GRADE_SCALE: { grade: ReviewGrade; label: string; desc: string }[] = [
    { grade: 'O',       label: t('grades.O.label'),       desc: t('grades.O.desc') },
    { grade: 'S_Plus',  label: t('grades.S_Plus.label'),  desc: t('grades.S_Plus.desc') },
    { grade: 'S',       label: t('grades.S.label'),       desc: t('grades.S.desc') },
    { grade: 'S_Minus', label: t('grades.S_Minus.label'), desc: t('grades.S_Minus.desc') },
    { grade: 'I',       label: t('grades.I.label'),       desc: t('grades.I.desc') },
    { grade: 'U',       label: t('grades.U.label'),       desc: t('grades.U.desc') },
  ]

  return (
    <div className="group relative inline-block align-middle">
      <span className="cursor-help select-none text-xs text-gray-400 underline decoration-dotted">
        {t('grades.tooltip')}
      </span>
      <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-xl border border-gray-100 bg-white p-3 shadow-xl group-hover:block">
        <div className="space-y-1.5">
          {GRADE_SCALE.map(({ grade, label, desc }) => (
            <div key={grade} className="flex items-start gap-2 text-xs">
              <span className={`mt-px shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ring-0 border ${GRADE_COLOR[grade]}`}>
                {GRADE_DISPLAY[grade]}
              </span>
              <span className="text-gray-600">
                <span className="font-medium text-gray-800">{label}</span>
                <span className="mx-1 text-gray-300">·</span>
                {desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Employee question renderer ───────────────────────────────────────────────

interface QuestionFieldProps {
  q: TemplateQuestion
  value: string
  onChange: (v: string) => void
  readonly?: boolean
}

function QuestionField({ q, value, onChange, readonly = false }: Readonly<QuestionFieldProps>) {
  const t = useTranslations('reviews')

  if (q.questionType === 'Rating') {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          let btnClass: string
          if (value === String(n)) {
            btnClass = 'border-indigo-600 bg-indigo-600 text-white'
          } else if (readonly) {
            btnClass = 'border-gray-200 text-gray-400'
          } else {
            btnClass = 'border-gray-200 text-gray-500 hover:border-indigo-400'
          }
          return (
            <button
              key={n}
              type="button"
              disabled={readonly}
              onClick={() => !readonly && onChange(String(n))}
              className={`h-9 w-9 rounded-full border-2 text-sm font-semibold transition-colors ${btnClass}`}
            >
              {n}
            </button>
          )
        })}
      </div>
    )
  }
  if (q.questionType === 'MultipleChoice') {
    return (
      <div className="space-y-1.5">
        {q.options.map((opt) => (
          <label key={opt} className={`flex items-center gap-2.5 ${readonly ? 'cursor-default' : 'cursor-pointer'}`}>
            <input
              type="radio"
              name={`q-${q.id}`}
              value={opt}
              checked={value === opt}
              onChange={() => !readonly && onChange(opt)}
              disabled={readonly}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className={`text-sm ${readonly ? 'text-gray-500' : 'text-gray-700'}`}>{opt}</span>
          </label>
        ))}
      </div>
    )
  }
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readonly}
      placeholder={readonly ? t('grades.noAnswer') : t('detail.sections.answerPlaceholder')}
      className={`w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
        readonly
          ? 'border-gray-100 bg-gray-50 text-gray-600'
          : 'border-gray-200 bg-white text-gray-900 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200'
      }`}
    />
  )
}

// ─── Goals summary (collapsible reference panel) ─────────────────────────────

const STATUS_COLOR: Record<GoalStatus, string> = {
  Draft:           'bg-gray-100 text-gray-500',
  PendingApproval: 'bg-yellow-100 text-yellow-700',
  Approved:        'bg-indigo-100 text-indigo-700',
  Completed:       'bg-green-100 text-green-700',
  Rejected:        'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<GoalStatus, string> = {
  Draft:           '草稿',
  PendingApproval: '待審核',
  Approved:        '進行中',
  Completed:       '已完成',
  Rejected:        '已退回',
}

function GoalsSummary({ employeeId, cycleId, goalSettingStart, reviewEnd, isOwner }: Readonly<{
  employeeId: string
  cycleId: string
  goalSettingStart: string
  reviewEnd: string
  isOwner: boolean
}>) {
  const [goals, setGoals]     = useState<Goal[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  async function load() {
    if (fetched) return
    setLoading(true)
    try {
      const data = isOwner
        ? await api.get<Goal[]>('/goals')
        : await api.get<Goal[]>(`/goals/employee/${employeeId}`)
      const start = new Date(goalSettingStart).getTime()
      const end   = new Date(reviewEnd).getTime()
      setGoals(data.filter((g) => {
        if (g.status === 'Draft') return false
        if (g.cycleId === cycleId) return true
        const created = new Date(g.createdAt).getTime()
        return created >= start && created <= end
      }))
      setFetched(true)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  function toggle() {
    if (!open && !fetched) load()
    setOpen((v) => !v)
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zm-1 8h8m-8 4h5" />
          </svg>
          本週期目標參考
          {fetched && goals.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {goals.length}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-200 px-4 pb-4 pt-3">
          {(() => {
            if (loading) return <Loading className="py-2" />
            if (goals.length === 0) return <p className="text-xs text-gray-400">本週期沒有設定目標</p>
            return (
            <div className="space-y-2">
              {goals.map((g) => {
                const done  = g.milestones.filter((m) => m.completedAt).length
                const total = g.milestones.length
                const pct   = total > 0 ? Math.round((done / total) * 100) : null
                const statusColor = STATUS_COLOR[g.status]
                const statusLabel = STATUS_LABEL[g.status] ?? g.status
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{g.title}</p>
                      {total > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-1.5 rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">里程碑 {done}/{total} · {pct}%</span>
                        </div>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                )
              })}
            </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations('reviews')
  const tCommon = useTranslations('common')
  const { review, isLoading, error, refetch } = useReview(id)
  const { user } = useAuth()

  const [answers, setAnswers]       = useState<Record<string, string>>({})
  const [supAnswers, setSupAnswers]  = useState<Record<string, string>>({})
  const [comment, setComment]       = useState('')
  const [grade, setGrade]           = useState<ReviewGrade | ''>('')
  const [saving, setSaving]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showAppealForm, setShowAppealForm] = useState(false)
  const [appealReason, setAppealReason]     = useState('')
  const [appealSubmitting, setAppealSubmitting] = useState(false)

  const GRADE_SCALE: { grade: ReviewGrade; label: string; desc: string }[] = [
    { grade: 'O',       label: t('grades.O.label'),       desc: t('grades.O.desc') },
    { grade: 'S_Plus',  label: t('grades.S_Plus.label'),  desc: t('grades.S_Plus.desc') },
    { grade: 'S',       label: t('grades.S.label'),       desc: t('grades.S.desc') },
    { grade: 'S_Minus', label: t('grades.S_Minus.label'), desc: t('grades.S_Minus.desc') },
    { grade: 'I',       label: t('grades.I.label'),       desc: t('grades.I.desc') },
    { grade: 'U',       label: t('grades.U.label'),       desc: t('grades.U.desc') },
  ]

  useEffect(() => {
    if (!review) return
    const ans: Record<string, string> = {}
    for (const a of review.employeeAnswers) ans[a.questionId] = a.answer
    setAnswers(ans)

    const sup: Record<string, string> = {}
    for (const a of review.supervisorAnswers) sup[a.questionId] = a.answer
    setSupAnswers(sup)

    setComment(review.supervisorComment ?? '')
    setGrade(review.grade ?? '')
  }, [review?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Loading />
  if (error)     return <ErrorBanner message={error} />
  if (!review || !user) return <p className="text-error">{t('detail.notFound')}</p>

  const questions     = review.template.questions
  const isEmployee    = user.id === review.employeeId
  const isSupervisor  = review.supervisorId !== null && user.id === review.supervisorId
  const isManager     = user.role === 'Manager' || user.role === 'Admin'
  // Direct-report: supervisorId is null, manager handles the review directly
  const isDirectReportManager = isManager && review.supervisorId === null && user.id === review.employee.managerId
  // Supervisors should not see that an appeal was filed — show Appealed reviews as Published to them
  const displayAsAppealed = review.status === 'Appealed' && !isSupervisor

  const canEmployeeEdit   = isEmployee && review.status === 'PendingEmployeeSubmit'
  const canSupervisorEdit = (isSupervisor || isDirectReportManager) && review.status === 'PendingSupervisorReview'

  const showEmployeeSection = canEmployeeEdit ||
    (!isSupervisor && !isManager && review.status !== 'PendingEmployeeSubmit' && review.employeeAnswers.length > 0)

  const showSupervisorSection = canSupervisorEdit || (
    review.status !== 'PendingEmployeeSubmit' &&
    review.status !== 'PendingSupervisorReview' &&
    (isSupervisor || isManager || isDirectReportManager) &&
    (review.supervisorAnswers.length > 0 || !!review.supervisorComment || !!review.grade)
  )

  // Employee sees supervisor per-question answers after result is published
  const showSupAnswersToEmployee = isEmployee &&
    (review.status === 'Published' || review.status === 'Appealed') &&
    review.supervisorAnswers.length > 0

  // ── Handlers ──

  async function handleSaveEmployee() {
    setSaving(true)
    try {
      await api.put(`/reviews/${id}/answers`, {
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
      })
    } catch {
      alert(t('detail.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitEmployee() {
    setSubmitting(true)
    try {
      await api.put(`/reviews/${id}/answers`, {
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
      })
      await api.post(`/reviews/${id}/submit`, {})
      refetch()
    } catch {
      alert(t('detail.submitFailed'))
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }

  async function handleSaveSupervisor() {
    setSaving(true)
    try {
      await api.put(`/reviews/${id}/supervisor`, {
        answers: Object.entries(supAnswers).map(([questionId, answer]) => ({ questionId, answer })),
        comment: comment || undefined,
        grade:   grade   || undefined,
      })
    } catch {
      alert(t('detail.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitSupervisor() {
    setSubmitting(true)
    try {
      await api.put(`/reviews/${id}/supervisor`, {
        answers: Object.entries(supAnswers).map(([questionId, answer]) => ({ questionId, answer })),
        comment: comment || undefined,
        grade:   grade   || undefined,
      })
      await api.post(`/reviews/${id}/supervisor/submit`, {})
      refetch()
    } catch {
      alert(t('detail.submitFailed'))
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }

  async function handleSubmitAppeal() {
    if (appealReason.trim().length < 10) return
    setAppealSubmitting(true)
    try {
      await api.post('/appeals', { reviewId: id, reason: appealReason.trim() })
      refetch()
      setShowAppealForm(false)
      setAppealReason('')
    } catch {
      alert(t('detail.appealFailed'))
    } finally {
      setAppealSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('detail.title')}
        breadcrumbs={[
          {
            label: isEmployee ? t('detail.breadcrumbMy') : t('detail.breadcrumbTeam'),
            href:  isEmployee ? '/reviews'               : '/reviews/team',
          },
          { label: review.cycle.name },
        ]}
        actions={<StatusBadge status={isSupervisor && review.status === 'Appealed' ? 'Published' : review.status} />}
      />

      {/* Status banner: supervisor/manager viewing before employee submits */}
      {(isSupervisor || isManager) && review.status === 'PendingEmployeeSubmit' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">{t('detail.waitingEmployee')}</p>
          <p className="mt-0.5 text-xs text-amber-600">
            {t('detail.waitingEmployeeDesc', { name: review.employee.name })}
          </p>
        </div>
      )}

      {/* Meta */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('meta.cycle')}</p>
            <p className="font-medium text-gray-800">{review.cycle.name}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('meta.template')}</p>
            <p className="font-medium text-gray-800">{review.template.name}</p>
          </div>
          {(isSupervisor || isManager) && (
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('meta.employee')}</p>
              <p className="font-medium text-gray-800">
                {review.employee.name}
                <span className="ml-1.5 text-xs font-normal text-gray-400">
                  {review.employee.jobTitle} · {review.employee.jobLevel}
                </span>
              </p>
            </div>
          )}
          {isEmployee && (
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('meta.supervisor')}</p>
              <p className="font-medium text-gray-800">{review.supervisor?.name ?? t('meta.defaultSupervisor')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Published result ── */}
      {(review.status === 'Published' || review.status === 'Appealed') && review.grade && (
        <div className={`mb-6 rounded-xl border p-5 ${
          displayAsAppealed ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-semibold mb-1 ${displayAsAppealed ? 'text-red-700' : 'text-green-700'}`}>
                {displayAsAppealed ? t('detail.published.appealed') : t('detail.published.result')}
              </p>
              <p className={`text-4xl font-bold mb-1 ${displayAsAppealed ? 'text-red-800' : 'text-green-800'}`}>
                {GRADE_DISPLAY[review.grade]}
              </p>
              <p className={`text-sm font-medium ${displayAsAppealed ? 'text-red-600' : 'text-green-600'}`}>
                {GRADE_SCALE.find(g => g.grade === review.grade)?.label}
                <span className="mx-1.5 opacity-50">·</span>
                <span className="font-normal">{GRADE_SCALE.find(g => g.grade === review.grade)?.desc}</span>
              </p>
            </div>
            <GradeScaleTip />
          </div>

          {review.supervisorComment && (
            <p className={`text-sm border-t pt-3 mt-3 ${displayAsAppealed ? 'text-red-700 border-red-200' : 'text-green-700 border-green-200'}`}>
              <span className="font-medium">{t('detail.published.supervisorComment')}</span>{review.supervisorComment}
            </p>
          )}

          {/* Employee appeal entry */}
          {isEmployee && review.status === 'Published' && (
            <div className="mt-4 border-t border-green-200 pt-4">
              {showAppealForm ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">{t('detail.published.appealLabel')}</p>
                  <textarea
                    rows={4}
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    placeholder={t('detail.published.appealPlaceholder')}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
                  />
                  <p className="text-xs text-gray-400">{t('detail.published.appealNote')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitAppeal}
                      disabled={appealSubmitting || appealReason.trim().length < 10}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {appealSubmitting ? t('detail.published.appealSubmitting') : t('detail.published.appealConfirm')}
                    </button>
                    <button
                      onClick={() => { setShowAppealForm(false); setAppealReason('') }}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      {tCommon('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAppealForm(true)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  {t('detail.published.appealBtn')}
                </button>
              )}
            </div>
          )}

          {isEmployee && displayAsAppealed && (
            <p className="mt-4 text-xs text-red-600 border-t border-red-200 pt-3">
              {t('detail.published.appealSubmitted')}
            </p>
          )}

          {isEmployee && review.appeal?.status === 'Resolved' && review.appeal.managerResponse && (
            <div className="mt-4 border-t border-green-200 pt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600">申訴結果</p>
              <p className="text-sm text-gray-700">{review.appeal.managerResponse}</p>
              {review.appeal.resolvedAt && (
                <p className="text-xs text-gray-400">
                  {new Date(review.appeal.resolvedAt).toLocaleDateString('zh-TW')} 處理完畢
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Employee self-assessment form ── */}
      {showEmployeeSection && (
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            {t('detail.sections.employeeSelf')}
            {!canEmployeeEdit && (
              <span className="ml-2 text-xs font-normal text-gray-400">{t('detail.sections.submitted')}</span>
            )}
          </h2>
          <GoalsSummary employeeId={review.employeeId} cycleId={review.cycleId} goalSettingStart={review.cycle.goalSettingStart} reviewEnd={review.cycle.reviewEnd} isOwner={isEmployee} />
          <div className="space-y-4">
            {questions.map((q) => {
              const empAns = review.employeeAnswers.find((a) => a.questionId === q.id)?.answer ?? ''
              return (
                <div key={q.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-sm font-medium text-gray-800">
                    {q.questionText}
                    {q.required && <span className="ml-1 text-red-400">*</span>}
                  </p>
                  {canEmployeeEdit ? (
                    <QuestionField
                      q={q}
                      value={answers[q.id] ?? ''}
                      onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    />
                  ) : (
                    <QuestionField q={q} value={empAns} onChange={() => {}} readonly />
                  )}
                </div>
              )
            })}
          </div>

          {canEmployeeEdit && (
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSaveEmployee}
                disabled={saving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? t('detail.sections.saving') : t('detail.sections.saveDraft')}
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {t('detail.sections.submitSelf')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Employee views supervisor per-question answers after publish ── */}
      {showSupAnswersToEmployee && (
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{t('detail.sections.supervisorPerQ')}</h2>
          <div className="space-y-4">
            {questions.map((q) => {
              const supAns = review.supervisorAnswers.find((a) => a.questionId === q.id)?.answer
              return (
                <div key={q.id} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5 shadow-sm">
                  <p className="mb-2 text-sm font-medium text-gray-800">{q.questionText}</p>
                  {supAns ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{supAns}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">{t('detail.sections.noAnswer')}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Supervisor evaluation ── */}
      {showSupervisorSection && (
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            {t('detail.sections.supervisorReview')}
            {!canSupervisorEdit && (
              <span className="ml-2 text-xs font-normal text-gray-400">{t('detail.sections.submitted')}</span>
            )}
          </h2>
          <GoalsSummary employeeId={review.employeeId} cycleId={review.cycleId} goalSettingStart={review.cycle.goalSettingStart} reviewEnd={review.cycle.reviewEnd} isOwner={false} />

          {/* 2-column layout when supervisor is editing */}
          {canSupervisorEdit && questions.length > 0 && (
            <div className="mb-6 grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:grid-cols-2">
              {/* Left: employee answers (read-only reference) */}
              <div className="border-b border-gray-100 bg-gray-50 p-5 lg:border-b-0 lg:border-r">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('detail.sections.leftCol')}</p>
                <div className="space-y-5">
                  {questions.map((q) => {
                    const empAns = review.employeeAnswers.find((a) => a.questionId === q.id)?.answer ?? ''
                    return (
                      <div key={q.id}>
                        <p className="mb-1.5 text-sm font-medium text-gray-700">{q.questionText}</p>
                        <QuestionField q={q} value={empAns} onChange={() => {}} readonly />
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Right: supervisor text inputs (always textarea) */}
              <div className="p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-indigo-500">{t('detail.sections.rightCol')}</p>
                <div className="space-y-5">
                  {questions.map((q) => (
                    <div key={q.id}>
                      <p className="mb-1.5 text-sm font-medium text-gray-700">{q.questionText}</p>
                      <textarea
                        rows={3}
                        value={supAnswers[q.id] ?? ''}
                        onChange={(e) => setSupAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={t('detail.sections.supAnswerPlaceholder')}
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Read-only: stacked view (non-editing supervisor or manager) */}
          {!canSupervisorEdit && questions.length > 0 && (
            <div className="mb-6 space-y-4">
              {questions.map((q) => {
                const supAns = review.supervisorAnswers.find((a) => a.questionId === q.id)?.answer ?? ''
                const empAns = review.employeeAnswers.find((a) => a.questionId === q.id)?.answer ?? ''
                return (
                  <div key={q.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="mb-3 text-sm font-medium text-gray-800">{q.questionText}</p>
                    {empAns && (
                      <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="mb-1 text-xs font-medium text-gray-400">{t('detail.sections.selfReadOnly')}</p>
                        <QuestionField q={q} value={empAns} onChange={() => {}} readonly />
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-medium text-gray-400">{t('detail.sections.supReadOnly')}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {supAns || <span className="text-gray-400 italic">{t('detail.sections.noAnswerFilled')}</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Comment + Grade */}
          <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('detail.sections.overallLabel')}</label>
              {canSupervisorEdit ? (
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('detail.sections.overallPlaceholder')}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              ) : (
                <p className="text-sm text-gray-600">{review.supervisorComment ?? t('detail.sections.overallEmpty')}</p>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">{t('detail.sections.gradeLabel')}</label>
                <GradeScaleTip />
              </div>
              {canSupervisorEdit ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(g === grade ? '' : g)}
                        className={`h-9 min-w-[2.75rem] rounded-lg border-2 px-2 text-sm font-bold transition-colors ${
                          grade === g
                            ? GRADE_COLOR[g]
                            : 'border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {GRADE_DISPLAY[g]}
                      </button>
                    ))}
                  </div>
                  {grade && (
                    <p className="mt-2 text-xs text-gray-500">
                      {GRADE_SCALE.find(s => s.grade === grade)?.label}：
                      {GRADE_SCALE.find(s => s.grade === grade)?.desc}
                    </p>
                  )}
                  {grade === 'O' && (
                    <p className="mt-1 text-xs text-green-700">{t('detail.sections.gradeWarnO')}</p>
                  )}
                  {grade === 'U' && (
                    <p className="mt-1 text-xs text-red-600">{t('detail.sections.gradeWarnU')}</p>
                  )}
                </>
              ) : (
                <p className={`text-lg font-bold ${review.grade ? 'text-gray-900' : 'text-gray-400'}`}>
                  {review.grade
                    ? `${GRADE_DISPLAY[review.grade]} · ${GRADE_SCALE.find(s => s.grade === review.grade)?.label}`
                    : t('detail.sections.overallEmpty')}
                </p>
              )}
            </div>
          </div>

          {canSupervisorEdit && (
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSaveSupervisor}
                disabled={saving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? t('detail.sections.saving') : t('detail.sections.saveDraft')}
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!grade}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('detail.sections.submitSup')}
              </button>
              {!grade && (
                <p className="text-xs text-gray-400">{t('detail.sections.gradeRequired')}</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Confirm dialog ── */}
      <ConfirmDialog
        open={showConfirm}
        title={canEmployeeEdit ? t('detail.sections.confirmSelfTitle') : t('detail.sections.confirmSupTitle')}
        description={canEmployeeEdit ? t('detail.sections.confirmSelfDesc') : t('detail.sections.confirmSupDesc')}
        confirmLabel={submitting ? t('detail.sections.confirming') : t('detail.sections.confirm')}
        onConfirm={canEmployeeEdit ? handleSubmitEmployee : handleSubmitSupervisor}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
