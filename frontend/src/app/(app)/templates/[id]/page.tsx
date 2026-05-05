'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { api } from '@/lib/api'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { useTemplates, type AddQuestionPayload } from '@/modules/templates/hooks/useTemplates'
import type { ReviewTemplate, TemplateQuestion } from '@/types'

const QUESTION_TYPES = ['Text', 'Rating', 'MultipleChoice'] as const

const QUESTION_TYPE_LABEL: Record<string, string> = {
  Text:           '文字',
  Rating:         '評分（1–5）',
  MultipleChoice: '多選題',
}

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { addCustomQuestion, deleteCustomQuestion } = useTemplates()

  const [template, setTemplate] = useState<ReviewTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [newQuestion, setNewQuestion] = useState<AddQuestionPayload>({
    questionText: '', questionType: 'Text', required: true,
  })

  useEffect(() => {
    api.get<ReviewTemplate>(`/templates/${id}`)
      .then(setTemplate)
      .finally(() => setIsLoading(false))
  }, [id])

  const isManager = user?.role === 'Manager'
  const isHR      = user?.role === 'RegionalHR' || user?.role === 'Admin'

  async function handleAddQuestion(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!newQuestion.questionText.trim()) { setError('題目內容不得為空'); return }
    setError('')
    setSubmitting(true)
    try {
      const q = await addCustomQuestion(id, newQuestion)
      setTemplate((prev) => prev ? { ...prev, questions: [...prev.questions, q] } : prev)
      setShowAddModal(false)
      setNewQuestion({ questionText: '', questionType: 'Text', required: true })
    } catch {
      setError('新增失敗，請稍後再試。')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDeleteId) return
    try {
      await deleteCustomQuestion(id, pendingDeleteId)
      setTemplate((prev) => prev
        ? { ...prev, questions: prev.questions.filter((q) => q.id !== pendingDeleteId) }
        : prev
      )
    } finally {
      setPendingDeleteId(null)
    }
  }

  if (isLoading) return <p className="text-muted p-6">載入中...</p>
  if (!template)  return <p className="text-error p-6">找不到此模板。</p>

  const baseQuestions   = template.questions.filter((q) => !q.isCustom)
  const customQuestions = template.questions.filter((q) => q.isCustom)

  return (
    <div>
      <PageHeader
        title={template.name}
        description={`${template.appliesGrades.join(', ')} · ${template.applyTitles.join(', ')}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={template.status} />
            {isManager && template.status === 'Published' && (
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ 新增題目</button>
            )}
          </div>
        }
      />

      {/* Base questions (HR) */}
      <section className="mb-6">
        <h2 className="section-heading flex items-center gap-2">
          基礎題目
          <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">已鎖定 — 由 HR 設定</span>
        </h2>
        <div className="space-y-2">
          {baseQuestions.map((q, i) => (
            <QuestionRow key={q.id} question={q} index={i} canDelete={false} />
          ))}
          {baseQuestions.length === 0 && <p className="text-muted">尚無基礎題目。</p>}
        </div>
      </section>

      {/* Custom questions (Manager) */}
      <section>
        <h2 className="section-heading flex items-center gap-2">
          自訂題目
          <span className="text-xs font-normal text-gray-400 bg-blue-50 px-2 py-0.5 rounded">由主管新增</span>
        </h2>
        <div className="space-y-2">
          {customQuestions.map((q, i) => (
            <QuestionRow
              key={q.id}
              question={q}
              index={baseQuestions.length + i}
              canDelete={isManager}
              onDelete={() => setPendingDeleteId(q.id)}
            />
          ))}
          {customQuestions.length === 0 && (
            <p className="text-muted">
              {isManager ? '尚無自訂題目，請點上方按鈕新增。' : '尚無自訂題目。'}
            </p>
          )}
        </div>
      </section>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        title="確認刪除此題目？"
        description="此自訂題目將從模板中永久刪除，無法復原。"
        confirmLabel="刪除"
        danger
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* Add question modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">新增自訂題目</h2>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="label">題目</label>
                <input
                  className="input"
                  required
                  value={newQuestion.questionText}
                  onChange={(e) => setNewQuestion((p) => ({ ...p, questionText: e.target.value }))}
                  placeholder="請輸入題目內容"
                />
              </div>
              <div>
                <label className="label">題型</label>
                <select
                  className="input"
                  value={newQuestion.questionType}
                  onChange={(e) => setNewQuestion((p) => ({ ...p, questionType: e.target.value as AddQuestionPayload['questionType'] }))}
                >
                  {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newQuestion.required}
                  onChange={(e) => setNewQuestion((p) => ({ ...p, required: e.target.checked }))}
                />
                必填
              </label>
              {error && <p className="text-error">{error}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? '新增中...' : '新增題目'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionRow({
  question, index, canDelete, onDelete,
}: {
  question: TemplateQuestion
  index: number
  canDelete: boolean
  onDelete?: () => void
}) {
  return (
    <div className={['card-sm flex items-start gap-3', question.isCustom ? 'border-blue-100 bg-blue-50/30' : ''].join(' ')}>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
        {index + 1}
      </span>
      <div className="flex-1">
        <p className="text-sm text-gray-900">{question.questionText}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
          <span>{QUESTION_TYPE_LABEL[question.questionType]}</span>
          {question.required && <span className="text-red-400">必填</span>}
        </div>
      </div>
      {canDelete && (
        <button onClick={onDelete} className="text-gray-400 hover:text-red-500 text-sm">刪除</button>
      )}
    </div>
  )
}
