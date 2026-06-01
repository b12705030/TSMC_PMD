import { UnauthorizedException } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockAuthService = {
  login:  jest.fn(),
  logout: jest.fn(),
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

describe('AuthController', () => {
  let controller: AuthController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new AuthController(mockAuthService as any)
  })

  it('logs in, sets the session cookie, and returns the user', async () => {
    const dto = { employeeId: 'emp001', password: 'secret' }
    const req = { ip: '127.0.0.1', socket: { remoteAddress: '10.0.0.1' } }
    const res = { cookie: jest.fn() }
    mockAuthService.login.mockResolvedValueOnce({ sessionId: 'session-1', user })

    const result = await controller.login(dto, req as any, res as any)

    expect(mockAuthService.login).toHaveBeenCalledWith(dto, '127.0.0.1')
    expect(res.cookie).toHaveBeenCalledWith('sessionId', 'session-1', expect.objectContaining({
      httpOnly: true,
      maxAge:   1000 * 60 * 60 * 8,
    }))
    expect(result).toEqual({ user })
  })

  it('falls back to socket remote address when logging in', async () => {
    const dto = { employeeId: 'emp001', password: 'secret' }
    const req = { socket: { remoteAddress: '10.0.0.1' } }
    const res = { cookie: jest.fn() }
    mockAuthService.login.mockResolvedValueOnce({ sessionId: 'session-1', user })

    await controller.login(dto, req as any, res as any)

    expect(mockAuthService.login).toHaveBeenCalledWith(dto, '10.0.0.1')
  })

  it('uses unknown when a login request has no IP address', async () => {
    const dto = { employeeId: 'emp001', password: 'secret' }
    const req = { socket: {} }
    const res = { cookie: jest.fn() }
    mockAuthService.login.mockResolvedValueOnce({ sessionId: 'session-1', user })

    await controller.login(dto, req as any, res as any)

    expect(mockAuthService.login).toHaveBeenCalledWith(dto, 'unknown')
  })

  it('logs out with the session cookie and clears it', async () => {
    const req = { ip: '127.0.0.1', socket: {}, cookies: { sessionId: 'session-1' } }
    const res = { clearCookie: jest.fn() }
    mockAuthService.logout.mockResolvedValueOnce(undefined)

    await controller.logout(user, req as any, res as any)

    expect(mockAuthService.logout).toHaveBeenCalledWith('session-1', 'user-1', 'Ada', 'region-1', '127.0.0.1')
    expect(res.clearCookie).toHaveBeenCalledWith('sessionId')
  })

  it('falls back to unknown IP when logging out without request address data', async () => {
    const req = { socket: {}, cookies: { sessionId: 'session-1' } }
    const res = { clearCookie: jest.fn() }
    mockAuthService.logout.mockResolvedValueOnce(undefined)

    await controller.logout(user, req as any, res as any)

    expect(mockAuthService.logout).toHaveBeenCalledWith('session-1', 'user-1', 'Ada', 'region-1', 'unknown')
  })

  it('rejects logout without a session cookie', async () => {
    await expect(controller.logout(user, { cookies: {}, socket: {} } as any, { clearCookie: jest.fn() } as any))
      .rejects.toThrow(UnauthorizedException)
    expect(mockAuthService.logout).not.toHaveBeenCalled()
  })

  it('returns the current user', async () => {
    await expect(controller.getMe(user)).resolves.toBe(user)
  })
})
