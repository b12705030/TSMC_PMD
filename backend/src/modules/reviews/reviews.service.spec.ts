import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ReviewStatus } from '@prisma/client'
import { ReviewsService } from './reviews.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockPrisma = {
  performanceReview: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}

const mockNotifications = {
  createForUsers: jest.fn().mockResolvedValue(undefined),
}

function user(role: Role, overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id:           'user-1',
    employeeId:   'emp001',
    name:         'Ada',
    email:        'ada@test.local',
    role,
    regionId:     'region-1',
    region:       'Taiwan',
    departmentId: 'dept-1',
    department:   'Engineering',
    jobLevel:     'L2',
    jobTitle:     'Engineer',
    ...overrides,
  }
}

const question = { id: 'q-1', questionText: 'Q1', questionType: 'Text', required: true, options: [], scopeDepartmentId: null }

describe('ReviewsService', () => {
  let service: ReviewsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ReviewsService(mockPrisma as any, mockNotifications as any)
  })

  it('scopes team reviews for supervisors', async () => {
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([])

    await service.getTeamReviews(user(Role.Supervisor, { id: 'sup-1' }))

    expect(mockPrisma.performanceReview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { supervisorId: 'sup-1' },
    }))
  })

  it('scopes team reviews by region for RegionalHR', async () => {
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([])

    await service.getTeamReviews(user(Role.RegionalHR, { regionId: 'region-1' }))

    expect(mockPrisma.performanceReview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { employee: { regionId: 'region-1' } },
    }))
  })

  it('returns all team reviews for global roles', async () => {
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([])

    await service.getTeamReviews(user(Role.Admin))

    expect(mockPrisma.performanceReview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.any(Object),
      orderBy: { createdAt: 'desc' },
    }))
    expect(mockPrisma.performanceReview.findMany.mock.calls[0][0].where).toBeUndefined()
  })

  it('blocks employees from reading team reviews', async () => {
    await expect(service.getTeamReviews(user(Role.Employee))).rejects.toThrow(ForbiddenException)
  })

  it('scopes cycle reviews by region for RegionalHR', async () => {
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([])

    await service.getCycleReviews('cycle-1', user(Role.RegionalHR, { regionId: 'region-1' }))

    expect(mockPrisma.performanceReview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cycleId: 'cycle-1', employee: { regionId: 'region-1' } },
    }))
  })

  it('scopes cycle reviews to manager reporting chain', async () => {
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([])

    await service.getCycleReviews('cycle-1', user(Role.Manager, { id: 'mgr-1' }))

    expect(mockPrisma.performanceReview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        cycleId: 'cycle-1',
        OR: [
          { employee: { supervisor: { managerId: 'mgr-1' } } },
          { employee: { managerId: 'mgr-1', supervisorId: null } },
        ],
      },
    }))
  })

  it('saves employee answers only while pending employee submit', async () => {
    mockPrisma.performanceReview.findUnique.mockResolvedValueOnce({
      id: 'review-1', employeeId: 'emp-1', status: ReviewStatus.PendingEmployeeSubmit,
    })
    mockPrisma.performanceReview.update.mockResolvedValueOnce({ id: 'review-1' })

    await service.saveEmployeeAnswers('review-1', user(Role.Employee, { id: 'emp-1' }), {
      answers: [{ questionId: 'q-1', answer: 'Yes' }],
    })

    expect(mockPrisma.performanceReview.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { employeeAnswers: [{ questionId: 'q-1', answer: 'Yes' }] },
    }))
  })

  it('submits employee review and notifies supervisor', async () => {
    mockPrisma.performanceReview.findUnique.mockResolvedValueOnce({
      id: 'review-1',
      employeeId: 'emp-1',
      supervisorId: 'sup-1',
      status: ReviewStatus.PendingEmployeeSubmit,
      employeeAnswers: [{ questionId: 'q-1', answer: 'Done' }],
      template: { questions: [question] },
      employee: { departmentId: 'dept-1' },
      supervisor: null,
    })
    mockPrisma.performanceReview.update.mockResolvedValueOnce({ id: 'review-1', status: ReviewStatus.PendingSupervisorReview })

    const result = await service.submitEmployee('review-1', user(Role.Employee, { id: 'emp-1' }))

    expect(result.status).toBe(ReviewStatus.PendingSupervisorReview)
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['sup-1'], expect.objectContaining({ type: 'ReviewSubmitted' }))
  })

  it('requires a grade before supervisor submit', async () => {
    mockPrisma.performanceReview.findUnique.mockResolvedValueOnce({
      id: 'review-1',
      employeeId: 'emp-1',
      supervisorId: 'sup-1',
      status: ReviewStatus.PendingSupervisorReview,
      supervisorAnswers: [{ questionId: 'q-1', answer: 'Good' }],
      grade: null,
      template: { questions: [question] },
      employee: { managerId: 'mgr-1', departmentId: 'dept-1' },
      supervisor: null,
    })

    await expect(service.submitSupervisor('review-1', user(Role.Supervisor, { id: 'sup-1' })))
      .rejects.toThrow(BadRequestException)
  })

  it('moves supervisor submitted reviews to manager approval and emits the existing manager notification type', async () => {
    mockPrisma.performanceReview.findUnique.mockResolvedValueOnce({
      id: 'review-1',
      employeeId: 'emp-1',
      supervisorId: 'sup-1',
      status: ReviewStatus.PendingSupervisorReview,
      supervisorAnswers: [{ questionId: 'q-1', answer: 'Good' }],
      grade: 'S',
      template: { questions: [question] },
      employee: { managerId: 'mgr-1', departmentId: 'dept-1' },
      supervisor: null,
    })
    mockPrisma.performanceReview.update.mockResolvedValueOnce({ id: 'review-1', status: ReviewStatus.PendingManagerApproval })

    const result = await service.submitSupervisor('review-1', user(Role.Supervisor, { id: 'sup-1' }))

    expect(result.status).toBe(ReviewStatus.PendingManagerApproval)
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['mgr-1'], expect.objectContaining({ type: 'ReviewApproved' }))
  })

  it('calibrates pending manager approval reviews for the manager chain', async () => {
    mockPrisma.performanceReview.findUnique.mockResolvedValueOnce({
      id: 'review-1', employeeId: 'emp-1', supervisorId: 'sup-1', status: ReviewStatus.PendingManagerApproval,
    })
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'emp-1', regionId: 'region-1', managerId: null, supervisorId: 'sup-1', supervisor: { managerId: 'mgr-1' },
    })
    mockPrisma.performanceReview.update.mockResolvedValueOnce({ id: 'review-1', grade: 'S_Plus', rank: 1 })

    const result = await service.calibrate('review-1', user(Role.Manager, { id: 'mgr-1' }), { grade: 'S_Plus', rank: 1 })

    expect(result.grade).toBe('S_Plus')
    expect(mockPrisma.performanceReview.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { grade: 'S_Plus', rank: 1 },
    }))
  })

  it('returns employee reviews for direct manager reports', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'emp-1',
      regionId: 'region-1',
      managerId: 'mgr-1',
      supervisorId: null,
      supervisor: null,
    })
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([{
      id: 'review-1',
      template: { questions: [question] },
      employee: { departmentId: 'dept-1' },
      supervisor: null,
    }])

    const result = await service.getReviewsByEmployee('emp-1', user(Role.Manager, { id: 'mgr-1' }))

    expect(result).toHaveLength(1)
    expect(mockPrisma.performanceReview.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { employeeId: 'emp-1' },
    }))
  })

  it('blocks supervisors from reading non-direct employee reviews', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'emp-1',
      regionId: 'region-1',
      supervisorId: 'other-sup',
      managerId: null,
      supervisor: null,
    })

    await expect(service.getReviewsByEmployee('emp-1', user(Role.Supervisor, { id: 'sup-1' })))
      .rejects.toThrow(ForbiddenException)
  })

  it('publishes graded reviews and notifies employees', async () => {
    mockPrisma.performanceReview.findMany
      .mockResolvedValueOnce([{ id: 'review-1', grade: 'S' }])
      .mockResolvedValueOnce([{ employeeId: 'emp-1' }])
    mockPrisma.performanceReview.updateMany.mockResolvedValueOnce({ count: 1 })

    await service.publishAll('cycle-1', user(Role.Manager, { id: 'mgr-1' }))

    expect(mockPrisma.performanceReview.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['review-1'] } },
      data:  { status: ReviewStatus.Published, publishedAt: expect.any(Date) },
    })
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['emp-1'], expect.objectContaining({
      type: 'ReviewPublished',
    }))
  })

  it('refuses to publish when pending reviews are missing grades', async () => {
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([{ id: 'review-1', grade: null }])

    await expect(service.publishAll('cycle-1', user(Role.Manager, { id: 'mgr-1' })))
      .rejects.toThrow(BadRequestException)
  })

  it('counts appealed reviews as published for supervisors', async () => {
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([
      { status: ReviewStatus.Appealed, grade: 'S' },
      { status: ReviewStatus.PendingSupervisorReview, grade: null },
    ])

    const result = await service.getReviewStats(user(Role.Supervisor, { id: 'sup-1' }))

    expect(result.total).toBe(2)
    expect(result.statusCount[ReviewStatus.Published]).toBe(1)
    expect(result.gradeDistribution.S).toBe(1)
  })

  it('throws not found when a review is missing', async () => {
    mockPrisma.performanceReview.findUnique.mockResolvedValueOnce(null)

    await expect(service.getReview('missing', user(Role.Admin))).rejects.toThrow(NotFoundException)
  })
})
