import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { CycleStatus, TemplateStatus } from '@prisma/client'
import { CyclesService } from './cycles.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockPrisma = {
  performanceCycle: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  formTemplate: {
    findFirst: jest.fn(),
    findMany:  jest.fn(),
  },
  performanceReview: {
    count:      jest.fn(),
    createMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  templateQuestion: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
}

const mockNotifications = {
  createForUsers:          jest.fn().mockResolvedValue(undefined),
  getCycleParticipantIds:  jest.fn().mockResolvedValue([]),
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

describe('CyclesService', () => {
  let service: CyclesService

  beforeEach(() => {
    jest.resetAllMocks()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma))
    mockNotifications.createForUsers.mockResolvedValue(undefined)
    mockNotifications.getCycleParticipantIds.mockResolvedValue([])
    service = new CyclesService(mockPrisma as any, mockNotifications as any)
  })

  it('filters cycles by region for non-global users', async () => {
    mockPrisma.performanceCycle.findMany.mockResolvedValueOnce([])

    await service.getCycles(user(Role.RegionalHR))

    expect(mockPrisma.performanceCycle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { regionId: 'region-1' },
    }))
  })

  it('blocks cross-region cycle reads', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-2' })

    await expect(service.getCycle('cycle-1', user(Role.RegionalHR))).rejects.toThrow(ForbiddenException)
  })

  it('validates date ordering when creating cycles', async () => {
    await expect(service.createCycle({
      name: 'Bad cycle',
      type: 'Annual',
      goalSettingStart: '2026-02-01',
      goalSettingEnd: '2026-01-01',
      reviewStart: '2026-03-01',
      reviewEnd: '2026-04-01',
    }, user(Role.Admin))).rejects.toThrow(BadRequestException)
  })

  it('creates cycles in the requested region for global users', async () => {
    mockPrisma.performanceCycle.create.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-2' })

    const result = await service.createCycle({
      name: 'Q1',
      type: 'Quarterly',
      regionId: 'region-2',
      goalSettingStart: '2026-01-01',
      goalSettingEnd: '2026-01-31',
      reviewStart: '2026-02-01',
      reviewEnd: '2026-02-28',
    }, user(Role.Admin, { regionId: 'region-1' }))

    expect(result.regionId).toBe('region-2')
    expect(mockPrisma.performanceCycle.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ regionId: 'region-2' }),
    }))
  })

  it('only lets Admin edit cycles', async () => {
    await expect(service.updateCycle('cycle-1', { name: 'New' }, user(Role.RegionalHR)))
      .rejects.toThrow(ForbiddenException)
  })

  it('updates editable goal-setting cycles', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', status: CycleStatus.GoalSetting })
    mockPrisma.performanceCycle.update.mockResolvedValueOnce({ id: 'cycle-1', name: 'Updated' })

    const result = await service.updateCycle('cycle-1', {
      name: 'Updated',
      reviewStart: '2026-03-01',
    }, user(Role.Admin))

    expect(result.name).toBe('Updated')
    expect(mockPrisma.performanceCycle.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cycle-1' },
      data:  { name: 'Updated', reviewStart: new Date('2026-03-01') },
    }))
  })

  it('blocks editing cycles after goal setting ends', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', status: CycleStatus.InProgress })

    await expect(service.updateCycle('cycle-1', { name: 'Too late' }, user(Role.Admin)))
      .rejects.toThrow(BadRequestException)
    expect(mockPrisma.performanceCycle.update).not.toHaveBeenCalled()
  })

  it('requires a published template before advancing into employee review', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1', regionId: 'region-1', status: CycleStatus.InProgress,
    })
    mockPrisma.formTemplate.findFirst.mockResolvedValueOnce(null)

    await expect(service.advanceStatus('cycle-1', user(Role.RegionalHR))).rejects.toThrow(BadRequestException)
  })

  it('advances to employee review and creates review rows when gates pass', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1', regionId: 'region-1', status: CycleStatus.InProgress,
    })
    mockPrisma.formTemplate.findFirst.mockResolvedValueOnce({ id: 'tpl-1', status: TemplateStatus.Published })
    mockPrisma.user.findMany
      .mockResolvedValueOnce([{ id: 'emp-1', name: 'Ada', jobLevel: 'L2', jobTitle: 'Engineer' }])
      .mockResolvedValueOnce([{ id: 'emp-1', jobLevel: 'L2', jobTitle: 'Engineer', supervisorId: 'sup-1' }])
    mockPrisma.formTemplate.findMany
      .mockResolvedValueOnce([{ id: 'tpl-1', appliesGrades: ['L2'], applyTitles: ['Engineer'] }])
      .mockResolvedValueOnce([{ id: 'tpl-1', appliesGrades: ['L2'], applyTitles: ['Engineer'] }])
    mockPrisma.performanceCycle.update.mockResolvedValueOnce({ id: 'cycle-1', status: CycleStatus.EmployeeReview })
    mockPrisma.performanceReview.createMany.mockResolvedValueOnce({ count: 1 })

    const result = await service.advanceStatus('cycle-1', user(Role.RegionalHR))

    expect(result.status).toBe(CycleStatus.EmployeeReview)
    expect(mockPrisma.performanceReview.createMany).toHaveBeenCalledWith({
      data: [{ cycleId: 'cycle-1', employeeId: 'emp-1', supervisorId: 'sup-1', templateId: 'tpl-1' }],
      skipDuplicates: true,
    })
  })

  it('confirms advance only for in-progress cycles', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1', regionId: 'region-1', status: CycleStatus.GoalSetting,
    })

    await expect(service.confirmAdvance('cycle-1', user(Role.RegionalHR))).rejects.toThrow(BadRequestException)
  })

  it('confirms an in-progress cycle and notifies the HR user', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1',
      name: 'Cycle',
      regionId: 'region-1',
      status: CycleStatus.InProgress,
      advanceConfirmed: false,
      reviewStart: new Date('2026-02-01'),
    })
    mockPrisma.performanceCycle.update.mockResolvedValueOnce({ id: 'cycle-1', advanceConfirmed: true })

    const result = await service.confirmAdvance('cycle-1', user(Role.RegionalHR))

    expect(result.advanceConfirmed).toBe(true)
    expect(mockPrisma.performanceCycle.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ advanceConfirmed: true, advanceConfirmedAt: expect.any(Date) }),
    }))
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['user-1'], expect.objectContaining({
      type: 'CycleAdvanceReminder',
      cycleId: 'cycle-1',
    }))
  })

  it('blocks duplicate advance confirmations', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1',
      regionId: 'region-1',
      status: CycleStatus.InProgress,
      advanceConfirmed: true,
    })

    await expect(service.confirmAdvance('cycle-1', user(Role.RegionalHR))).rejects.toThrow(BadRequestException)
    expect(mockPrisma.performanceCycle.update).not.toHaveBeenCalled()
  })

  it('postpones review start and resets advance confirmation', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1',
      name: 'Cycle',
      regionId: 'region-1',
      status: CycleStatus.InProgress,
    })
    mockPrisma.performanceCycle.update.mockResolvedValueOnce({ id: 'cycle-1', advanceConfirmed: false })
    mockNotifications.getCycleParticipantIds.mockResolvedValueOnce(['emp-1'])

    const result = await service.postpone('cycle-1', { newReviewStart: '2099-01-01' }, user(Role.RegionalHR))

    expect(result.advanceConfirmed).toBe(false)
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['emp-1'], expect.objectContaining({ type: 'CyclePostponed' }))
  })

  it('only postpones in-progress cycles', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1',
      regionId: 'region-1',
      status: CycleStatus.GoalSetting,
    })

    await expect(service.postpone('cycle-1', { newReviewStart: '2099-01-01' }, user(Role.RegionalHR)))
      .rejects.toThrow(BadRequestException)
    expect(mockPrisma.performanceCycle.update).not.toHaveBeenCalled()
  })

  it('rejects postponing review start to today or the past', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1',
      regionId: 'region-1',
      status: CycleStatus.InProgress,
    })

    await expect(service.postpone('cycle-1', { newReviewStart: '2000-01-01' }, user(Role.RegionalHR)))
      .rejects.toThrow(BadRequestException)
    expect(mockPrisma.performanceCycle.update).not.toHaveBeenCalled()
  })

  it('blocks completing cycles while manager approvals are pending', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1', regionId: 'region-1', status: CycleStatus.Calibration,
    })
    mockPrisma.performanceReview.count.mockResolvedValueOnce(1)

    await expect(service.advanceStatus('cycle-1', user(Role.RegionalHR))).rejects.toThrow(BadRequestException)
  })

  it('returns manager questionnaire completion status', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-1' })
    mockPrisma.templateQuestion.findMany.mockResolvedValueOnce([{ scopeDepartmentId: 'dept-1' }])
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'mgr-1', name: 'Done', departmentId: 'dept-1' },
      { id: 'mgr-2', name: 'Todo', departmentId: 'dept-2' },
    ])

    const result = await service.getManagerQuestionnaireStatus('cycle-1', user(Role.RegionalHR))

    expect(result.complete).toHaveLength(1)
    expect(result.pending).toHaveLength(1)
  })

  it('blocks advancing from employee review when employees are still pending', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1', regionId: 'region-1', status: CycleStatus.EmployeeReview,
    })
    mockPrisma.performanceReview.count.mockResolvedValueOnce(2)

    await expect(service.advanceStatus('cycle-1', user(Role.RegionalHR))).rejects.toThrow(BadRequestException)
    expect(mockPrisma.performanceCycle.update).not.toHaveBeenCalled()
  })

  it('blocks advancing from supervisor review when supervisor reviews are pending', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({
      id: 'cycle-1', regionId: 'region-1', status: CycleStatus.SupervisorReview,
    })
    mockPrisma.performanceReview.count.mockResolvedValueOnce(3)

    await expect(service.advanceStatus('cycle-1', user(Role.RegionalHR))).rejects.toThrow(BadRequestException)
    expect(mockPrisma.performanceCycle.update).not.toHaveBeenCalled()
  })

  it('blocks manager questionnaire status across regions', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-2' })

    await expect(service.getManagerQuestionnaireStatus('cycle-1', user(Role.RegionalHR, { regionId: 'region-1' })))
      .rejects.toThrow(ForbiddenException)
  })

  it('throws not found for missing cycles', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce(null)

    await expect(service.getCycle('missing', user(Role.Admin))).rejects.toThrow(NotFoundException)
  })
})
