import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { ConfigService } from './config.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockPrisma = {
  regionConfig: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
}

function user(role: Role, regionId = 'region-tw'): SessionUser {
  return {
    id:           'u1',
    employeeId:   'e1',
    name:         'Ada',
    email:        'ada@test.local',
    role,
    regionId,
    region:       'Taiwan',
    departmentId: 'dept-1',
    department:   'Engineering',
    jobLevel:     'L2',
    jobTitle:     'Engineer',
  }
}

describe('ConfigService', () => {
  let service: ConfigService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ConfigService(mockPrisma as any)
  })

  it('scopes my region config for RegionalHR users', async () => {
    mockPrisma.regionConfig.findMany.mockResolvedValueOnce([])

    await service.getMyRegionConfig(user(Role.RegionalHR, 'region-tw'))

    expect(mockPrisma.regionConfig.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { regionId: 'region-tw' },
    }))
  })

  it('lets Admin and GlobalHR read all region configs', async () => {
    mockPrisma.regionConfig.findMany.mockResolvedValueOnce([])

    await service.getMyRegionConfig(user(Role.Admin))

    expect(mockPrisma.regionConfig.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
    }))
  })

  it('only allows global roles to read a specific region config', async () => {
    await expect(service.getRegionConfig('region-tw', user(Role.RegionalHR)))
      .rejects.toThrow(ForbiddenException)

    mockPrisma.regionConfig.findMany.mockResolvedValueOnce([{ key: 'timezone', value: 'Asia/Taipei' }])
    await expect(service.getRegionConfig('region-tw', user(Role.Admin)))
      .resolves.toEqual([{ key: 'timezone', value: 'Asia/Taipei' }])
  })

  it('lets RegionalHR update only their own region config', async () => {
    mockPrisma.regionConfig.findUnique.mockResolvedValueOnce({ key: 'timezone', value: 'UTC' })
    mockPrisma.regionConfig.update.mockResolvedValueOnce({ key: 'timezone', value: 'Asia/Taipei' })

    const result = await service.updateConfig('timezone', { value: 'Asia/Taipei', regionId: 'region-other' }, user(Role.RegionalHR, 'region-tw'))

    expect(result.value).toBe('Asia/Taipei')
    expect(mockPrisma.regionConfig.findUnique).toHaveBeenCalledWith({
      where: { regionId_key: { regionId: 'region-tw', key: 'timezone' } },
    })
  })

  it('lets Admin update an explicitly selected region config', async () => {
    mockPrisma.regionConfig.findUnique.mockResolvedValueOnce({ key: 'timezone', value: 'UTC' })
    mockPrisma.regionConfig.update.mockResolvedValueOnce({ key: 'timezone', value: 'America/Los_Angeles' })

    await service.updateConfig('timezone', { value: 'America/Los_Angeles', regionId: 'region-us' }, user(Role.Admin, 'region-tw'))

    expect(mockPrisma.regionConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { regionId_key: { regionId: 'region-us', key: 'timezone' } },
    }))
  })

  it('blocks non-HR users from updating config', async () => {
    await expect(service.updateConfig('timezone', { value: 'UTC' }, user(Role.Employee)))
      .rejects.toThrow(ForbiddenException)
  })

  it('throws when updating a missing config key', async () => {
    mockPrisma.regionConfig.findUnique.mockResolvedValueOnce(null)

    await expect(service.updateConfig('missing', { value: 'x' }, user(Role.Admin)))
      .rejects.toThrow(NotFoundException)
  })
})
