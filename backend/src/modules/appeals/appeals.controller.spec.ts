import { AppealsController } from './appeals.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockAppealsService = {
  getAppealsForManager: jest.fn(),
  createAppeal:         jest.fn(),
  getUnreadCount:       jest.fn(),
  getAppealById:        jest.fn(),
  respondToAppeal:      jest.fn(),
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

describe('AppealsController', () => {
  let controller: AppealsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new AppealsController(mockAppealsService as any)
  })

  it('delegates manager list and employee unread count reads', async () => {
    await controller.getAppeals(user)
    await controller.getUnreadCount(user)

    expect(mockAppealsService.getAppealsForManager).toHaveBeenCalledWith(user)
    expect(mockAppealsService.getUnreadCount).toHaveBeenCalledWith(user)
  })

  it('delegates appeal creation with current user and body', async () => {
    const dto = { reviewId: 'review-1', reason: 'Please reconsider' }

    await controller.createAppeal(user, dto)

    expect(mockAppealsService.createAppeal).toHaveBeenCalledWith(user, dto)
  })

  it('delegates appeal detail lookup with id and current user', async () => {
    await controller.getAppeal('appeal-1', user)

    expect(mockAppealsService.getAppealById).toHaveBeenCalledWith('appeal-1', user)
  })

  it('delegates appeal response with id, current user, and body', async () => {
    const dto = { response: 'Resolved', newGrade: 'S_Plus' }

    await controller.respondToAppeal('appeal-1', user, dto as any)

    expect(mockAppealsService.respondToAppeal).toHaveBeenCalledWith('appeal-1', user, dto)
  })
})
