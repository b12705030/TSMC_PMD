'use client'

import { use, useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useReview } from '@/modules/reviews/hooks/useReviews'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { PerformanceReviewDetail, TemplateQuestion, ReviewGrade } from '@/types'

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

// ─── Question renderer ────────────────────────────────────────────────────────

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
          <label key={opt} className={`flex cursor-pointer items-center gap-2.5 ${readonly ? 'cursor-default' : ''}`}>
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
  const { review, isLoading, refetch } = useReview(id)
  const { user } = useAuth()

  // Form state
  const [answers, setAnswers]       = useState<Record<string, string>>({})
  const [supAnswers, setSupAnswers]  = useState<Record<string, string>>({})
  const [comment, setComment]       = useState('')
  const [grade, setGrade]           = useState<ReviewGrade | ''>('')
  const [saving, setSaving]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Sync server state → local on load
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
  if (!review || !user) return <p className="text-error">找不到評核。</p>

  const questions = review.template.questions
  const isEmployee   = user.id === review.employeeId
  const isSupervisor = user.id === review.supervisorId
  const isManager    = user.role === 'Manager' || user.role === 'Admin'

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

  // ── Render ──

  const canEmployeeEdit   = isEmployee   && review.status === 'PendingEmployeeSubmit'
  const canSupervisorEdit = isSupervisor && review.status === 'PendingSupervisorReview'

  const showEmployeeSection = canEmployeeEdit ||
    (review.status !== 'PendingEmployeeSubmit' && review.employeeAnswers.length > 0)

  const showSupervisorSection = canSupervisorEdit || (
    review.status !== 'PendingEmployeeSubmit' &&
    review.status !== 'PendingSupervisorReview' &&
    (isSupervisor || isManager) &&
    (review.supervisorAnswers.length > 0 || !!review.supervisorComment || !!review.grade)
  )

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="績效評核"
        breadcrumbs={[{ label: '我的評核', href: '/reviews' }, { label: review.cycle.name }]}
        actions={<StatusBadge status={review.status} />}
      />

      {/* Meta */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4 text-sm">
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
                <span className="ml-1.5 text-gray-400 font-normal">{review.employee.jobTitle} · {review.employee.jobLevel}</span>
              </p>
            </div>
          )}
          {isEmployee && (
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">直屬主管</p>
              <p className="font-medium text-gray-800">{review.supervisor.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Published result ── */}
      {review.status === 'Published' && review.grade && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm font-semibold text-green-700 mb-1">評核結果已發布</p>
          <p className="text-4xl font-bold text-green-800 mb-2">{GRADE_DISPLAY[review.grade]}</p>
          {review.supervisorComment && (
            <p className="text-sm text-green-700 border-t border-green-200 pt-3 mt-3">
              <span className="font-medium">主管評語：</span>{review.supervisorComment}
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
          <div className="space-y-6">
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

      {/* ── Supervisor evaluation form ── */}
      {showSupervisorSection && (
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            主管評核
            {!canSupervisorEdit && (
              <span className="ml-2 text-xs font-normal text-gray-400">（已送出，不可修改）</span>
            )}
          </h2>

          {/* Supervisor question responses */}
          {questions.length > 0 && (
            <div className="mb-6 space-y-6">
              {questions.map((q) => {
                const supAns = review.supervisorAnswers.find((a) => a.questionId === q.id)?.answer ?? ''
                const empAns = review.employeeAnswers.find((a) => a.questionId === q.id)?.answer ?? ''
                return (
                  <div key={q.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="mb-3 text-sm font-medium text-gray-800">{q.questionText}</p>

                    {/* Employee answer (reference) */}
                    {empAns && (
                      <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="mb-1 text-xs font-medium text-gray-400">員工自評</p>
                        <QuestionField q={q} value={empAns} onChange={() => {}} readonly />
                      </div>
                    )}

                    {/* Supervisor answer */}
                    <div>
                      <p className="mb-1 text-xs font-medium text-gray-400">主管評分</p>
                      {canSupervisorEdit ? (
                        <QuestionField
                          q={q}
                          value={supAnswers[q.id] ?? ''}
                          onChange={(v) => setSupAnswers((prev) => ({ ...prev, [q.id]: v }))}
                        />
                      ) : (
                        <QuestionField q={q} value={supAns} onChange={() => {}} readonly />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Comment + Grade */}
          <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">評核說明</label>
              {canSupervisorEdit ? (
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="描述您的評核理由與員工表現..."
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              ) : (
                <p className="text-sm text-gray-600">{review.supervisorComment ?? '—'}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">等第</label>
              {canSupervisorEdit ? (
                <>
                  <div className="flex gap-1.5">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(g === grade ? '' : g)}
                        className={`h-9 min-w-[2.5rem] rounded-lg border-2 px-1 text-sm font-bold transition-colors ${
                          grade === g
                            ? GRADE_COLOR[g]
                            : 'border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {GRADE_DISPLAY[g]}
                      </button>
                    ))}
                  </div>
                  {grade === 'O' && (
                    <p className="mt-2 text-xs text-green-700">
                      ⚠ O（傑出）等第為極少數頂尖員工，請謹慎評定。
                    </p>
                  )}
                  {grade === 'U' && (
                    <p className="mt-2 text-xs text-red-600">
                      ⚠ U（未達標）將進入 PMD 追蹤，請確認績效佐證資料充足。
                    </p>
                  )}
                </>
              ) : (
                <p className={`text-lg font-bold ${review.grade ? 'text-gray-900' : 'text-gray-400'}`}>
                  {review.grade ? GRADE_DISPLAY[review.grade] : '—'}
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
