import { Test } from '@nestjs/testing'
import { UsersService } from './users.service'
import { PrismaService } from '../../prisma/prisma.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockPrisma = {
  user: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    count:      jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  region: { findMany: jest.fn() },
}

function sessionUser(role: Role, regionId = 'region-tw'): SessionUser {
  return {
    id:           'u1',
    employeeId:   'e1',
    name:         'Test',
    email:        't@test.local',
    role,
    regionId,
    region:       'Taiwan',
    departmentId: 'd1',
    department:   'Engineering',
    jobLevel:     'L2',
    jobTitle:     'Engineer',
  }
}

describe('UsersService', () => {
  let service: UsersService

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    service = module.get(UsersService)
  })

  describe('getGroupedJobTitles()', () => {
    it('separates Supervisor titles into management and Employee titles into staff', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { jobTitle: 'Engineer',        role: Role.Employee },
        { jobTitle: 'Senior Engineer', role: Role.Supervisor },
      ])
      const result = await service.getGroupedJobTitles(sessionUser(Role.Admin))
      expect(result.management).toContain('Senior Engineer')
      expect(result.staff).toContain('Engineer')
    })

    it('classifies Manager role titles as management', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { jobTitle: 'Engineering Manager', role: Role.Manager },
      ])
      const result = await service.getGroupedJobTitles(sessionUser(Role.Admin))
      expect(result.management).toContain('Engineering Manager')
      expect(result.staff).not.toContain('Engineering Manager')
    })

    it('moves title to management when it appears in both groups', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { jobTitle: 'Tech Lead', role: Role.Employee },
        { jobTitle: 'Tech Lead', role: Role.Supervisor },
      ])
      const result = await service.getGroupedJobTitles(sessionUser(Role.Admin))
      expect(result.management).toContain('Tech Lead')
      expect(result.staff).not.toContain('Tech Lead')
    })

    it('sorts management titles alphabetically via localeCompare', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { jobTitle: 'Senior Manager',   role: Role.Manager },
        { jobTitle: 'Director',         role: Role.Manager },
        { jobTitle: 'Engineer Manager', role: Role.Manager },
      ])
      const result = await service.getGroupedJobTitles(sessionUser(Role.Admin))
      expect(result.management).toEqual(['Director', 'Engineer Manager', 'Senior Manager'])
    })

    it('sorts staff titles alphabetically via localeCompare', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { jobTitle: 'Senior Engineer', role: Role.Employee },
        { jobTitle: 'Analyst',         role: Role.Employee },
        { jobTitle: 'Engineer',        role: Role.Employee },
      ])
      const result = await service.getGroupedJobTitles(sessionUser(Role.Admin))
      expect(result.staff).toEqual(['Analyst', 'Engineer', 'Senior Engineer'])
    })

    it('returns empty arrays when no users exist', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([])
      const result = await service.getGroupedJobTitles(sessionUser(Role.Admin))
      expect(result.management).toEqual([])
      expect(result.staff).toEqual([])
    })

    it('queries without regionId filter for Admin', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([])
      await service.getGroupedJobTitles(sessionUser(Role.Admin))
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      )
    })

    it('queries without regionId filter for GlobalHR', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([])
      await service.getGroupedJobTitles(sessionUser(Role.GlobalHR))
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      )
    })

    it('queries with regionId filter for non-global roles', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([])
      await service.getGroupedJobTitles(sessionUser(Role.RegionalHR, 'region-tw'))
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { regionId: 'region-tw' } }),
      )
    })
  })
})
