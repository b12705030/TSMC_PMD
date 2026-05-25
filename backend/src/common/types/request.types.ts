import type { Request } from 'express'
import type { Role } from '../enums/role.enum'

export interface SessionUser {
  id: string
  employeeId: string
  name: string
  email: string
  role: Role
  regionId: string
  region: string       // region.name — for display and backward-compat filtering
  departmentId: string
  department: string   // department.name — for display
  jobLevel: string
  jobTitle: string
  managerId?: string   // direct manager's user id (null for top-level)
  supervisorId?: string // supervisor's user id (null if none)
}

export interface RequestWithUser extends Request {
  user: SessionUser
}
