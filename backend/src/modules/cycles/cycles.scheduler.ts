import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { CycleStatus, NotificationType } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { CyclesService } from './cycles.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class CyclesScheduler {
  private readonly logger = new Logger(CyclesScheduler.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cyclesService: CyclesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** 每天 00:05 執行：
   *  1. 推進已確認且到期的週期
   *  2. 對 7 天內到期但尚未確認的週期發送提醒給地區 HR
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCheck() {
    this.logger.log('Running daily cycle advance check...')
    const today = new Date(); today.setHours(0, 0, 0, 0)

    // ── 1. 自動推進已確認 + 到期的週期 ────────────────────────────────────────
    const dueForAdvance = await this.prisma.performanceCycle.findMany({
      where: {
        status:          CycleStatus.InProgress,
        advanceConfirmed: true,
        reviewStart:     { lte: today },
      },
    })

    for (const cycle of dueForAdvance) {
      try {
        // 使用 system user 推進（用 Admin 帳號或直接呼叫底層 service）
        await this.prisma.$transaction(async (tx) => {
          await tx.performanceCycle.update({
            where: { id: cycle.id },
            data:  { status: CycleStatus.EmployeeReview },
          })
          // 建立評核（複用 CyclesService 的 buildReviewRows 邏輯）
          // 這裡直接觸發 advanceStatus 內部的 transaction 邏輯
        })

        // 直接呼叫 advanceStatus（略過 HTTP 層）
        // 由於 advanceStatus 內部會做 transaction，這裡用 raw update 並自建 reviews
        await this.autoAdvanceCycle(cycle.id, cycle.regionId)

        // 通知所有參與者
        const participantIds = await this.notifications.getCycleParticipantIds(cycle.id)
        await this.notifications.createForUsers(participantIds, {
          type:    NotificationType.CycleAutoAdvanced,
          title:   '績效評核期已開始',
          message: `【${cycle.name}】已自動推進至員工自評期，請前往填寫績效表單。`,
          cycleId: cycle.id,
        })

        this.logger.log(`Auto-advanced cycle: ${cycle.name}`)
      } catch (err) {
        this.logger.error(`Failed to auto-advance cycle ${cycle.id}: ${(err as Error).message}`)
      }
    }

    // ── 2. 7 天內到期但尚未確認的週期 → 提醒地區 HR ──────────────────────────
    const sevenDaysLater = new Date(today)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

    const pendingConfirm = await this.prisma.performanceCycle.findMany({
      where: {
        status:           CycleStatus.InProgress,
        advanceConfirmed: false,
        reviewStart:      { gte: today, lte: sevenDaysLater },
      },
      include: { region: { select: { id: true } } },
    })

    for (const cycle of pendingConfirm) {
      // 找該地區的 HR
      const hrUsers = await this.prisma.user.findMany({
        where:  { regionId: cycle.regionId, role: 'RegionalHR' },
        select: { id: true },
      })
      const hrIds = hrUsers.map((u) => u.id)

      // 避免重複發送（今天已發過就跳過）
      const alreadySent = await this.prisma.notification.count({
        where: {
          cycleId:   cycle.id,
          type:      NotificationType.CycleAdvanceReminder,
          createdAt: { gte: today },
        },
      })
      if (alreadySent > 0) continue

      const reviewStartStr = cycle.reviewStart.toLocaleDateString('zh-TW')
      const daysLeft = Math.ceil((cycle.reviewStart.getTime() - today.getTime()) / 86400000)

      await this.notifications.createForUsers(hrIds, {
        type:    NotificationType.CycleAdvanceReminder,
        title:   '評核期即將開始，請確認',
        message: `【${cycle.name}】的評核期將於 ${reviewStartStr}（${daysLeft} 天後）開始，請前往週期管理頁確認是否如期推進或延期。`,
        cycleId: cycle.id,
      })

      this.logger.log(`Sent advance reminder for cycle: ${cycle.name}`)
    }
  }

  /** 自動推進週期（繞過 HTTP 層直接操作） */
  private async autoAdvanceCycle(cycleId: string, regionId: string) {
    // Build review rows
    const [employees, templates] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: 'Employee',
          regionId,
          OR: [{ supervisorId: { not: null } }, { managerId: { not: null } }],
        },
        select: { id: true, jobLevel: true, jobTitle: true, supervisorId: true },
      }),
      this.prisma.formTemplate.findMany({
        where:  { cycleId, status: 'Published' },
        select: { id: true, appliesGrades: true, applyTitles: true },
      }),
    ])

    const rows: { cycleId: string; employeeId: string; supervisorId: string | null; templateId: string }[] = []
    for (const emp of employees) {
      const tpl = templates.find(
        (t) => t.appliesGrades.includes(emp.jobLevel) && t.applyTitles.includes(emp.jobTitle),
      )
      if (!tpl) continue
      rows.push({ cycleId, employeeId: emp.id, templateId: tpl.id, supervisorId: emp.supervisorId ?? null })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.performanceCycle.update({
        where: { id: cycleId },
        data:  { status: CycleStatus.EmployeeReview },
      })
      if (rows.length) {
        await tx.performanceReview.createMany({ data: rows, skipDuplicates: true })
      }
    })
  }
}
