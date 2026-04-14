import type { Request } from 'express'
import type { Role } from '../enums/role.enum'

export interface SessionUser {
  id: string
  employeeId: string
  name: string
  email: string
  role: Role
  region: string
  department: string
  jobLevel: string
  jobTitle: string
}

export interface RequestWithUser extends Request {
  user: SessionUser
}
