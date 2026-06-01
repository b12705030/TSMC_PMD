'use client'

import { use, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loading } from '@/components/Loading'
import { ErrorBanner } from '@/components/ErrorBanner'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { api } from '@/lib/api'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { useTemplates, type AddQuestionPayload } from '@/modules/templates/hooks/useTemplates'
import type { ReviewTemplate, TemplateQuestion } from '@/types'

const QUESTION_TYPES = ['Text', 'Rating', 'MultipleChoice'] as const

export default function TemplateDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params)
  const t = useTranslations('templates')
  const tCommon = useTranslations('common')
  const { user } = useAuth()
  const { addCustomQuestion, deleteCustomQuestion } = useTemplates()

  const [template, setTemplate] = useState<ReviewTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [newQuestion, setNewQuestion] = useState<AddQuestionPayload>({
    questionText: '', questionType: 'Text', required: true, options: [],
  })
  const [optionInputs, setOptionInputs] = useState<string[]>(['', ''])

  useEffect(() => {
    api.get<ReviewTemplate>(`/templates/${id}`)
      .then(setTemplate)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('detail.errorFailed'))
      })
      .finally(() => setIsLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isManager = user?.role === 'Manager'

  async function handleAddQuestion(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!newQuestion.questionText.trim()) { setError(t('detail.errorEmpty')); return }
    if (newQuestion.questionType === 'MultipleChoice') {
      const validOpts = optionInputs.filter((o) => o.trim())
      if (validOpts.length < 2) { setError(t('detail.errorMinOptions')); return }
    }
    setError('')
    setSubmitting(true)
    try {
      const payload: AddQuestionPayload = {
        ...newQuestion,
        options: newQuestion.questionType === 'MultipleChoice'
          ? optionInputs.filter((o) => o.trim())
          : [],
      }
      const q = await addCustomQuestion(id, payload)
      setTemplate((prev) => prev ? { ...prev, questions: [...prev.questions, q] } : prev)
      setShowAddModal(false)
      setNewQuestion({ questionText: '', questionType: 'Text', required: true, options: [] })
      setOptionInputs(['', ''])
    } catch {
      setError(t('detail.errorFailed'))
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

  if (isLoading) return <Loading />
  if (error)     return <ErrorBanner message={error} />
  if (!template) return <p className="text-error p-6">{t('detail.notFound')}</p>

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
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>{t('detail.addBtn')}</button>
            )}
          </div>
        }
      />

      {/* Base questions (HR) */}
      <section className="mb-6">
        <h2 className="section-heading flex items-center gap-2">
          {t('detail.baseSection')}
          <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{t('detail.baseBadge')}</span>
        </h2>
        <div className="space-y-2">
          {baseQuestions.map((q, i) => (
            <QuestionRow key={q.id} question={q} index={i} canDelete={false} />
          ))}
          {baseQuestions.length === 0 && <p className="text-muted">{t('detail.baseEmpty')}</p>}
        </div>
      </section>

      {/* Custom questions (Manager) */}
      <section>
        <h2 className="section-heading flex items-center gap-2">
          {t('detail.customSection')}
          <span className="text-xs font-normal text-gray-400 bg-blue-50 px-2 py-0.5 rounded">{t('detail.customBadge')}</span>
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
              {isManager ? t('detail.customEmptyManager') : t('detail.customEmpty')}
            </p>
          )}
        </div>
      </section>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        title={t('detail.deleteConfirmTitle')}
        description={t('detail.deleteConfirmDesc')}
        confirmLabel={t('detail.deleteBtn')}
        danger
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* Add question modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('detail.modalTitle')}</h2>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="label">{t('detail.qLabel')}</label>
                <input
                  className="input"
                  required
                  value={newQuestion.questionText}
                  onChange={(e) => setNewQuestion((p) => ({ ...p, questionText: e.target.value }))}
                  placeholder={t('detail.qPlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('detail.typeLabel')}</label>
                <select
                  className="input"
                  value={newQuestion.questionType}
                  onChange={(e) => {
                    const qt = e.target.value as AddQuestionPayload['questionType']
                    setNewQuestion((p) => ({ ...p, questionType: qt }))
                    if (qt === 'MultipleChoice') setOptionInputs(['', ''])
                  }}
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`questionType.${type}`)}</option>
                  ))}
                </select>
              </div>

              {newQuestion.questionType === 'MultipleChoice' && (
                <div>
                  <label className="label">{t('detail.optionsLabel')}</label>
                  <div className="space-y-2">
                    {optionInputs.map((opt, i) => (
                      <div key={`opt-${opt}-${i}`} className="flex gap-2">
                        <input
                          className="input flex-1"
                          value={opt}
                          onChange={(e) => {
                            const updated = [...optionInputs]
                            updated[i] = e.target.value
                            setOptionInputs(updated)
                          }}
                          placeholder={t('detail.optionPlaceholder', { index: i + 1 })}
                        />
                        {optionInputs.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setOptionInputs(optionInputs.filter((_, j) => j !== i))}
                            className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOptionInputs([...optionInputs, ''])}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {t('detail.addOptionBtn')}
                    </button>
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newQuestion.required}
                  onChange={(e) => setNewQuestion((p) => ({ ...p, required: e.target.checked }))}
                />
                {t('detail.requiredLabel')}
              </label>
              {error && <p className="text-error">{error}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>{tCommon('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? t('detail.adding') : t('detail.addBtnSubmit')}
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
}: Readonly<{
  question: TemplateQuestion
  index: number
  canDelete: boolean
  onDelete?: () => void
}>) {
  const t = useTranslations('templates')

  return (
    <div className={['card-sm flex items-start gap-3', question.isCustom ? 'border-blue-100 bg-blue-50/30' : ''].join(' ')}>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
        {index + 1}
      </span>
      <div className="flex-1">
        <p className="text-sm text-gray-900">{question.questionText}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
          <span>{t(`questionType.${question.questionType}`)}</span>
          {question.required && <span className="text-red-400">{t('detail.requiredLabel')}</span>}
        </div>
      </div>
      {canDelete && (
        <button onClick={onDelete} className="text-gray-400 hover:text-red-500 text-sm">{t('detail.deleteBtn')}</button>
      )}
    </div>
  )
}
