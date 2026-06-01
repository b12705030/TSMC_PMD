import { NotificationsController } from './notifications.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockNotificationsService = {
  getNotifications: jest.fn(),
  getUnreadCount:   jest.fn(),
  markRead:         jest.fn(),
  markAllRead:      jest.fn(),
}

const user: SessionUser = {
  id:           'u1',
  employeeId:   'e1',
  name:         'Ada',
  email:        'ada@test.local',
  role:         Role.Employee,
  regionId:     'region-tw',
  region:       'Taiwan',
  departmentId: 'dept-1',
  department:   'Engineering',
  jobLevel:     'L2',
  jobTitle:     'Engineer',
}

describe('NotificationsController', () => {
  let controller: NotificationsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new NotificationsController(mockNotificationsService as any)
  })

  it('delegates listing notifications to the service', async () => {
    mockNotificationsService.getNotifications.mockResolvedValueOnce([{ id: 'n1' }])

    await expect(controller.getNotifications(user)).resolves.toEqual([{ id: 'n1' }])
    expect(mockNotificationsService.getNotifications).toHaveBeenCalledWith(user)
  })

  it('delegates unread count lookup to the service', async () => {
    mockNotificationsService.getUnreadCount.mockResolvedValueOnce({ count: 2 })

    await expect(controller.getUnreadCount(user)).resolves.toEqual({ count: 2 })
    expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith(user)
  })

  it('delegates marking a notification read with id and user', async () => {
    mockNotificationsService.markRead.mockResolvedValueOnce({ count: 1 })

    await controller.markRead('n1', user)

    expect(mockNotificationsService.markRead).toHaveBeenCalledWith('n1', user)
  })

  it('delegates marking all notifications read with current user', async () => {
    mockNotificationsService.markAllRead.mockResolvedValueOnce({ count: 3 })

    await controller.markAllRead(user)

    expect(mockNotificationsService.markAllRead).toHaveBeenCalledWith(user)
  })
})
