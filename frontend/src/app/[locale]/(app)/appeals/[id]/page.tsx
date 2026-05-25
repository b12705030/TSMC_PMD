'use client'

import { use, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useAppeal } from '@/modules/appeals/hooks/useAppeals'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { ReviewAnswer, TemplateQuestion } from '@/types'

const GRADES = ['O', 'S_Plus', 'S', 'S_Minus', 'I', 'U'] as const
const GRADE_DISPLAY: Record<string, string> = {
  O: 'O', S_Plus: 'S+', S: 'S', S_Minus: 'S-', I: 'I', U: 'U',
}
const GRADE_COLOR: Record<string, string> = {
  O: 'bg-green-100 text-green-800 ring-green-300',
  S_Plus: 'bg-indigo-100 text-indigo-800 ring-indigo-300',
  S: 'bg-indigo-100 text-indigo-700 ring-indigo-300',
  S_Minus: 'bg-indigo-50 text-indigo-600 ring-indigo-200',
  I: 'bg-amber-100 text-amber-800 ring-amber-300',
  U: 'bg-red-100 text-red-800 ring-red-300',
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function AnswerBlock({ questions, answers, borderColor, bgColor, textColor, label }: {
  questions: TemplateQuestion[]
  answers: ReviewAnswer[]
  borderColor: string
  bgColor: string
  textColor: string
  label: string
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 h-full`}>
      <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${textColor}`}>{label}</p>
      <div className="space-y-3">
        {questions.map((q) => {
          const ans = answers.find((a) => a.questionId === q.id)
          return (
            <div key={q.id}>
              <p className="text-xs font-medium text-gray-500 mb-0.5">{q.questionText}</p>
              <p className={`text-sm text-gray-800 whitespace-pre-wrap bg-white rounded-lg px-3 py-2 border ${borderColor}`}>
                {ans?.answer || <span className="text-gray-300 italic">未填寫</span>}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations('appeals')
  const tCommon = useTranslations('common')
  const { appeal, isLoading, refetch } = useAppeal(id)
  const { user } = useAuth()

  const [response, setResponse]     = useState('')
  const [newGrade, setNewGrade]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isLoading) return <p className="text-muted">{tCommon('loading')}</p>
  if (!appeal || !user) return <p className="text-error">{t('detail.notFound')}</p>

  const isManager  = user.id === appeal.managerId
  const isEmployee = user.id === appeal.employeeId
  const isPending  = appeal.status === 'Pending'
  const isHROrAdmin = ['Admin', 'GlobalHR', 'RegionalHR'].includes(user.role)

  const hasAnswers = (isManager || isHROrAdmin) && appeal.review?.template &&
    ((appeal.review.employeeAnswers?.length ?? 0) > 0 || (appeal.review.supervisorAnswers?.length ?? 0) > 0)

  async function handleRespond() {
    if (response.trim().length < 5) return
    setSubmitting(true)
    try {
      const body: Record<string, string> = { response: response.trim() }
      if (newGrade) body.newGrade = newGrade
      await api.patch(`/appeals/${id}/respond`, body)
      refetch()
      setResponse('')
      setNewGrade('')
    } catch {
      alert(t('detail.respondFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // 右側欄：meta + 申訴原因 + 回覆
  const rightPanel = (
    <div className="space-y-4">
      {/* Meta */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('detail.meta.employee')}</p>
            <p className="font-medium text-gray-800">{appeal.employee?.name}</p>
            <p className="text-xs text-gray-400">{appeal.employee?.jobTitle} · {appeal.employee?.jobLevel}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('detail.meta.cycle')}</p>
            <p className="font-medium text-gray-800">{appeal.review?.cycle.name ?? '—'}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('detail.meta.grade')}</p>
            <p className="text-2xl font-bold text-gray-800">
              {appeal.review?.grade ? GRADE_DISPLAY[appeal.review.grade] : '—'}
            </p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('detail.meta.submitted')}</p>
            <p className="font-medium text-gray-800">{fmt(appeal.createdAt)}</p>
          </div>
        </div>
        {appeal.review?.supervisorComment && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t('detail.supComment')}</p>
            <p className="text-sm text-gray-600">{appeal.review.supervisorComment}</p>
          </div>
        )}
      </div>

      {/* Appeal reason */}
      <div className="rounded-xl border border-red-100 bg-red-50 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-400">{t('detail.reason')}</p>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{appeal.reason}</p>
      </div>

      {/* Manager response (resolved) */}
      {appeal.status === 'Resolved' && appeal.managerResponse && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-400">
            {t('detail.response.title', { date: appeal.resolvedAt ? fmt(appeal.resolvedAt) : '' })}
          </p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{appeal.managerResponse}</p>
        </div>
      )}

      {/* Manager response form */}
      {isManager && isPending && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-800">{t('detail.response.formTitle')}</p>
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-gray-700">
              {t('detail.response.gradeLabel')}
              <span className="ml-1.5 font-normal text-gray-400">
                {t('detail.response.gradeDetail', { grade: appeal.review?.grade ? GRADE_DISPLAY[appeal.review.grade] : '—' })}
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setNewGrade(newGrade === g ? '' : g)}
                  className={`rounded-lg px-3 py-1 text-sm font-bold ring-1 ring-inset transition-all ${
                    newGrade === g ? GRADE_COLOR[g] : 'bg-gray-50 text-gray-400 ring-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {GRADE_DISPLAY[g]}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={4}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder={t('detail.response.textPlaceholder')}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
          />
          <p className="mt-1 mb-3 text-xs text-gray-400">{t('detail.response.note')}</p>
          <button
            onClick={handleRespond}
            disabled={submitting || response.trim().length < 5}
            className="w-full rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? t('detail.response.submitting') : t('detail.response.submitBtn')}
          </button>
        </div>
      )}

      {/* Employee: back to review */}
      {isEmployee && appeal.status === 'Resolved' && (
        <Link href={`/reviews/${appeal.reviewId}`} className="btn-secondary text-sm block text-center">
          {t('detail.backToReview')}
        </Link>
      )}
    </div>
  )

  return (
    <div>
      <PageHeader
        title={t('detail.pageTitle')}
        breadcrumbs={[
          {
            label: isManager ? t('detail.breadcrumbManager') : t('detail.breadcrumbEmployee'),
            href:  isManager ? '/appeals' : '/reviews',
          },
          { label: t('detail.breadcrumb') },
        ]}
        actions={<StatusBadge status={appeal.status} />}
      />

      {hasAnswers ? (
        /* 2欄布局：左欄 meta + 申訴 + 回覆，右欄自評 + 主管評核直排 */
        <div className="grid grid-cols-5 gap-5 items-start">
          {/* 左欄：meta + 申訴 + 回覆 */}
          <div className="col-span-2">
            {rightPanel}
          </div>

          {/* 右欄：自評在上，主管評核在下 */}
          <div className="col-span-3 space-y-4">
            {appeal.review!.employeeAnswers && appeal.review!.employeeAnswers.length > 0 && (
              <AnswerBlock
                questions={appeal.review!.template!.questions}
                answers={appeal.review!.employeeAnswers}
                label="員工自評內容"
                borderColor="border-indigo-100"
                bgColor="bg-indigo-50/40"
                textColor="text-indigo-400"
              />
            )}
            {appeal.review!.supervisorAnswers && appeal.review!.supervisorAnswers.length > 0 && (
              <AnswerBlock
                questions={appeal.review!.template!.questions}
                answers={appeal.review!.supervisorAnswers}
                label="主管評核內容"
                borderColor="border-purple-100"
                bgColor="bg-purple-50/40"
                textColor="text-purple-400"
              />
            )}
          </div>
        </div>
      ) : (
        /* 無自評資料：原本的單欄窄版 */
        <div className="max-w-2xl">
          {rightPanel}
        </div>
      )}
    </div>
  )
}
