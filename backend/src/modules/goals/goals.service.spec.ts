import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { GoalsService } from './goals.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

function createMockPrisma() {
  return {
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
}

function createMockNotifications() {
  return {
    createForUsers: jest.fn().mockResolvedValue(undefined),
  }
}

let mockPrisma: ReturnType<typeof createMockPrisma>
let mockNotifications: ReturnType<typeof createMockNotifications>

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
    mockPrisma = createMockPrisma()
    mockNotifications = createMockNotifications()
    mockPrisma.$transaction.mockResolvedValue(undefined)
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

  it('lists my goals ordered by newest first', async () => {
    mockPrisma.goal.findMany.mockResolvedValueOnce([{ id: 'goal-1' }])

    const result = await service.getMyGoals('user-1')

    expect(result).toEqual([{ id: 'goal-1' }])
    expect(mockPrisma.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where:   { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    }))
  })

  it('creates an unlinked personal goal with null cycleId', async () => {
    mockPrisma.goal.create.mockResolvedValueOnce({ id: 'goal-1', cycleId: null, type: 'Personal' })

    const result = await service.createGoal(user(Role.Employee), {
      title:       'Improve quality',
      description: 'desc',
      metric:      'metric',
      targetValue: '100',
      relevance:   'rel',
      dueDate:     '2026-12-31',
    })

    expect(result.cycleId).toBeNull()
    expect(mockPrisma.performanceCycle.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.goal.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cycleId: null, type: 'Personal' }),
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

  it('rejects pending goals with a reason and notifies the owner', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'emp-1', status: 'PendingApproval' })
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'emp-1', regionId: 'region-1', supervisorId: 'sup-1' })
    mockPrisma.goal.update.mockResolvedValueOnce({ id: 'goal-1', userId: 'emp-1', status: 'Rejected', title: 'Goal' })

    const result = await service.rejectGoal('goal-1', user(Role.Supervisor, { id: 'sup-1' }), 'Needs clearer metric')

    expect(result.status).toBe('Rejected')
    expect(mockPrisma.goal.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'Rejected', rejectionReason: 'Needs clearer metric' },
    }))
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['emp-1'], expect.objectContaining({ type: 'GoalRejected' }))
  })

  it('returns manager team goals for direct reports and reports via supervisors', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([{ id: 'direct-1' }])
      .mockResolvedValueOnce([{ id: 'via-sup-1' }])
    mockPrisma.goal.findMany.mockResolvedValueOnce([{ id: 'goal-1' }])

    const result = await service.getTeamGoals(user(Role.Manager, { id: 'mgr-1' }))

    expect(result).toEqual([{ id: 'goal-1' }])
    expect(mockPrisma.user.findMany).toHaveBeenNthCalledWith(1, {
      where: { managerId: 'mgr-1', supervisorId: null },
      select: { id: true },
    })
    expect(mockPrisma.user.findMany).toHaveBeenNthCalledWith(2, {
      where: { supervisor: { managerId: 'mgr-1' } },
      select: { id: true },
    })
    expect(mockPrisma.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: { in: ['direct-1', 'via-sup-1'] }, status: { not: 'Draft' } },
    }))
  })

  it('enforces region isolation when RegionalHR reads employee goals', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'emp-1', regionId: 'region-2', supervisor: null })

    await expect(service.getGoalsByEmployee('emp-1', user(Role.RegionalHR, { regionId: 'region-1' })))
      .rejects.toThrow(ForbiddenException)
  })

  it('allows managers to read goals for reports via supervisors', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'emp-1',
      regionId: 'region-1',
      managerId: null,
      supervisorId: 'sup-1',
      supervisor: { managerId: 'mgr-1' },
    })
    mockPrisma.goal.findMany.mockResolvedValueOnce([{ id: 'goal-1' }])

    const result = await service.getGoalsByEmployee('emp-1', user(Role.Manager, { id: 'mgr-1' }))

    expect(result).toEqual([{ id: 'goal-1' }])
    expect(mockPrisma.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'emp-1', status: { not: 'Draft' } },
    }))
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

  it('toggles milestone completion with note and clears both when reopened', async () => {
    mockPrisma.goalMilestone.findUnique.mockResolvedValueOnce({ id: 'm-1', goalId: 'goal-1', completedAt: null })
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1' })
    mockPrisma.goalMilestone.update.mockResolvedValueOnce({ id: 'm-1', completedAt: new Date(), note: 'done' })

    await service.toggleMilestone('goal-1', 'm-1', user(Role.Employee), 'done')

    expect(mockPrisma.goalMilestone.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data:  { completedAt: expect.any(Date), note: 'done' },
    })

    mockPrisma.goalMilestone.findUnique.mockResolvedValueOnce({ id: 'm-1', goalId: 'goal-1', completedAt: new Date() })
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1' })
    mockPrisma.goalMilestone.update.mockResolvedValueOnce({ id: 'm-1', completedAt: null, note: null })

    await service.toggleMilestone('goal-1', 'm-1', user(Role.Employee), 'ignored')

    expect(mockPrisma.goalMilestone.update).toHaveBeenLastCalledWith({
      where: { id: 'm-1' },
      data:  { completedAt: null, note: null },
    })
  })

  it('updates milestone note and url only for the owner', async () => {
    mockPrisma.goalMilestone.findUnique
      .mockResolvedValueOnce({ id: 'm-1', goalId: 'goal-1' })
      .mockResolvedValueOnce({ id: 'm-1', goalId: 'goal-1' })
    mockPrisma.goal.findUnique
      .mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1' })
      .mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1' })
    mockPrisma.goalMilestone.update
      .mockResolvedValueOnce({ id: 'm-1', note: 'new note' })
      .mockResolvedValueOnce({ id: 'm-1', url: 'https://example.com' })

    await service.updateMilestoneNote('goal-1', 'm-1', user(Role.Employee), 'new note')
    await service.updateMilestoneUrl('goal-1', 'm-1', user(Role.Employee), 'https://example.com')

    expect(mockPrisma.goalMilestone.update).toHaveBeenNthCalledWith(1, { where: { id: 'm-1' }, data: { note: 'new note' } })
    expect(mockPrisma.goalMilestone.update).toHaveBeenNthCalledWith(2, { where: { id: 'm-1' }, data: { url: 'https://example.com' } })
  })

  it('reorders milestones in a transaction', async () => {
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1' })
    mockPrisma.goalMilestone.updateMany
      .mockReturnValueOnce(Promise.resolve({ count: 1 }))
      .mockReturnValueOnce(Promise.resolve({ count: 1 }))

    await service.reorderMilestones('goal-1', ['m-2', 'm-1'], user(Role.Employee))

    expect(mockPrisma.goalMilestone.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'm-2', goalId: 'goal-1' },
      data:  { orderIndex: 0 },
    })
    expect(mockPrisma.goalMilestone.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'm-1', goalId: 'goal-1' },
      data:  { orderIndex: 1 },
    })
    expect(mockPrisma.$transaction).toHaveBeenCalledWith([expect.any(Promise), expect.any(Promise)])
  })

  it('deletes milestones only after validating ownership', async () => {
    mockPrisma.goalMilestone.findUnique.mockResolvedValueOnce({ id: 'm-1', goalId: 'goal-1' })
    mockPrisma.goal.findUnique.mockResolvedValueOnce({ id: 'goal-1', userId: 'user-1' })
    mockPrisma.goalMilestone.delete.mockResolvedValueOnce({ id: 'm-1' })

    await service.deleteMilestone('goal-1', 'm-1', user(Role.Employee))

    expect(mockPrisma.goalMilestone.delete).toHaveBeenCalledWith({ where: { id: 'm-1' } })
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
