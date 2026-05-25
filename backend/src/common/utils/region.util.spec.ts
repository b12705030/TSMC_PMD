import { Role } from '@prisma/client'
import { isGlobalRole } from './region.util'
import type { SessionUser } from '../types/request.types'

function user(role: Role): SessionUser {
  return {
    id: 'u1',
    employeeId: 'e1',
    name: 'Test',
    email: 't@test.local',
    role: role as SessionUser['role'],
    regionId: 'r1',
    region: 'Taiwan',
    departmentId: 'd1',
    department: 'Engineering',
    jobLevel: 'L2',
    jobTitle: 'Engineer',
  }
}

describe('isGlobalRole', () => {
  it('returns true for Admin', () => {
    expect(isGlobalRole(user(Role.Admin))).toBe(true)
  })

  it('returns true for GlobalHR', () => {
    expect(isGlobalRole(user(Role.GlobalHR))).toBe(true)
  })

  it('returns false for regional and line roles', () => {
    expect(isGlobalRole(user(Role.RegionalHR))).toBe(false)
    expect(isGlobalRole(user(Role.Manager))).toBe(false)
    expect(isGlobalRole(user(Role.Supervisor))).toBe(false)
    expect(isGlobalRole(user(Role.Employee))).toBe(false)
  })
})
