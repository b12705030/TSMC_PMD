'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useAppeal } from '@/modules/appeals/hooks/useAppeals'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'

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
  return new Date(date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { appeal, isLoading, refetch } = useAppeal(id)
  const { user } = useAuth()

  const [response, setResponse]       = useState('')
  const [newGrade, setNewGrade]       = useState('')
  const [submitting, setSubmitting]   = useState(false)

  if (isLoading) return <p className="text-muted">載入中...</p>
  if (!appeal || !user) return <p className="text-error">找不到申訴或無權限查看。</p>

  const isManager  = user.id === appeal.managerId
  const isEmployee = user.id === appeal.employeeId
  const isPending  = appeal.status === 'Pending'

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
      alert('回覆失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="申訴詳情"
        breadcrumbs={[
          { label: isManager ? '申訴管理' : '我的評核', href: isManager ? '/appeals' : '/reviews' },
          { label: '申訴詳情' },
        ]}
        actions={<StatusBadge status={appeal.status} />}
      />

      {/* Meta */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">員工</p>
            <p className="font-medium text-gray-800">
              {appeal.employee?.name}
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                {appeal.employee?.jobTitle} · {appeal.employee?.jobLevel}
              </span>
            </p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">週期</p>
            <p className="font-medium text-gray-800">{appeal.review?.cycle.name ?? '—'}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">評核等第</p>
            <p className="text-xl font-bold text-gray-800">
              {appeal.review?.grade ? GRADE_DISPLAY[appeal.review.grade] : '—'}
            </p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">提交時間</p>
            <p className="font-medium text-gray-800">{fmt(appeal.createdAt)}</p>
          </div>
        </div>
        {appeal.review?.supervisorComment && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">主管評語</p>
            <p className="text-sm text-gray-600">{appeal.review.supervisorComment}</p>
          </div>
        )}
      </div>

      {/* 員工申訴原因 */}
      <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-400">員工申訴原因</p>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{appeal.reason}</p>
      </div>

      {/* 經理回覆區 */}
      {appeal.status === 'Resolved' && appeal.managerResponse && (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-400">
            經理回覆 · {appeal.resolvedAt ? fmt(appeal.resolvedAt) : ''}
          </p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{appeal.managerResponse}</p>
        </div>
      )}

      {/* Manager 回覆表單（申訴待處理時顯示） */}
      {isManager && isPending && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-800">回覆申訴</p>

          {/* 調整等第（選填） */}
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-medium text-gray-700">
              調整等第
              <span className="ml-1.5 font-normal text-gray-400">（選填，不選則維持原等第 {appeal.review?.grade ? GRADE_DISPLAY[appeal.review.grade] : '—'}）</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setNewGrade(newGrade === g ? '' : g)}
                  className={`rounded-lg px-3 py-1 text-sm font-bold ring-1 ring-inset transition-all ${
                    newGrade === g
                      ? GRADE_COLOR[g]
                      : 'bg-gray-50 text-gray-400 ring-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {GRADE_DISPLAY[g]}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={5}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="說明您的決定與理由（至少 5 字）..."
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
          />
          <p className="mt-1.5 mb-4 text-xs text-gray-400">
            回覆後申訴將標記為「已解決」，評核恢復為「已發布」，員工可在評核頁看到您的回覆。
          </p>
          <button
            onClick={handleRespond}
            disabled={submitting || response.trim().length < 5}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? '送出中...' : '送出回覆並解決申訴'}
          </button>
        </div>
      )}

      {/* 員工：申訴已解決，引導回評核頁 */}
      {isEmployee && appeal.status === 'Resolved' && (
        <Link href={`/reviews/${appeal.reviewId}`} className="btn-secondary text-sm">
          ← 返回評核頁
        </Link>
      )}
    </div>
  )
}
