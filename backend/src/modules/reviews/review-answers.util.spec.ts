import { BadRequestException } from '@nestjs/common'
import { QuestionType, type TemplateQuestion } from '@prisma/client'
import { validateReviewAnswers } from './review-answers.util'

function question(
  overrides: Partial<TemplateQuestion> & Pick<TemplateQuestion, 'id' | 'questionType'>,
): TemplateQuestion {
  return {
    id: overrides.id,
    templateId: 'tpl-1',
    questionText: overrides.questionText ?? 'Question',
    questionType: overrides.questionType,
    required: overrides.required ?? true,
    options: overrides.options ?? [],
    orderIndex: overrides.orderIndex ?? 0,
    isCustom: false,
    isGlobal: false,
    scopeDepartmentId: null,
    createdAt: new Date(),
  } as TemplateQuestion
}

describe('validateReviewAnswers', () => {
  const ratingQ = question({ id: 'q-rating', questionType: QuestionType.Rating, questionText: 'Rating' })
  const mcQ = question({
    id: 'q-mc',
    questionType: QuestionType.MultipleChoice,
    questionText: 'MC',
    options: ['A', 'B'],
  })
  const textQ = question({ id: 'q-text', questionType: QuestionType.Text, questionText: 'Text' })

  it('accepts valid rating, multiple choice, and text answers', () => {
    expect(() =>
      validateReviewAnswers(
        [
          { questionId: 'q-rating', answer: '3' },
          { questionId: 'q-mc', answer: 'A' },
          { questionId: 'q-text', answer: 'ok' },
        ],
        [ratingQ, mcQ, textQ],
      ),
    ).not.toThrow()
  })

  it('rejects invalid rating values', () => {
    expect(() =>
      validateReviewAnswers([{ questionId: 'q-rating', answer: '6' }], [ratingQ]),
    ).toThrow(BadRequestException)
    expect(() =>
      validateReviewAnswers([{ questionId: 'q-rating', answer: '1.5' }], [ratingQ]),
    ).toThrow(BadRequestException)
  })

  it('rejects multiple choice answers outside options', () => {
    expect(() =>
      validateReviewAnswers([{ questionId: 'q-mc', answer: 'Z' }], [mcQ]),
    ).toThrow(BadRequestException)
  })

  it('rejects text longer than 5000 characters', () => {
    expect(() =>
      validateReviewAnswers([{ questionId: 'q-text', answer: 'x'.repeat(5001) }], [textQ]),
    ).toThrow(BadRequestException)
  })

  it('rejects missing required answers', () => {
    expect(() => validateReviewAnswers([], [ratingQ])).toThrow(/必填題/)
  })

  it('allows optional questions to be omitted', () => {
    const optional = question({
      id: 'q-opt',
      questionType: QuestionType.Text,
      required: false,
    })
    expect(() => validateReviewAnswers([], [optional])).not.toThrow()
  })
})
