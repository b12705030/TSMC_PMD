import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Role } from '../enums/role.enum'
import { RolesGuard } from './roles.guard'
import type { SessionUser } from '../types/request.types'

function makeContext(role: Role): ExecutionContext {
  const request = { user: { role } as SessionUser }
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext
}

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>
  let guard: RolesGuard

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() }
    guard = new RolesGuard(reflector as unknown as Reflector)
  })

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined)
    expect(guard.canActivate(makeContext(Role.Employee))).toBe(true)
  })

  it('allows access when user has a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.Admin, Role.Manager])
    expect(guard.canActivate(makeContext(Role.Manager))).toBe(true)
  })

  it('throws ForbiddenException when user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.Admin])
    expect(() => guard.canActivate(makeContext(Role.Employee))).toThrow(ForbiddenException)
  })
})
