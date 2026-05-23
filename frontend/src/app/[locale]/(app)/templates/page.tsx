'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useTemplates, type CreateTemplatePayload } from '@/modules/templates/hooks/useTemplates'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { useCycles } from '@/modules/cycles/hooks/useCycles'
import { api } from '@/lib/api'
import type { ReviewTemplate } from '@/types'

const QUESTION_TYPES = ['Text', 'Rating', 'MultipleChoice'] as const
type QuestionType = typeof QUESTION_TYPES[number]
type QuestionDraft = { questionText: string; questionType: QuestionType; required: boolean; options: string[]; orderIndex: number }
const EMPTY_QUESTION: Omit<QuestionDraft, 'orderIndex'> = { questionText: '', questionType: 'Text', required: true, options: [] }

export default function TemplatesPage() {
  const { user } = useAuth()
  const { templates, isLoading, error: loadError, createTemplate, publishTemplate } = useTemplates()
  const { cycles } = useCycles()

  const [jobLevels, setJobLevels] = useState<string[]>([])
  const [jobTitles, setJobTitles] = useState<string[]>([])

  useEffect(() => {
    api.get<string[]>('/users/job-levels')
      .then(setJobLevels)
      .catch(() => setJobLevels(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']))
    api.get<string[]>('/users/job-titles')
      .then(setJobTitles)
      .catch(() => setJobTitles([]))
  }, [])

  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pendingPublishId, setPendingPublishId] = useState<string | null>(null)

  const [form, setForm] = useState<Omit<CreateTemplatePayload, 'questions'>>({
    name: '', cycleId: '', appliesGrades: [], applyTitles: [],
  })
  const [titleSearch, setTitleSearch] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ ...EMPTY_QUESTION, orderIndex: 0 }])

  const filteredTitles = jobTitles.filter((t) =>
    t.toLowerCase().includes(titleSearch.toLowerCase())
  )

  const isHR = user?.role === 'RegionalHR' || user?.role === 'Admin'

  function toggleGrade(level: string) {
    setForm((prev) => ({
      ...prev,
      appliesGrades: prev.appliesGrades.includes(level)
        ? prev.appliesGrades.filter((l) => l !== level)
        : [...prev.appliesGrades, level],
    }))
  }

  function toggleTitle(title: string) {
    setForm((prev) => ({
      ...prev,
      applyTitles: prev.applyTitles.includes(title)
        ? prev.applyTitles.filter((t) => t !== title)
        : [...prev.applyTitles, title],
    }))
  }

  function updateQuestion(index: number, field: string, value: unknown) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== index) return q
      const updated = { ...q, [field]: value }
      if (field === 'questionType') {
        updated.options = value === 'MultipleChoice' ? ['', ''] : []
      }
      return updated
    }))
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { ...EMPTY_QUESTION, orderIndex: prev.length }])
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, orderIndex: i })))
  }

  function resetModal() {
    setShowModal(false)
    setForm({ name: '', cycleId: '', appliesGrades: [], applyTitles: [] })
    setQuestions([{ ...EMPTY_QUESTION, orderIndex: 0 }])
    setTitleSearch('')
    setError('')
  }

  async function handlePublishConfirmed() {
    if (!pendingPublishId) return
    try {
      await publishTemplate(pendingPublishId)
    } catch (e) {
      alert(e instanceof Error ? e.message : '發布失敗')
    } finally {
      setPendingPublishId(null)
    }
  }

  const publishedCycles = cycles.filter((c) => c.status !== 'Completed')

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (form.appliesGrades.length === 0) { setError('請選擇至少一個職等'); return }
    if (form.applyTitles.length === 0)   { setError('請選擇至少一個職稱'); return }
    if (questions.some((q) => !q.questionText.trim())) { setError('題目內容不得為空'); return }
    if (questions.some((q) => q.questionType === 'MultipleChoice' && q.options.filter((o) => o.trim()).length < 2)) {
      setError('多選題至少需要 2 個有效選項'); return
    }
    setError('')
    setSubmitting(true)
    try {
      await createTemplate({ ...form, questions })
      resetModal()
    } catch {
      setError('建立失敗，請稍後再試。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="評核模板管理"
        description="依職等與職稱管理績效評核表單模板。"
        actions={isHR ? (
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ 新增模板</button>
        ) : undefined}
      />

      {isLoading ? (
        <p className="text-muted">載入中...</p>
      ) : loadError ? (
        <ErrorBanner message={loadError} />
      ) : templates.length === 0 ? (
        <EmptyState
          title="尚無評核模板"
          description="建立模板以統一績效評核標準。"
          action={isHR ? <button className="btn-primary" onClick={() => setShowModal(true)}>+ 新增模板</button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} onPublish={() => setPendingPublishId(t.id)} isHR={isHR} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingPublishId}
        title="確認發布此模板？"
        description="發布後，此模板將開放評核使用，HR 基礎題目將鎖定無法修改。"
        confirmLabel="發布"
        onConfirm={handlePublishConfirmed}
        onCancel={() => setPendingPublishId(null)}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">新增評核模板</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Basic info */}
              <div className="space-y-4">
                <div>
                  <label className="label">模板名稱</label>
                  <input
                    className="input"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="例：工程師 L2–L3 年度考核"
                  />
                </div>
                <div>
                  <label className="label">績效週期</label>
                  <select
                    className="input"
                    required
                    value={form.cycleId}
                    onChange={(e) => setForm((p) => ({ ...p, cycleId: e.target.value, regionId: undefined }))}
                  >
                    <option value="">— 選擇週期 —</option>
                    {publishedCycles.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Applies to Grade */}
                <div>
                  <label className="label">
                    適用職等
                    <span className="ml-1 text-xs font-normal text-gray-400">（多選）</span>
                  </label>
                  {jobLevels.length === 0 ? (
                    <p className="text-sm text-gray-400">載入中...</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                      {jobLevels.map((level) => (
                        <label
                          key={level}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors
                            ${form.appliesGrades.includes(level)
                              ? 'bg-indigo-100 text-indigo-700 font-medium'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={form.appliesGrades.includes(level)}
                            onChange={() => toggleGrade(level)}
                          />
                          {level}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Applies to Title */}
                <div>
                  <label className="label">
                    適用職稱
                    <span className="ml-1 text-xs font-normal text-gray-400">（多選）</span>
                  </label>
                  {jobTitles.length === 0 ? (
                    <p className="text-sm text-gray-400">載入中...</p>
                  ) : (
                    <>
                    <input
                      className="input mb-2"
                      placeholder="搜尋職稱..."
                      value={titleSearch}
                      onChange={(e) => setTitleSearch(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                      {filteredTitles.map((title) => (
                        <label
                          key={title}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors
                            ${form.applyTitles.includes(title)
                              ? 'bg-indigo-100 text-indigo-700 font-medium'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={form.applyTitles.includes(title)}
                            onChange={() => toggleTitle(title)}
                          />
                          {title}
                        </label>
                      ))}
                      {filteredTitles.length === 0 && (
                        <p className="text-sm text-gray-400 p-1">找不到符合的職稱</p>
                      )}
                    </div>
                    </>
                  )}
                </div>
              </div>

              {/* Questions */}
              <div>
                <p className="label mb-2">
                  基礎題目
                  <span className="text-xs font-normal text-gray-400">（發布後鎖定）</span>
                </p>
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <div key={i} className="card-sm flex gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          className="input"
                          required
                          value={q.questionText}
                          onChange={(e) => updateQuestion(i, 'questionText', e.target.value)}
                          placeholder={`Question ${i + 1}`}
                        />
                        <div className="flex gap-2">
                          <select
                            className="input w-40"
                            value={q.questionType}
                            onChange={(e) => updateQuestion(i, 'questionType', e.target.value)}
                          >
                            {QUESTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                          </select>
                          <label className="flex items-center gap-1.5 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={(e) => updateQuestion(i, 'required', e.target.checked)}
                            />
                            必填
                          </label>
                        </div>
                        {q.questionType === 'MultipleChoice' && (
                          <div className="space-y-1.5 rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-medium text-gray-500">選項（至少 2 個）</p>
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex gap-2">
                                <input
                                  className="input flex-1"
                                  value={opt}
                                  onChange={(e) => {
                                    const opts = [...q.options]
                                    opts[oi] = e.target.value
                                    updateQuestion(i, 'options', opts)
                                  }}
                                  placeholder={`選項 ${oi + 1}`}
                                />
                                {q.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => updateQuestion(i, 'options', q.options.filter((_, j) => j !== oi))}
                                    className="px-1 text-lg leading-none text-gray-400 hover:text-red-500"
                                  >×</button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateQuestion(i, 'options', [...q.options, ''])}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >+ 新增選項</button>
                          </div>
                        )}
                      </div>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(i)}
                          className="text-gray-400 hover:text-red-500 text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addQuestion} className="btn-link mt-2">
                  + 新增題目
                </button>
              </div>

              {error && <p className="text-error">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={resetModal}>
                  取消
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? '建立中...' : '建立模板'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateRow({
  template,
  onPublish,
  isHR,
}: {
  template: ReviewTemplate
  onPublish: () => void
  isHR: boolean
}) {
  const baseCount   = template.questions.filter((q) => !q.isCustom).length
  const customCount = template.questions.filter((q) => q.isCustom).length

  const gradesLabel = (template.appliesGrades ?? []).join(', ') || '—'
  const titlesLabel = (template.applyTitles  ?? []).join(', ') || '—'

  return (
    <div className="card flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-gray-900">{template.name}</h3>
          <StatusBadge status={template.status} />
        </div>
        <p className="mt-0.5 text-sm text-gray-500">
          職等：{gradesLabel} · 職稱：{titlesLabel}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {baseCount} 題基礎題目
          {customCount > 0 && ` · ${customCount} 題自訂題目`}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isHR && template.status === 'Draft' && (
          <button className="btn-secondary text-xs" onClick={onPublish}>發布</button>
        )}
        <Link href={`/templates/${template.id}`} className="btn-link text-sm">
          查看 →
        </Link>
      </div>
    </div>
  )
}
