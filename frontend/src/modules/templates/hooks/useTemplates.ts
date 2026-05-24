'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ReviewTemplate, TemplateQuestion } from '@/types'

export interface CreateTemplatePayload {
  name: string
  cycleId: string
  appliesGrades: string[]
  applyTitles: string[]
  questions: {
    questionText: string
    questionType: 'Text' | 'Rating' | 'MultipleChoice'
    options?: string[]
    required: boolean
    orderIndex: number
  }[]
}

export interface AddQuestionPayload {
  questionText: string
  questionType: 'Text' | 'Rating' | 'MultipleChoice'
  options?: string[]
  required: boolean
}

export function useTemplates() {
  const [templates, setTemplates] = useState<ReviewTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<ReviewTemplate[]>('/templates')
      .then((data) => { setTemplates(data); setError(null) })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '載入失敗'))
      .finally(() => setIsLoading(false))
  }, [])

  async function createTemplate(payload: CreateTemplatePayload): Promise<ReviewTemplate> {
    const created = await api.post<ReviewTemplate>('/templates', payload)
    setTemplates((prev) => [created, ...prev])
    return created
  }

  async function publishTemplate(id: string): Promise<void> {
    const updated = await api.patch<ReviewTemplate>(`/templates/${id}/publish`, {})
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  async function addCustomQuestion(templateId: string, payload: AddQuestionPayload): Promise<TemplateQuestion> {
    const question = await api.post<TemplateQuestion>(`/templates/${templateId}/questions`, payload)
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId ? { ...t, questions: [...t.questions, question] } : t
      )
    )
    return question
  }

  async function deleteCustomQuestion(templateId: string, questionId: string): Promise<void> {
    await api.delete(`/templates/${templateId}/questions/${questionId}`)
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? { ...t, questions: t.questions.filter((q) => q.id !== questionId) }
          : t
      )
    )
  }

  return { templates, isLoading, error, createTemplate, publishTemplate, addCustomQuestion, deleteCustomQuestion }
}
