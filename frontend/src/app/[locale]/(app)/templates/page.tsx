'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
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
  const t = useTranslations('templates')
  const tCommon = useTranslations('common')
  const { user } = useAuth()
  const { templates, isLoading, error: loadError, createTemplate, publishTemplate } = useTemplates()
  const { cycles } = useCycles()

  const [jobLevels, setJobLevels] = useState<string[]>([])
  const [groupedTitles, setGroupedTitles] = useState<{ management: string[]; staff: string[] }>({ management: [], staff: [] })

  useEffect(() => {
    api.get<string[]>('/users/job-levels')
      .then(setJobLevels)
      .catch(() => setJobLevels(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']))
    api.get<{ management: string[]; staff: string[] }>('/users/job-titles-grouped')
      .then(setGroupedTitles)
      .catch(() => setGroupedTitles({ management: [], staff: [] }))
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

  const allTitles = [...groupedTitles.management, ...groupedTitles.staff]
  const totalCount = allTitles.length

  function filterGroup(titles: string[]) {
    if (!titleSearch.trim()) return titles
    return titles.filter((t) => t.toLowerCase().includes(titleSearch.toLowerCase()))
  }

  function toggleGroup(titles: string[]) {
    const allSelected = titles.every((t) => form.applyTitles.includes(t))
    if (allSelected) {
      setForm((prev) => ({ ...prev, applyTitles: prev.applyTitles.filter((t) => !titles.includes(t)) }))
    } else {
      setForm((prev) => ({ ...prev, applyTitles: [...new Set([...prev.applyTitles, ...titles])] }))
    }
  }

  const isHR = user?.role === 'RegionalHR' || user?.role === 'Admin' || user?.role === 'GlobalHR'

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
      alert(e instanceof Error ? e.message : t('errors.publishFailed'))
    } finally {
      setPendingPublishId(null)
    }
  }

  const publishedCycles = cycles.filter((c) => c.status !== 'Completed')

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (form.appliesGrades.length === 0) { setError(t('errors.noGrade')); return }
    if (form.applyTitles.length === 0)   { setError(t('errors.noTitle')); return }
    if (questions.some((q) => !q.questionText.trim())) { setError(t('errors.emptyQuestion')); return }
    if (questions.some((q) => q.questionType === 'MultipleChoice' && q.options.filter((o) => o.trim()).length < 2)) {
      setError(t('errors.minOptions')); return
    }
    setError('')
    setSubmitting(true)
    try {
      await createTemplate({ ...form, questions })
      resetModal()
    } catch {
      setError(t('errors.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDesc')}
        actions={isHR ? (
          <button className="btn-primary" onClick={() => setShowModal(true)}>{t('addBtn')}</button>
        ) : undefined}
      />

      {(() => {
        if (isLoading) return <Loading />
        if (loadError) return <ErrorBanner message={loadError} />
        if (templates.length === 0) return (
          <EmptyState
            title={t('empty.title')}
            description={t('empty.desc')}
            action={isHR ? <button className="btn-primary" onClick={() => setShowModal(true)}>{t('empty.btn')}</button> : undefined}
          />
        )
        return (
          <div className="space-y-3">
            {templates.map((tmpl) => (
              <TemplateRow key={tmpl.id} template={tmpl} onPublish={() => setPendingPublishId(tmpl.id)} isHR={isHR} />
            ))}
          </div>
        )
      })()}

      <ConfirmDialog
        open={!!pendingPublishId}
        title={t('publishConfirm.title')}
        description={t('publishConfirm.desc')}
        confirmLabel={t('publishConfirm.btn')}
        onConfirm={handlePublishConfirmed}
        onCancel={() => setPendingPublishId(null)}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">{t('modal.title')}</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="label">{t('modal.name')}</label>
                  <input
                    className="input"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder={t('modal.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="label">{t('modal.cycle')}</label>
                  <select
                    className="input"
                    required
                    value={form.cycleId}
                    onChange={(e) => setForm((p) => ({ ...p, cycleId: e.target.value, regionId: undefined }))}
                  >
                    <option value="">{t('modal.cycleDefault')}</option>
                    {publishedCycles.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">
                    {t('modal.grades')}
                    <span className="ml-1 text-xs font-normal text-gray-400">{t('modal.gradesMulti')}</span>
                  </label>
                  {jobLevels.length === 0 ? (
                    <Loading className="py-4" />
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

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="label mb-0">
                      {t('modal.titles')}
                      <span className="ml-1 text-xs font-normal text-gray-400">{t('modal.titlesMulti')}</span>
                    </label>
                    {totalCount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">已選 {form.applyTitles.length} / {totalCount}</span>
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:underline"
                          onClick={() => setForm((prev) => ({ ...prev, applyTitles: allTitles }))}
                        >全選</button>
                        {form.applyTitles.length > 0 && (
                          <button
                            type="button"
                            className="text-xs text-gray-400 hover:underline"
                            onClick={() => setForm((prev) => ({ ...prev, applyTitles: [] }))}
                          >清除</button>
                        )}
                      </div>
                    )}
                  </div>
                  {totalCount === 0 ? (
                    <Loading className="py-4" />
                  ) : (
                    <>
                      <input
                        className="input mb-3"
                        placeholder={t('modal.titleSearch')}
                        value={titleSearch}
                        onChange={(e) => setTitleSearch(e.target.value)}
                      />
                      <div className="space-y-3">
                        {/* 管理職群 */}
                        {filterGroup(groupedTitles.management).length > 0 && (
                          <div>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">主管 / 管理職</span>
                              <button
                                type="button"
                                className="text-[11px] text-indigo-500 hover:underline"
                                onClick={() => toggleGroup(groupedTitles.management)}
                              >
                                {groupedTitles.management.every((t) => form.applyTitles.includes(t)) ? '取消全選' : '全選此群'}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
                              {filterGroup(groupedTitles.management).map((title) => (
                                <label
                                  key={title}
                                  className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors
                                    ${form.applyTitles.includes(title)
                                      ? 'bg-indigo-500 text-white font-medium'
                                      : 'bg-white text-gray-600 hover:bg-indigo-50 border border-indigo-200'
                                    }`}
                                >
                                  <input type="checkbox" className="hidden" checked={form.applyTitles.includes(title)} onChange={() => toggleTitle(title)} />
                                  {title}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* 一般員工群 */}
                        {filterGroup(groupedTitles.staff).length > 0 && (
                          <div>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">工程師 / 員工</span>
                              <button
                                type="button"
                                className="text-[11px] text-indigo-500 hover:underline"
                                onClick={() => toggleGroup(groupedTitles.staff)}
                              >
                                {groupedTitles.staff.every((t) => form.applyTitles.includes(t)) ? '取消全選' : '全選此群'}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                              {filterGroup(groupedTitles.staff).map((title) => (
                                <label
                                  key={title}
                                  className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors
                                    ${form.applyTitles.includes(title)
                                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                    }`}
                                >
                                  <input type="checkbox" className="hidden" checked={form.applyTitles.includes(title)} onChange={() => toggleTitle(title)} />
                                  {title}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {filterGroup(groupedTitles.management).length === 0 && filterGroup(groupedTitles.staff).length === 0 && (
                          <p className="text-sm text-gray-400 p-1">{t('modal.noTitles')}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <p className="label mb-2">
                  {t('modal.questions')}
                  <span className="text-xs font-normal text-gray-400">{t('modal.questionsLocked')}</span>
                </p>
                <div className="space-y-3">
                  {questions.map((q, i) => {
                    function updateOption(oi: number, value: string) {
                      const opts = [...q.options]
                      opts[oi] = value
                      updateQuestion(i, 'options', opts)
                    }
                    function removeOption(oi: number) {
                      updateQuestion(i, 'options', q.options.filter((_, j) => j !== oi))
                    }
                    return (
                    <div key={q.orderIndex} className="card-sm flex gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          className="input"
                          required
                          value={q.questionText}
                          onChange={(e) => updateQuestion(i, 'questionText', e.target.value)}
                          placeholder={t('modal.questionPlaceholder', { index: i + 1 })}
                        />
                        <div className="flex gap-2">
                          <select
                            className="input w-40"
                            value={q.questionType}
                            onChange={(e) => updateQuestion(i, 'questionType', e.target.value)}
                          >
                            {QUESTION_TYPES.map((type) => (
                              <option key={type} value={type}>{t(`questionType.${type}`)}</option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1.5 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={(e) => updateQuestion(i, 'required', e.target.checked)}
                            />
                            {t('modal.required')}
                          </label>
                        </div>
                        {q.questionType === 'MultipleChoice' && (
                          <div className="space-y-1.5 rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-medium text-gray-500">{t('modal.options')}</p>
                            {q.options.map((opt, oi) => (
                              <div key={`${q.orderIndex}-opt-${oi}`} className="flex gap-2">
                                <input
                                  className="input flex-1"
                                  value={opt}
                                  onChange={(e) => updateOption(oi, e.target.value)}
                                  placeholder={t('modal.optionPlaceholder', { index: oi + 1 })}
                                />
                                {q.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => removeOption(oi)}
                                    className="px-1 text-lg leading-none text-gray-400 hover:text-red-500"
                                  >×</button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateQuestion(i, 'options', [...q.options, ''])}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >{t('modal.addOption')}</button>
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
                    )
                  })}
                </div>
                <button type="button" onClick={addQuestion} className="btn-link mt-2">
                  {t('modal.addQuestion')}
                </button>
              </div>

              {error && <p className="text-error">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={resetModal}>
                  {tCommon('cancel')}
                </button>
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

function TemplateRow({
  template,
  onPublish,
  isHR,
}: Readonly<{
  template: ReviewTemplate
  onPublish: () => void
  isHR: boolean
}>) {
  const t = useTranslations('templates')
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
          {t('card.grades', { value: gradesLabel })} · {t('card.titles', { value: titlesLabel })}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {t('card.baseQ', { count: baseCount })}
          {customCount > 0 && ` ${t('card.customQ', { count: customCount })}`}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isHR && template.status === 'Draft' && (
          <button className="btn-secondary text-xs" onClick={onPublish}>{t('card.publishBtn')}</button>
        )}
        <Link href={`/templates/${template.id}`} className="btn-link text-sm">
          {t('card.viewBtn')}
        </Link>
      </div>
    </div>
  )
}
