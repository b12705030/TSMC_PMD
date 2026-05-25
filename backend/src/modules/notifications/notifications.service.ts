import { Injectable } from '@nestjs/common'
import { NotificationType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { SessionUser } from '../../common/types/request.types'

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(user: SessionUser) {
    return this.prisma.notification.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })
  }

  async getUnreadCount(user: SessionUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, read: false },
    })
    return { count }
  }

  async markRead(id: string, user: SessionUser) {
    return this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data:  { read: true },
    })
  }

  async markAllRead(user: SessionUser) {
    return this.prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data:  { read: true },
    })
  }

  // ─── Internal helpers (called by CyclesService / Scheduler) ─────────────────

  async createForUsers(
    userIds: string[],
    payload: { type: NotificationType; title: string; message: string; cycleId?: string },
  ) {
    if (!userIds.length) return
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type:    payload.type,
        title:   payload.title,
        message: payload.message,
        cycleId: payload.cycleId ?? null,
      })),
      skipDuplicates: true,
    })
  }

  /** 取得某一週期所有參與者的 userId（員工 + 主管 + 該地區 HR / Manager） */
  async getCycleParticipantIds(cycleId: string): Promise<string[]> {
    const cycle = await this.prisma.performanceCycle.findUnique({
      where: { id: cycleId },
      select: { regionId: true },
    })
    if (!cycle) return []

    const [reviewUsers, hrManagers] = await Promise.all([
      // 有評核記錄的員工與主管
      this.prisma.performanceReview.findMany({
        where:  { cycleId },
        select: { employeeId: true, supervisorId: true },
      }),
      // 同地區的 HR 和 Manager
      this.prisma.user.findMany({
        where:  { regionId: cycle.regionId, role: { in: ['RegionalHR', 'Manager'] } },
        select: { id: true },
      }),
    ])

    const ids = new Set<string>()
    for (const r of reviewUsers) {
      ids.add(r.employeeId)
      if (r.supervisorId) ids.add(r.supervisorId)
    }
    for (const u of hrManagers) ids.add(u.id)

    return [...ids]
  }
}
