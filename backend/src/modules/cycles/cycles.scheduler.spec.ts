import { CycleStatus, NotificationType } from '@prisma/client'
import { CyclesScheduler } from './cycles.scheduler'

const mockPrisma = {
  performanceCycle: {
    findMany: jest.fn(),
    update:   jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  formTemplate: {
    findMany: jest.fn(),
  },
  performanceReview: {
    createMany: jest.fn(),
  },
  notification: {
    count: jest.fn(),
  },
  $transaction: jest.fn(),
}

const mockCyclesService = {}

const mockNotifications = {
  getCycleParticipantIds: jest.fn(),
  createForUsers:         jest.fn(),
}

describe('CyclesScheduler', () => {
  let scheduler: CyclesScheduler

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma))
    mockNotifications.getCycleParticipantIds.mockResolvedValue(['emp-1', 'sup-1'])
    mockNotifications.createForUsers.mockResolvedValue(undefined)
    scheduler = new CyclesScheduler(mockPrisma as any, mockCyclesService as any, mockNotifications as any)
  })

  it('auto-advances confirmed in-progress cycles due for review and creates matching reviews', async () => {
    mockPrisma.performanceCycle.findMany
      .mockResolvedValueOnce([
        { id: 'cycle-1', name: 'Q2', regionId: 'region-tw', status: CycleStatus.InProgress },
      ])
      .mockResolvedValueOnce([])
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'emp-1', jobLevel: 'L2', jobTitle: 'Engineer', supervisorId: 'sup-1' },
    ])
    mockPrisma.formTemplate.findMany.mockResolvedValueOnce([
      { id: 'tpl-1', appliesGrades: ['L2'], applyTitles: ['Engineer'] },
    ])
    mockPrisma.performanceCycle.update.mockResolvedValueOnce({ id: 'cycle-1', status: CycleStatus.EmployeeReview })
    mockPrisma.performanceReview.createMany.mockResolvedValueOnce({ count: 1 })

    await scheduler.handleDailyCheck()

    expect(mockPrisma.performanceCycle.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: CycleStatus.InProgress,
        advanceConfirmed: true,
        reviewStart: { lte: expect.any(Date) },
      },
    })
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: 'Employee',
        regionId: 'region-tw',
        OR: [{ supervisorId: { not: null } }, { managerId: { not: null } }],
      },
      select: { id: true, jobLevel: true, jobTitle: true, supervisorId: true },
    })
    expect(mockPrisma.formTemplate.findMany).toHaveBeenCalledWith({
      where:  { cycleId: 'cycle-1', status: 'Published' },
      select: { id: true, appliesGrades: true, applyTitles: true },
    })
    expect(mockPrisma.performanceCycle.update).toHaveBeenCalledWith({
      where: { id: 'cycle-1' },
      data:  { status: CycleStatus.EmployeeReview },
    })
    expect(mockPrisma.performanceReview.createMany).toHaveBeenCalledWith({
      data: [{ cycleId: 'cycle-1', employeeId: 'emp-1', supervisorId: 'sup-1', templateId: 'tpl-1' }],
      skipDuplicates: true,
    })
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['emp-1', 'sup-1'], expect.objectContaining({
      type: NotificationType.CycleAutoAdvanced,
      cycleId: 'cycle-1',
    }))
  })

  it('continues reminder processing when one auto-advance fails', async () => {
    mockPrisma.performanceCycle.findMany
      .mockResolvedValueOnce([
        { id: 'cycle-1', name: 'Broken', regionId: 'region-tw', status: CycleStatus.InProgress },
      ])
      .mockResolvedValueOnce([])
    mockPrisma.user.findMany.mockRejectedValueOnce(new Error('DB down'))

    await expect(scheduler.handleDailyCheck()).resolves.toBeUndefined()
    expect(mockNotifications.createForUsers).not.toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      type: NotificationType.CycleAutoAdvanced,
    }))
  })

  it('sends one daily reminder to RegionalHR for unconfirmed cycles within seven days', async () => {
    const reviewStart = new Date()
    reviewStart.setDate(reviewStart.getDate() + 3)
    mockPrisma.performanceCycle.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'cycle-2', name: 'Q3', regionId: 'region-tw', reviewStart },
      ])
    mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'hr-1' }])
    mockPrisma.notification.count.mockResolvedValueOnce(0)

    await scheduler.handleDailyCheck()

    expect(mockPrisma.performanceCycle.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: CycleStatus.InProgress,
        advanceConfirmed: false,
        reviewStart: { gte: expect.any(Date), lte: expect.any(Date) },
      },
      include: { region: { select: { id: true } } },
    })
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['hr-1'], expect.objectContaining({
      type: NotificationType.CycleAdvanceReminder,
      cycleId: 'cycle-2',
    }))
  })

  it('does not send duplicate reminders on the same day', async () => {
    const reviewStart = new Date()
    reviewStart.setDate(reviewStart.getDate() + 3)
    mockPrisma.performanceCycle.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'cycle-2', name: 'Q3', regionId: 'region-tw', reviewStart },
      ])
    mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'hr-1' }])
    mockPrisma.notification.count.mockResolvedValueOnce(1)

    await scheduler.handleDailyCheck()

    expect(mockNotifications.createForUsers).not.toHaveBeenCalled()
  })
})
