import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { GoalsService } from './goals.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockPrisma = {
  goal: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  user: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
  },
  performanceCycle: {
    findUnique: jest.fn(),
  },
  progressUpdate: {
    create: jest.fn(),
  },
  goalMilestone: {
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
    delete:     jest.fn(),
  },
  $transaction: jest.fn(),
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

describe('GoalsService', () => {
  let service: GoalsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new GoalsService(mockPrisma as any, mockNotifications as any)
  })

  it('creates a draft goal linked to an active cycle in the same region', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-1', status: 'GoalSetting' })
    mockPrisma.goal.create.mockResolvedValueOnce({ id: 'goal-1', status: 'Draft' })

    const result = await service.createGoal(user(Role.Employee), {
      title:       'Improve quality',
      description: 'desc',
      metric:      'metric',
      targetValue: '100',
      relevance:   'rel',
      dueDate:     '2026-12-31',
      cycleId:     'cycle-1',
    })

    expect(result.status).toBe('Draft')
    expect(mockPrisma.goal.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', cycleId: 'cycle-1' }),
    }))
  })

  it('blocks cross-region cycle links for non-global users', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-2', status: 'GoalSetting' })

    await expect(service.createGoal(user(Role.Employee), {
      title: 'Goal', description: 'd', metric: 'm', targetValue: 't', relevance: 'r', dueDate: '2026-12-31', cycleId: 'cycle-1',
    })).rejects.toThrow(ForbiddenException)
  })

  it('only allows owners to update editable goals', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1', status: 'Draft' })
    mockPrisma.goal.update.mockResolvedValueOnce({ id: 'goal-1', title: 'Updated' })

    await expect(service.updateGoal('goal-1', user(Role.Employee), { title: 'Updated' }))
      .resolves.toEqual(expect.objectContaining({ title: 'Updated' }))

    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'other', status: 'Draft' })
    await expect(service.updateGoal('goal-1', user(Role.Employee), { title: 'Nope' }))
      .rejects.toThrow(ForbiddenException)
  })

  it('submits draft goals and notifies reviewer chain', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1', status: 'Draft' })
    mockPrisma.goal.update.mockResolvedValueOnce({ id: 'goal-1', title: 'Goal', status: 'PendingApproval' })
    mockPrisma.user.findUnique.mockResolvedValueOnce({ name: 'Ada', supervisorId: 'sup-1', managerId: 'mgr-1' })

    const result = await service.submitGoal('goal-1', user(Role.Employee))

    expect(result.status).toBe('PendingApproval')
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['sup-1', 'mgr-1'], expect.objectContaining({ type: 'GoalSubmitted' }))
  })

  it('requires pending status before approving a goal', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'emp-1', status: 'Draft' })

    await expect(service.approveGoal('goal-1', user(Role.Supervisor)))
      .rejects.toThrow(ForbiddenException)
  })

  it('allows a supervisor to approve a direct report goal', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'emp-1', status: 'PendingApproval' })
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'emp-1', regionId: 'region-1', supervisorId: 'sup-1' })
    mockPrisma.goal.update.mockResolvedValueOnce({ id: 'goal-1', userId: 'emp-1', status: 'Approved', title: 'Goal' })

    const result = await service.approveGoal('goal-1', user(Role.Supervisor, { id: 'sup-1' }))

    expect(result.status).toBe('Approved')
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['emp-1'], expect.objectContaining({ type: 'GoalApproved' }))
  })

  it('adds milestones after the latest order index', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1' })
    mockPrisma.goalMilestone.findFirst.mockResolvedValueOnce({ orderIndex: 2 })
    mockPrisma.goalMilestone.create.mockResolvedValueOnce({ id: 'm-1', orderIndex: 3 })

    const result = await service.addMilestone('goal-1', user(Role.Employee), 'Ship it')

    expect(result.orderIndex).toBe(3)
    expect(mockPrisma.goalMilestone.create).toHaveBeenCalledWith({
      data: { goalId: 'goal-1', title: 'Ship it', orderIndex: 3 },
    })
  })

  it('throws when deleting a non-draft goal', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1', status: 'Approved' })

    await expect(service.deleteGoal('goal-1', user(Role.Employee))).rejects.toThrow(BadRequestException)
    expect(mockPrisma.goal.delete).not.toHaveBeenCalled()
  })

  it('throws not found for missing goals', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce(null)

    await expect(service.getGoal('missing', user(Role.Employee))).rejects.toThrow(NotFoundException)
  })
})
