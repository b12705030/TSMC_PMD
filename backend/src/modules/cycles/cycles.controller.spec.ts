import { CyclesController } from './cycles.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockCyclesService = {
  getCycles:                      jest.fn(),
  getManagerQuestionnaireStatus:  jest.fn(),
  getCycle:                       jest.fn(),
  createCycle:                    jest.fn(),
  updateCycle:                    jest.fn(),
  advanceStatus:                  jest.fn(),
  confirmAdvance:                 jest.fn(),
  postpone:                       jest.fn(),
}

const user: SessionUser = {
  id:           'u1',
  employeeId:   'e1',
  name:         'Ada',
  email:        'ada@test.local',
  role:         Role.RegionalHR,
  regionId:     'region-tw',
  region:       'Taiwan',
  departmentId: 'dept-1',
  department:   'Engineering',
  jobLevel:     'L2',
  jobTitle:     'Engineer',
}

describe('CyclesController', () => {
  let controller: CyclesController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new CyclesController(mockCyclesService as any)
  })

  it('delegates cycle list/detail and manager questionnaire status reads', async () => {
    await controller.getCycles(user)
    await controller.getCycle('cycle-1', user)
    await controller.getManagerQuestionnaireStatus('cycle-1', user)

    expect(mockCyclesService.getCycles).toHaveBeenCalledWith(user)
    expect(mockCyclesService.getCycle).toHaveBeenCalledWith('cycle-1', user)
    expect(mockCyclesService.getManagerQuestionnaireStatus).toHaveBeenCalledWith('cycle-1', user)
  })

  it('delegates create and update with body, id, and user', async () => {
    const createDto = {
      name: 'Q2',
      type: 'Quarterly',
      goalSettingStart: '2026-01-01',
      goalSettingEnd: '2026-02-01',
      reviewStart: '2026-03-01',
      reviewEnd: '2026-04-01',
    }
    const updateDto = { name: 'Q2 updated' }

    await controller.createCycle(createDto as any, user)
    await controller.updateCycle('cycle-1', updateDto, user)

    expect(mockCyclesService.createCycle).toHaveBeenCalledWith(createDto, user)
    expect(mockCyclesService.updateCycle).toHaveBeenCalledWith('cycle-1', updateDto, user)
  })

  it('delegates status transition actions', async () => {
    const postponeDto = { newReviewStart: '2026-03-15' }

    await controller.advanceStatus('cycle-1', user)
    await controller.confirmAdvance('cycle-1', user)
    await controller.postpone('cycle-1', postponeDto, user)

    expect(mockCyclesService.advanceStatus).toHaveBeenCalledWith('cycle-1', user)
    expect(mockCyclesService.confirmAdvance).toHaveBeenCalledWith('cycle-1', user)
    expect(mockCyclesService.postpone).toHaveBeenCalledWith('cycle-1', postponeDto, user)
  })
})
