import { Test } from '@nestjs/testing'
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { UsersService } from './users.service'
import { PrismaService } from '../../prisma/prisma.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn().mockResolvedValue('hashed-default-password') },
}))

const mockPrisma = {
  user: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    count:      jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  region: { findMany: jest.fn() },
  department: { findMany: jest.fn() },
  session: { deleteMany: jest.fn() },
}

const relationRegion = { name: 'Taiwan' }
const relationDepartment = { name: 'Engineering' }

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id:           'u-target',
    employeeId:   'emp-target',
    name:         'Target',
    email:        'target@test.local',
    role:         Role.Employee,
    regionId:     'region-tw',
    region:       relationRegion,
    departmentId: 'dept-eng',
    department:   relationDepartment,
    jobLevel:     'L2',
    jobTitle:     'Engineer',
    managerId:    'mgr-1',
    supervisorId: 'sup-1',
    createdAt:    new Date('2026-01-01T00:00:00Z'),
    updatedAt:    new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
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

  describe('team and employee access', () => {
    it('returns manager team members through supervisors', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([dbUser()])

      const result = await service.getTeamMembers(sessionUser(Role.Manager, 'region-tw'))

      expect(result).toEqual([expect.objectContaining({ id: 'u-target', region: 'Taiwan', department: 'Engineering' })])
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { supervisor: { managerId: 'u1' } },
      }))
    })

    it('returns supervisor direct reports', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([dbUser({ supervisorId: 'u1' })])

      await service.getTeamMembers(sessionUser(Role.Supervisor, 'region-tw'))

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { supervisorId: 'u1' },
      }))
    })

    it('returns an empty team for individual contributors', async () => {
      const result = await service.getTeamMembers(sessionUser(Role.Employee, 'region-tw'))

      expect(result).toEqual([])
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
    })

    it('builds manager hierarchy with supervisor groups and direct reports', async () => {
      mockPrisma.user.findMany
        .mockResolvedValueOnce([
          dbUser({
            id: 'sup-1',
            role: Role.Supervisor,
            supervisedUsers: [dbUser({ id: 'emp-1', supervisorId: 'sup-1' })],
          }),
        ])
        .mockResolvedValueOnce([dbUser({ id: 'direct-1', supervisorId: null, managerId: 'u1' })])

      const result = await service.getTeamHierarchy(sessionUser(Role.Manager))

      expect(result.groups[0].employees[0].id).toBe('emp-1')
      expect(result.directReports[0].id).toBe('direct-1')
    })

    it('allows RegionalHR to read employees in their region only', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(dbUser({ regionId: 'region-tw' }))
      await expect(service.getEmployee('u-target', sessionUser(Role.RegionalHR, 'region-tw')))
        .resolves.toEqual(expect.objectContaining({ id: 'u-target' }))

      mockPrisma.user.findUnique.mockResolvedValueOnce(dbUser({ regionId: 'region-us' }))
      await expect(service.getEmployee('u-target', sessionUser(Role.RegionalHR, 'region-tw')))
        .rejects.toThrow(ForbiddenException)
    })

    it('allows managers to read direct reports and reports via supervisors', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(dbUser({ managerId: 'u1', supervisorId: null }))
      await expect(service.getEmployee('direct-1', sessionUser(Role.Manager)))
        .resolves.toEqual(expect.objectContaining({ managerId: 'u1' }))

      mockPrisma.user.findUnique.mockResolvedValueOnce(dbUser({ managerId: 'other', supervisorId: 'sup-1', supervisor: { managerId: 'u1' } }))
      await expect(service.getEmployee('via-sup', sessionUser(Role.Manager)))
        .resolves.toEqual(expect.objectContaining({ supervisorId: 'sup-1' }))
    })

    it('returns null when an employee cannot be found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      await expect(service.getEmployee('missing', sessionUser(Role.Admin))).resolves.toBeNull()
    })
  })

  describe('user listing and metadata', () => {
    it('builds search, role, region and pagination filters for listUsers()', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([dbUser()])
      mockPrisma.user.count.mockResolvedValueOnce(1)

      const result = await service.listUsers({ search: 'ada', role: Role.Employee, regionId: 'region-tw', from: 10, size: 25 })

      expect(result.total).toBe(1)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          role: Role.Employee,
          regionId: 'region-tw',
          OR: expect.any(Array),
        }),
        skip: 10,
        take: 25,
      }))
    })

    it('scopes distinct job levels to region for non-global users', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ jobLevel: 'L2' }, { jobLevel: 'L3' }])

      const result = await service.getDistinctJobLevels(sessionUser(Role.RegionalHR, 'region-tw'))

      expect(result).toEqual(['L2', 'L3'])
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { regionId: 'region-tw' },
      }))
    })

    it('returns departments filtered by region when provided', async () => {
      mockPrisma.department.findMany.mockResolvedValueOnce([{ id: 'dept-eng', name: 'Engineering', regionId: 'region-tw' }])

      await service.getDepartments('region-tw')

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { regionId: 'region-tw' },
      }))
    })
  })

  describe('createUser() and updateUser()', () => {
    it('rejects duplicate employee ids and emails', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'existing-eid' })
        .mockResolvedValueOnce(null)

      await expect(service.createUser({
        employeeId: 'emp001',
        name: 'Ada',
        email: 'ada@test.local',
        role: Role.Employee,
        regionId: 'region-tw',
        departmentId: 'dept-eng',
        jobLevel: 'L2',
        jobTitle: 'Engineer',
      })).rejects.toThrow(ConflictException)
    })

    it('creates a user with the default password hash and flattens relations', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
      mockPrisma.user.create.mockResolvedValueOnce(dbUser({ id: 'new-user' }))

      const result = await service.createUser({
        employeeId: 'emp-new',
        name: 'New User',
        email: 'new@test.local',
        role: Role.Employee,
        regionId: 'region-tw',
        departmentId: 'dept-eng',
        jobLevel: 'L2',
        jobTitle: 'Engineer',
      })

      expect(result.region).toBe('Taiwan')
      expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ passwordHash: 'hashed-default-password' }),
      }))
    })

    it('updates a user and invalidates their sessions', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(dbUser())
      mockPrisma.user.update.mockResolvedValueOnce(dbUser({ role: Role.Supervisor, jobLevel: 'L3' }))
      mockPrisma.session.deleteMany.mockResolvedValueOnce({ count: 2 })

      const result = await service.updateUser('u-target', { role: Role.Supervisor, jobLevel: 'L3' })

      expect(result.role).toBe(Role.Supervisor)
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-target' } })
    })

    it('throws when updating a missing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      await expect(service.updateUser('missing', { jobTitle: 'Lead' })).rejects.toThrow(NotFoundException)
    })
  })
})
