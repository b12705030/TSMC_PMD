import { BadRequestException } from '@nestjs/common'
import { QuestionType, type TemplateQuestion } from '@prisma/client'

export function validateReviewAnswers(
  answers: { questionId: string; answer: string }[] | null,
  questions: TemplateQuestion[],
): void {
  const answersMap = new Map((answers ?? []).map((a) => [a.questionId, a.answer]))
  const validIds = new Set(questions.map((q) => q.id))

  for (const qid of answersMap.keys()) {
    if (!validIds.has(qid)) {
      throw new BadRequestException(`Invalid questionId: ${qid}`)
    }
  }

  const missing = questions.filter((q) => q.required && !answersMap.get(q.id)?.trim())
  if (missing.length > 0) {
    throw new BadRequestException(
      `以下必填題尚未回答：${missing.map((q) => q.questionText).join('、')}`,
    )
  }

  for (const q of questions) {
    const raw = answersMap.get(q.id)
    if (!raw?.trim()) continue

    if (q.questionType === QuestionType.Rating) {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new BadRequestException(`「${q.questionText}」評分必須為 1–5 的整數`)
      }
    }

    if (q.questionType === QuestionType.MultipleChoice) {
      if (!q.options.includes(raw)) {
        throw new BadRequestException(`「${q.questionText}」的答案不在可選範圍內`)
      }
    }

    if (q.questionType === QuestionType.Text && raw.length > 5000) {
      throw new BadRequestException(`「${q.questionText}」回答不可超過 5000 字`)
    }
  }
}
