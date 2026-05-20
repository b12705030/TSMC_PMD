'use client'

import { use, useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { ErrorBanner } from '@/components/ErrorBanner'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useReview } from '@/modules/reviews/hooks/useReviews'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { TemplateQuestion, ReviewGrade } from '@/types'

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

const GRADE_SCALE: { grade: ReviewGrade; label: string; desc: string }[] = [
  { grade: 'O',       label: '傑出',     desc: '極少數頂尖，各方面大幅超越期望' },
  { grade: 'S_Plus',  label: '強優',     desc: '全面超越期望，顯著貢獻' },
  { grade: 'S',       label: '滿意',     desc: '完全達成所有目標與期望' },
  { grade: 'S_Minus', label: '部分滿意', desc: '大致達成，少數面向有待加強' },
  { grade: 'I',       label: '待改善',   desc: '未完全達成，需要輔導改善' },
  { grade: 'U',       label: '未達標',   desc: '明顯低於標準，須進入 PMD 追蹤' },
]

// ─── Grade scale tooltip ──────────────────────────────────────────────────────

function GradeScaleTip() {
  return (
    <div className="group relative inline-block align-middle">
      <span className="cursor-help select-none text-xs text-gray-400 underline decoration-dotted">
        ⓘ 等第說明
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

function QuestionField({ q, value, onChange, readonly = false }: QuestionFieldProps) {
  if (q.questionType === 'Rating') {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange(String(n))}
            className={`h-9 w-9 rounded-full border-2 text-sm font-semibold transition-colors ${
              value === String(n)
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : readonly
                ? 'border-gray-200 text-gray-400'
                : 'border-gray-200 text-gray-500 hover:border-indigo-400'
            }`}
          >
            {n}
          </button>
        ))}
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
      placeholder={readonly ? '（尚未作答）' : '請輸入您的回答...'}
      className={`w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
        readonly
          ? 'border-gray-100 bg-gray-50 text-gray-600'
          : 'border-gray-200 bg-white text-gray-900 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200'
      }`}
    />
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
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

  if (isLoading) return <p className="text-muted">載入中...</p>
  if (error)     return <ErrorBanner message={error} />
  if (!review || !user) return <p className="text-error">找不到評核。</p>

  const questions     = review.template.questions
  const isEmployee    = user.id === review.employeeId
  const isSupervisor  = review.supervisorId !== null && user.id === review.supervisorId
  const isManager     = user.role === 'Manager' || user.role === 'Admin'
  // Direct-report: supervisorId is null, manager handles the review directly
  const isDirectReportManager = isManager && review.supervisorId === null && user.id === review.employee.managerId

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
      alert('儲存失敗，請稍後再試')
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
      alert('送出失敗，請稍後再試')
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
      alert('儲存失敗，請稍後再試')
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
      alert('送出失敗，請稍後再試')
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
      alert('提交申訴失敗，請稍後再試')
    } finally {
      setAppealSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="績效評核"
        breadcrumbs={[
          {
            label: isEmployee ? '我的評核' : '團隊評核',
            href:  isEmployee ? '/reviews'  : '/reviews/team',
          },
          { label: review.cycle.name },
        ]}
        actions={<StatusBadge status={review.status} />}
      />

      {/* Status banner: supervisor/manager viewing before employee submits */}
      {(isSupervisor || isManager) && review.status === 'PendingEmployeeSubmit' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">等待員工填寫自評</p>
          <p className="mt-0.5 text-xs text-amber-600">
            員工（{review.employee.name}）尚未完成自評，送出後您才能進行主管評核。
          </p>
        </div>
      )}

      {/* Meta */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">週期</p>
            <p className="font-medium text-gray-800">{review.cycle.name}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">模板</p>
            <p className="font-medium text-gray-800">{review.template.name}</p>
          </div>
          {(isSupervisor || isManager) && (
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">受評員工</p>
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
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">直屬主管</p>
              <p className="font-medium text-gray-800">{review.supervisor?.name ?? '（直屬主管）'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Published result ── */}
      {(review.status === 'Published' || review.status === 'Appealed') && review.grade && (
        <div className={`mb-6 rounded-xl border p-5 ${
          review.status === 'Appealed' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm font-semibold mb-1 ${review.status === 'Appealed' ? 'text-red-700' : 'text-green-700'}`}>
                {review.status === 'Appealed' ? '申訴審核中' : '評核結果已發布'}
              </p>
              <p className={`text-4xl font-bold mb-1 ${review.status === 'Appealed' ? 'text-red-800' : 'text-green-800'}`}>
                {GRADE_DISPLAY[review.grade]}
              </p>
              <p className={`text-sm font-medium ${review.status === 'Appealed' ? 'text-red-600' : 'text-green-600'}`}>
                {GRADE_SCALE.find(g => g.grade === review.grade)?.label}
                <span className="mx-1.5 opacity-50">·</span>
                <span className="font-normal">{GRADE_SCALE.find(g => g.grade === review.grade)?.desc}</span>
              </p>
            </div>
            <GradeScaleTip />
          </div>

          {review.supervisorComment && (
            <p className={`text-sm border-t pt-3 mt-3 ${review.status === 'Appealed' ? 'text-red-700 border-red-200' : 'text-green-700 border-green-200'}`}>
              <span className="font-medium">主管評語：</span>{review.supervisorComment}
            </p>
          )}

          {/* 員工申訴入口 */}
          {isEmployee && review.status === 'Published' && (
            <div className="mt-4 border-t border-green-200 pt-4">
              {!showAppealForm ? (
                <button
                  onClick={() => setShowAppealForm(true)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  對結果有異議？提出申訴 →
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">申訴原因</p>
                  <textarea
                    rows={4}
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    placeholder="請詳細說明您認為評核結果有誤的理由（至少 10 字）..."
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
                  />
                  <p className="text-xs text-gray-400">申訴將直接送交您的上級經理審閱，直屬主管不會看到內容。</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitAppeal}
                      disabled={appealSubmitting || appealReason.trim().length < 10}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {appealSubmitting ? '提交中...' : '確認提交申訴'}
                    </button>
                    <button
                      onClick={() => { setShowAppealForm(false); setAppealReason('') }}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isEmployee && review.status === 'Appealed' && (
            <p className="mt-4 text-xs text-red-600 border-t border-red-200 pt-3">
              您的申訴已送出，等待上級經理審閱。
            </p>
          )}
        </div>
      )}

      {/* ── Employee self-assessment form ── */}
      {showEmployeeSection && (
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            員工自評
            {!canEmployeeEdit && (
              <span className="ml-2 text-xs font-normal text-gray-400">（已送出，不可修改）</span>
            )}
          </h2>
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
                {saving ? '儲存中...' : '儲存草稿'}
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                送出自評
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Employee views supervisor per-question answers after publish ── */}
      {showSupAnswersToEmployee && (
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">主管逐題評語</h2>
          <div className="space-y-4">
            {questions.map((q) => {
              const supAns = review.supervisorAnswers.find((a) => a.questionId === q.id)?.answer
              return (
                <div key={q.id} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5 shadow-sm">
                  <p className="mb-2 text-sm font-medium text-gray-800">{q.questionText}</p>
                  {supAns ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{supAns}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">（主管未作答）</p>
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
            主管評核
            {!canSupervisorEdit && (
              <span className="ml-2 text-xs font-normal text-gray-400">（已送出，不可修改）</span>
            )}
          </h2>

          {/* 2-column layout when supervisor is editing */}
          {canSupervisorEdit && questions.length > 0 && (
            <div className="mb-6 grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:grid-cols-2">
              {/* Left: employee answers (read-only reference) */}
              <div className="border-b border-gray-100 bg-gray-50 p-5 lg:border-b-0 lg:border-r">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">員工自評（參考）</p>
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
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-indigo-500">主管評核意見</p>
                <div className="space-y-5">
                  {questions.map((q) => (
                    <div key={q.id}>
                      <p className="mb-1.5 text-sm font-medium text-gray-700">{q.questionText}</p>
                      <textarea
                        rows={3}
                        value={supAnswers[q.id] ?? ''}
                        onChange={(e) => setSupAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="請輸入您對此題的評核意見（可留空）..."
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
                        <p className="mb-1 text-xs font-medium text-gray-400">員工自評</p>
                        <QuestionField q={q} value={empAns} onChange={() => {}} readonly />
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-medium text-gray-400">主管評核意見</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {supAns || <span className="text-gray-400 italic">（未填寫）</span>}
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
              <label className="mb-1 block text-sm font-medium text-gray-700">整體評核說明</label>
              {canSupervisorEdit ? (
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="描述您的整體評核理由與員工表現..."
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              ) : (
                <p className="text-sm text-gray-600">{review.supervisorComment ?? '—'}</p>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">等第</label>
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
                    <p className="mt-1 text-xs text-green-700">⚠ O（傑出）等第為極少數頂尖員工，請謹慎評定。</p>
                  )}
                  {grade === 'U' && (
                    <p className="mt-1 text-xs text-red-600">⚠ U（未達標）將進入 PMD 追蹤，請確認績效佐證資料充足。</p>
                  )}
                </>
              ) : (
                <p className={`text-lg font-bold ${review.grade ? 'text-gray-900' : 'text-gray-400'}`}>
                  {review.grade ? `${GRADE_DISPLAY[review.grade]} · ${GRADE_SCALE.find(s => s.grade === review.grade)?.label}` : '—'}
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
                {saving ? '儲存中...' : '儲存草稿'}
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!grade}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                送出評核
              </button>
              {!grade && (
                <p className="text-xs text-gray-400">請先選擇等第才能送出</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Confirm dialog ── */}
      <ConfirmDialog
        open={showConfirm}
        title={canEmployeeEdit ? '確認送出自評？' : '確認送出評核？'}
        description={
          canEmployeeEdit
            ? '送出後將無法修改，確定要送出自評嗎？'
            : '送出後將無法修改，確定要送出評核嗎？'
        }
        confirmLabel={submitting ? '送出中...' : '確認送出'}
        onConfirm={canEmployeeEdit ? handleSubmitEmployee : handleSubmitSupervisor}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
