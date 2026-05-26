import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuditLogEntry } from './audit-log.interface'

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          userName: entry.userName,
          userRegionId: entry.userRegionId ?? null,
          action: entry.action,
          outcome: entry.outcome,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          httpMethod: entry.httpMethod ?? null,
          httpPath: entry.httpPath ?? null,
          httpStatus: entry.httpStatus ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          detail: entry.detail as any,
        },
      })
    } catch (err) {
      this.logger.error('Failed to write audit log', err)
    }
  }

  async search(opts: {
    q?: string
    outcome?: string
    resource?: string
    regionId?: string
    fromDate?: string
    toDate?: string
    from?: number
    size?: number
  } = {}): Promise<{ data: object[]; total: number }> {
    const { q, outcome, resource, regionId, fromDate, toDate, from = 0, size = 50 } = opts

    const where: any = {}
    if (outcome) where.outcome = outcome
    if (resource) where.resource = resource
    if (regionId) where.userRegionId = regionId
    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }
    if (q) {
      where.OR = [
        { userName: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { httpPath: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: from,
        take: size,
      }),
    ])

    return { data: records, total }
  }
}
