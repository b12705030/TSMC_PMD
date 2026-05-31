import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { AuthGuard } from './auth.guard'
import type { PrismaService } from '../../prisma/prisma.service'

function makeContext(cookies?: Record<string, string>): ExecutionContext {
  const request: { cookies?: Record<string, string>; user?: unknown } = { cookies }
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext
}

describe('AuthGuard', () => {
  let findUnique: jest.Mock
  let sessionUpdate: jest.Mock
  let sessionDelete: jest.Mock
  let guard: AuthGuard
  let ctx: ExecutionContext

  beforeEach(() => {
    findUnique    = jest.fn()
    sessionUpdate = jest.fn().mockResolvedValue({})
    sessionDelete = jest.fn().mockResolvedValue({})
    const prisma = {
      session: { findUnique, update: sessionUpdate, delete: sessionDelete },
    } as unknown as PrismaService
    guard = new AuthGuard(prisma)
    ctx = makeContext()
  })

  it('throws when sessionId cookie is missing', async () => {
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
  })

  it('throws when session is not found', async () => {
    ctx = makeContext({ sessionId: 'missing' })
    findUnique.mockResolvedValue(null)
    await expect(guard.canActivate(ctx)).rejects.toThrow('Session expired or invalid')
  })

  it('throws when session is expired', async () => {
    ctx = makeContext({ sessionId: 'expired' })
    findUnique.mockResolvedValue({
      expiresAt: new Date('2020-01-01'),
      user: {
        id: 'u1',
        employeeId: 'e1',
        name: 'Test',
        email: 't@test.local',
        role: Role.Employee,
        regionId: 'r1',
        departmentId: 'd1',
        jobLevel: 'L2',
        jobTitle: 'Engineer',
        region: { name: 'Taiwan' },
        department: { name: 'Engineering' },
      },
    })
    await expect(guard.canActivate(ctx)).rejects.toThrow('Session expired or invalid')
  })

  it('attaches user to request when session is valid', async () => {
    ctx = makeContext({ sessionId: 'valid' })
    findUnique.mockResolvedValue({
      expiresAt:    new Date(Date.now() + 60_000),
      lastActiveAt: new Date(),                    // active just now — not idle
      user: {
        id: 'u1',
        employeeId: 'tw-emp001',
        name: 'Eric',
        email: 'e@test.local',
        role: Role.Employee,
        regionId: 'r1',
        departmentId: 'd1',
        jobLevel: 'L2',
        jobTitle: 'Process Engineer',
        region: { name: 'Taiwan' },
        department: { name: 'Process Engineering' },
      },
    })

    await expect(guard.canActivate(ctx)).resolves.toBe(true)

    const request = ctx.switchToHttp().getRequest<{ user: { employeeId: string; region: string } }>()
    expect(request.user.employeeId).toBe('tw-emp001')
    expect(request.user.region).toBe('Taiwan')
  })

  it('throws when session is idle for more than 30 minutes', async () => {
    ctx = makeContext({ sessionId: 'idle' })
    findUnique.mockResolvedValue({
      id:           'idle',
      expiresAt:    new Date(Date.now() + 60_000),
      lastActiveAt: new Date(Date.now() - 31 * 60 * 1000), // 31 min ago
      user: {
        id: 'u1',
        employeeId: 'tw-emp001',
        name: 'Eric',
        email: 'e@test.local',
        role: Role.Employee,
        regionId: 'r1',
        departmentId: 'd1',
        jobLevel: 'L2',
        jobTitle: 'Process Engineer',
        region: { name: 'Taiwan' },
        department: { name: 'Process Engineering' },
      },
    })
    await expect(guard.canActivate(ctx)).rejects.toThrow('Session idle timeout')
    expect(sessionDelete).toHaveBeenCalledWith({ where: { id: 'idle' } })
  })
})
