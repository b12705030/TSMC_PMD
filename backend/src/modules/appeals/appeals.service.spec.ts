import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { AppealsService } from './appeals.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockPrisma = {
  performanceReview: {
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
  appeal: {
    findUnique: jest.fn(),
    findMany:   jest.fn(),
    count:      jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}

const mockNotifications = {
  createForUsers: jest.fn().mockResolvedValue(undefined),
}

function appealWithInclude(overrides: Record<string, unknown> = {}) {
  return {
    id:             'appeal-1',
    employeeId:     'emp-1',
    managerId:      'mgr-1',
    reviewId:       'review-1',
    status:         'Pending',
    seenByEmployee: false,
    employee:       { id: 'emp-1', name: 'Ada', employeeId: 'emp001', jobTitle: 'Engineer', jobLevel: 'L2' },
    manager:        { id: 'mgr-1', name: 'Grace' },
    review: {
      id: 'review-1',
      grade: 'S',
      supervisorComment: 'Solid work',
      employeeAnswers: [],
      supervisorAnswers: [],
      cycle: { id: 'cycle-1', name: '2026 Annual' },
      template: { id: 'tpl-1', name: 'Engineer Template', questions: [] },
    },
    ...overrides,
  }
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

describe('AppealsService', () => {
  let service: AppealsService

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    service = new AppealsService(mockPrisma as any, mockNotifications as any)
  })

  it('creates an appeal for the review owner and marks the review appealed', async () => {
    mockPrisma.performanceReview.findUnique.mockResolvedValueOnce({
      id: 'review-1', employeeId: 'emp-1', status: 'Published',
    })
    mockPrisma.appeal.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'emp-1', supervisor: { managerId: 'mgr-1' }, managerId: null })
    mockPrisma.appeal.create.mockResolvedValueOnce(appealWithInclude())
    mockPrisma.performanceReview.update.mockResolvedValueOnce({ id: 'review-1', status: 'Appealed' })

    const result = await service.createAppeal(user(Role.Employee, { id: 'emp-1' }), { reviewId: 'review-1', reason: 'Need review' })

    expect(result.id).toBe('appeal-1')
    expect(mockPrisma.performanceReview.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data:  { status: 'Appealed' },
    })
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['mgr-1'], expect.objectContaining({ type: 'AppealFiled' }))
  })

  it('rejects appeals for unpublished reviews', async () => {
    mockPrisma.performanceReview.findUnique.mockResolvedValueOnce({
      id: 'review-1', employeeId: 'emp-1', status: 'PendingManagerApproval',
    })

    await expect(service.createAppeal(user(Role.Employee, { id: 'emp-1' }), { reviewId: 'review-1', reason: 'Nope' }))
      .rejects.toThrow(BadRequestException)
  })

  it('scopes manager appeal listing to their own appeals', async () => {
    mockPrisma.appeal.findMany.mockResolvedValueOnce([])

    await service.getAppealsForManager(user(Role.Manager, { id: 'mgr-1' }))

    expect(mockPrisma.appeal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { managerId: 'mgr-1' },
    }))
  })

  it('lets RegionalHR read appeals only in their region', async () => {
    mockPrisma.appeal.findUnique.mockResolvedValueOnce(appealWithInclude())
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'emp-1', regionId: 'region-2' })

    await expect(service.getAppealById('appeal-1', user(Role.RegionalHR)))
      .rejects.toThrow(ForbiddenException)
  })

  it('marks resolved appeals as seen when the employee opens them', async () => {
    mockPrisma.appeal.findUnique.mockResolvedValueOnce(appealWithInclude())
    mockPrisma.appeal.update.mockResolvedValueOnce(appealWithInclude({ seenByEmployee: true }))

    const result = await service.getAppealById('appeal-1', user(Role.Employee, { id: 'emp-1' }))

    expect(result.id).toBe('appeal-1')
    expect(mockPrisma.appeal.update).toHaveBeenCalledWith({
      where: { id: 'appeal-1' },
      data:  { seenByEmployee: true },
    })
  })

  it('responds to an appeal, republishes the review, and notifies the employee', async () => {
    mockPrisma.appeal.findUnique.mockResolvedValueOnce(appealWithInclude())
    mockPrisma.appeal.update.mockResolvedValueOnce(appealWithInclude({ status: 'Resolved' }))
    mockPrisma.performanceReview.update.mockResolvedValueOnce({ id: 'review-1', status: 'Published', grade: 'S_Plus' })

    const result = await service.respondToAppeal('appeal-1', user(Role.Manager, { id: 'mgr-1' }), {
      response: 'Updated',
      newGrade: 'S_Plus',
    })

    expect(result.status).toBe('Resolved')
    expect(mockPrisma.performanceReview.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'review-1' },
      data: expect.objectContaining({ status: 'Published', grade: 'S_Plus' }),
    }))
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['emp-1'], expect.objectContaining({ type: 'AppealResolved' }))
  })

  it('does not allow responding to already resolved appeals', async () => {
    mockPrisma.appeal.findUnique.mockResolvedValueOnce({
      id: 'appeal-1', employeeId: 'emp-1', managerId: 'mgr-1', reviewId: 'review-1', status: 'Resolved',
    })

    await expect(service.respondToAppeal('appeal-1', user(Role.Manager, { id: 'mgr-1' }), { response: 'Again' }))
      .rejects.toThrow(BadRequestException)
  })

  it('throws not found for missing appeals', async () => {
    mockPrisma.appeal.findUnique.mockResolvedValueOnce(null)

    await expect(service.getAppealById('missing', user(Role.Admin))).rejects.toThrow(NotFoundException)
  })
})
