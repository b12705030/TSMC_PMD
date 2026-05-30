import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { ReviewGrade, ReviewStatus, Role } from '@prisma/client'
import { truncateAll, connectTestDb, prisma } from '../helpers/db'
import {
  createUser,
  createRegion,
  createDepartment,
  createCycle,
  createReview,
  createPublishedTemplateWithQuestion,
  toSessionUser,
} from '../helpers/seed'
import { createReviewsService, disconnectTestDb } from '../helpers/integration-setup'

describe('ReviewsService (integration)', () => {
  const reviews = createReviewsService()

  beforeAll(async () => {
    await connectTestDb()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  beforeEach(async () => {
    await truncateAll()
  })

  async function seedReviewFlow() {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const manager = await createUser(Role.Manager, region, dept)
    const supervisor = await createUser(Role.Supervisor, region, dept, { managerId: manager.id })
    const employee = await createUser(Role.Employee, region, dept, {
      supervisorId: supervisor.id,
      jobLevel:     'L2',
      jobTitle:     'Software Engineer',
    })
    const cycle = await createCycle(region)
    const template = await createPublishedTemplateWithQuestion(cycle, region, manager)
    const question = template.questions[0]!
    const review = await createReview(employee, cycle, template, {
      supervisorId: supervisor.id,
      status:       ReviewStatus.PendingSupervisorReview,
    })
    return { region, supervisor, employee, review, question }
  }

  it('submitSupervisor fails without grade', async () => {
    const { supervisor, review, question } = await seedReviewFlow()

    await prisma.performanceReview.update({
      where: { id: review.id },
      data: {
        supervisorAnswers: [{ questionId: question.id, answer: '4' }],
        grade:             null,
      },
    })

    await expect(
      reviews.submitSupervisor(review.id, toSessionUser(supervisor)),
    ).rejects.toThrow(BadRequestException)
  })

  it('submitSupervisor succeeds with grade and valid answers', async () => {
    const { supervisor, review, question } = await seedReviewFlow()

    await reviews.saveSupervisorReview(review.id, toSessionUser(supervisor), {
      answers: [{ questionId: question.id, answer: '4' }],
      grade:   ReviewGrade.S,
      comment: 'Good work',
    })

    const result = await reviews.submitSupervisor(review.id, toSessionUser(supervisor))
    expect(result.status).toBe(ReviewStatus.PendingManagerApproval)
  })

  it('employee cannot submit supervisor review', async () => {
    const { employee, review } = await seedReviewFlow()

    await expect(
      reviews.submitSupervisor(review.id, toSessionUser(employee)),
    ).rejects.toThrow(ForbiddenException)
  })
})
