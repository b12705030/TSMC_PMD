import { Role } from '@prisma/client'
import type { SessionUser } from '../types/request.types'

export function isGlobalRole(user: SessionUser): boolean {
  return user.role === Role.Admin || user.role === Role.GlobalHR
}
