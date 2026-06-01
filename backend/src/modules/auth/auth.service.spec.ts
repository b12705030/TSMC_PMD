import { UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { AuthService } from './auth.service'
import { Role } from '../../common/enums/role.enum'

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'session-1'),
}))

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  session: {
    create:     jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
  },
}

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
}

const rawUser = {
  id:           'user-1',
  employeeId:   'emp001',
  name:         'Ada',
  email:        'ada@test.local',
  role:         Role.Employee,
  regionId:     'region-1',
  departmentId: 'dept-1',
  jobLevel:     'L2',
  jobTitle:     'Engineer',
  managerId:    null,
  supervisorId: 'sup-1',
  passwordHash: 'hash',
}

const userWithRelations = {
  ...rawUser,
  region:     { name: 'Taiwan' },
  department: { name: 'Engineering' },
}

describe('AuthService', () => {
  let service: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AuthService(mockPrisma as any, mockAudit as any)
  })

  it('creates a session and returns the user profile on successful login', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(rawUser)
      .mockResolvedValueOnce(userWithRelations)
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
    mockPrisma.session.create.mockResolvedValueOnce({})

    const result = await service.login({ employeeId: 'emp001', password: 'secret' }, '127.0.0.1')

    expect(mockPrisma.session.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'session-1', userId: 'user-1' }),
    }))
    expect(result.sessionId).toBe('session-1')
    expect(result.user.region).toBe('Taiwan')
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGIN',
      outcome: 'SUCCESS',
      userId: 'user-1',
    }))
  })

  it('rejects invalid credentials and locks after repeated failures', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    for (let i = 0; i < 5; i += 1) {
      await expect(service.login({ employeeId: 'missing', password: 'bad' }, '127.0.0.1'))
        .rejects.toThrow(UnauthorizedException)
    }

    await expect(service.login({ employeeId: 'missing', password: 'bad' }, '127.0.0.1'))
      .rejects.toThrow(/Account locked/)
  })

  it('returns the current user for a valid session', async () => {
    const expiresAt = new Date(Date.now() + 60_000)
    mockPrisma.session.findUnique.mockResolvedValueOnce({ expiresAt, user: userWithRelations })

    const result = await service.getMe('session-1')

    expect(result.id).toBe('user-1')
    expect(result.department).toBe('Engineering')
  })

  it('rejects expired sessions', async () => {
    mockPrisma.session.findUnique.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() - 60_000),
      user:      userWithRelations,
    })

    await expect(service.getMe('expired')).rejects.toThrow(UnauthorizedException)
  })

  it('deletes the session and writes an audit entry on logout', async () => {
    mockPrisma.session.deleteMany.mockResolvedValueOnce({ count: 1 })

    await service.logout('session-1', 'user-1', 'Ada', 'region-1', '127.0.0.1')

    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-1' } })
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGOUT',
      httpStatus: 204,
      userId: 'user-1',
    }))
  })
})
