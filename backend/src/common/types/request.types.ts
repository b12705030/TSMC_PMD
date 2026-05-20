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
}

export interface RequestWithUser extends Request {
  user: SessionUser
}
