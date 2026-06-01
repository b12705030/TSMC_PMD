import { ConfigController } from './config.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockConfigService = {
  getMyRegionConfig: jest.fn(),
  getRegionConfig:   jest.fn(),
  updateConfig:      jest.fn(),
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

describe('ConfigController', () => {
  let controller: ConfigController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new ConfigController(mockConfigService as any)
  })

  it('delegates current user config lookup to the service', async () => {
    mockConfigService.getMyRegionConfig.mockResolvedValueOnce([{ key: 'timezone' }])

    await expect(controller.getMyRegionConfig(user)).resolves.toEqual([{ key: 'timezone' }])
    expect(mockConfigService.getMyRegionConfig).toHaveBeenCalledWith(user)
  })

  it('delegates explicit region config lookup with region id and user', async () => {
    mockConfigService.getRegionConfig.mockResolvedValueOnce([])

    await controller.getRegionConfig('region-us', user)

    expect(mockConfigService.getRegionConfig).toHaveBeenCalledWith('region-us', user)
  })

  it('delegates config updates with key, body, and user', async () => {
    const dto = { value: 'Asia/Taipei', regionId: 'region-tw' }
    mockConfigService.updateConfig.mockResolvedValueOnce({ key: 'timezone', value: 'Asia/Taipei' })

    await controller.updateConfig('timezone', dto, user)

    expect(mockConfigService.updateConfig).toHaveBeenCalledWith('timezone', dto, user)
  })
})
