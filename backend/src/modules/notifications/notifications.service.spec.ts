import { NotificationsService } from './notifications.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockPrisma = {
  notification: {
    findMany:   jest.fn(),
    count:      jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
  },
  performanceCycle: {
    findUnique: jest.fn(),
  },
  performanceReview: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
}

const user: SessionUser = {
  id:           'user-1',
  employeeId:   'emp001',
  name:         'Ada',
  email:        'ada@test.local',
  role:         Role.Employee,
  regionId:     'region-1',
  region:       'Taiwan',
  departmentId: 'dept-1',
  department:   'Engineering',
  jobLevel:     'L2',
  jobTitle:     'Engineer',
}

describe('NotificationsService', () => {
  let service: NotificationsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new NotificationsService(mockPrisma as any)
  })

  it('lists latest notifications for a user', async () => {
    mockPrisma.notification.findMany.mockResolvedValueOnce([{ id: 'n-1' }])

    await expect(service.getNotifications(user)).resolves.toEqual([{ id: 'n-1' }])
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  it('marks only the owner notification as read', async () => {
    mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 1 })

    await service.markRead('n-1', user)

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n-1', userId: 'user-1' },
      data:  { read: true },
    })
  })

  it('does not create notifications for empty recipient lists', async () => {
    await service.createForUsers([], { type: 'GoalSubmitted', title: 't', message: 'm' } as any)

    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
  })

  it('deduplicates cycle participant ids across reviews and HR/managers', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ regionId: 'region-1' })
    mockPrisma.performanceReview.findMany.mockResolvedValueOnce([
      { employeeId: 'emp-1', supervisorId: 'sup-1' },
      { employeeId: 'emp-1', supervisorId: null },
    ])
    mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'mgr-1' }, { id: 'sup-1' }])

    const result = await service.getCycleParticipantIds('cycle-1')

    expect(result.sort()).toEqual(['emp-1', 'mgr-1', 'sup-1'])
  })
})
