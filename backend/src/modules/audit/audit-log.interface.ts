export type AuditOutcome = 'SUCCESS' | 'FORBIDDEN'

export interface AuditLogEntry {
  userId: string
  userName: string
  action: string
  outcome: AuditOutcome
  resource: string
  resourceId?: string
  detail?: Record<string, unknown>
  httpMethod?: string
  httpPath?: string
  httpStatus?: number
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}
