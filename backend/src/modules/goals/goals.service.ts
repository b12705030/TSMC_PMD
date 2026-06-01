import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { Role } from '../../common/enums/role.enum'
import { isGlobalRole } from '../../common/utils/region.util'
import type { SessionUser } from '../../common/types/request.types'
import type { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto'

const GOAL_INCLUDE = {
  progressUpdates: { orderBy: { createdAt: 'asc' as const } },
  milestones:      { orderBy: { orderIndex: 'asc' as const } },
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getMyGoals(userId: string) {
    return this.prisma.goal.findMany({
      where:   { userId },
      include: GOAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getGoal(id: string, user: SessionUser) {
    const goal = await this.prisma.goal.findUnique({
      where:   { id },
      include: GOAL_INCLUDE,
    })
    if (!goal) throw new NotFoundException('Goal not found')
    await this.assertCanRead(goal.userId, user)
    return goal
  }

  async createGoal(user: SessionUser, dto: CreateGoalDto) {
    if (dto.cycleId) {
      const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: dto.cycleId } })
      if (!cycle) throw new BadRequestException('Cycle not found')
      if (!isGlobalRole(user) && cycle.regionId !== user.regionId) {
        throw new ForbiddenException('Cycle does not belong to your region')
      }
      if (cycle.status !== 'GoalSetting' && cycle.status !== 'InProgress') {
        throw new BadRequestException('Goals can only be linked to active cycles (GoalSetting or InProgress)')
      }
    }

    return this.prisma.goal.create({
      data: {
        userId:      user.id,
        cycleId:     dto.cycleId ?? null,
        title:       dto.title,
        description: dto.description,
        metric:      dto.metric,
        targetValue: dto.targetValue,
        relevance:   dto.relevance,
        dueDate:     new Date(dto.dueDate),
        type:        dto.type ?? 'Personal',
      },
      include: GOAL_INCLUDE,
    })
  }

  async updateGoal(id: string, user: SessionUser, dto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findUnique({ where: { id } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)
    // 只有 Draft 或 Rejected 的目標才可以編輯
    if (goal.status !== 'Draft' && goal.status !== 'Rejected') {
      throw new ForbiddenException('Goal cannot be edited in its current status')
    }

    return this.prisma.goal.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: GOAL_INCLUDE,
    })
  }

  async addProgressUpdate(goalId: string, user: SessionUser, content: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)

    return this.prisma.progressUpdate.create({
      data: { goalId, userId: user.id, content },
    })
  }

  async getTeamGoals(user: SessionUser) {
    // 根據角色決定哪些員工屬於這個主管/經理
    let subordinateIds: string[] = []

    if (user.role === Role.Supervisor) {
      const members = await this.prisma.user.findMany({
        where:  { supervisorId: user.id },
        select: { id: true },
      })
      subordinateIds = members.map((m) => m.id)
    } else if (user.role === Role.Manager) {
      // 直屬（無 supervisor）+ supervisor 底下的員工
      const direct = await this.prisma.user.findMany({
        where:  { managerId: user.id, supervisorId: null },
        select: { id: true },
      })
      const viaSup = await this.prisma.user.findMany({
        where:  { supervisor: { managerId: user.id } },
        select: { id: true },
      })
      subordinateIds = [...direct, ...viaSup].map((m) => m.id)
    } else if (isGlobalRole(user)) {
      // GlobalHR / Admin：看整個 region 或全部
      const members = await this.prisma.user.findMany({
        where:  user.role === Role.Admin ? {} : { regionId: user.regionId },
        select: { id: true },
      })
      subordinateIds = members.map((m) => m.id)
    } else {
      throw new ForbiddenException()
    }

    if (subordinateIds.length === 0) return []

    const goals = await this.prisma.goal.findMany({
      where: {
        userId:   { in: subordinateIds },
        status:   { not: 'Draft' },   // 草稿不給主管看，員工送出後才可見
      },
      include: {
        ...GOAL_INCLUDE,
        user:  { select: { id: true, name: true, employeeId: true, jobTitle: true, jobLevel: true } },
        cycle: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    return goals
  }

  async getGoalsByEmployee(employeeId: string, user: SessionUser) {
    const isSupervisor = user.role === Role.Supervisor
    const isManager    = user.role === Role.Manager

    if (!isSupervisor && !isManager && !isGlobalRole(user)) {
      throw new ForbiddenException()
    }

    const employee = await this.prisma.user.findUnique({
      where:   { id: employeeId },
      include: { supervisor: true },
    })
    if (!employee) throw new NotFoundException('Employee not found')

    // Region isolation: non-global roles cannot access employees outside their region
    if (!isGlobalRole(user) && employee.regionId !== user.regionId) throw new ForbiddenException()

    if (isSupervisor && employee.supervisorId !== user.id) throw new ForbiddenException()
    if (isManager) {
      const isDirectReport = employee.managerId === user.id && !employee.supervisorId
      const isViaSuper     = employee.supervisor?.managerId === user.id
      if (!isDirectReport && !isViaSuper) throw new ForbiddenException()
    }

    return this.prisma.goal.findMany({
      where:   { userId: employeeId, status: { not: 'Draft' } },  // 草稿不給主管看
      include: GOAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async approveGoal(id: string, user: SessionUser) {
    if (user.role !== Role.Supervisor && user.role !== Role.Manager && !isGlobalRole(user)) {
      throw new ForbiddenException()
    }
    const goal = await this.prisma.goal.findUnique({ where: { id } })
    if (!goal) throw new NotFoundException('Goal not found')
    if (goal.status !== 'PendingApproval') throw new ForbiddenException('Goal is not pending approval')
    await this.assertCanRead(goal.userId, user)
    const updated = await this.prisma.goal.update({ where: { id }, data: { status: 'Approved' }, include: GOAL_INCLUDE })
    // 通知員工：目標已核准
    void this.notifications.createForUsers([goal.userId], {
      type:    'GoalApproved',
      title:   '目標已核准',
      message: `「${updated.title}」已由主管核准，請繼續努力達成目標！`,
    })
    return updated
  }

  async rejectGoal(id: string, user: SessionUser, reason?: string) {
    if (user.role !== Role.Supervisor && user.role !== Role.Manager && !isGlobalRole(user)) {
      throw new ForbiddenException()
    }
    const goal = await this.prisma.goal.findUnique({ where: { id } })
    if (!goal) throw new NotFoundException('Goal not found')
    if (goal.status !== 'PendingApproval') throw new ForbiddenException('Goal is not pending approval')
    await this.assertCanRead(goal.userId, user)
    const updated = await this.prisma.goal.update({
      where: { id },
      data:  { status: 'Rejected', rejectionReason: reason ?? null },
      include: GOAL_INCLUDE,
    })
    // 通知員工：目標被退回
    void this.notifications.createForUsers([goal.userId], {
      type:    'GoalRejected',
      title:   '目標已被退回',
      message: reason
        ? `「${updated.title}」已被退回，退回原因：${reason}`
        : `「${updated.title}」已被退回，請修改後重新提交。`,
    })
    return updated
  }

  async submitGoal(id: string, user: SessionUser) {
    const goal = await this.prisma.goal.findUnique({ where: { id } })
    if (!goal) throw new NotFoundException('Goal not found')
    if (goal.userId !== user.id) throw new ForbiddenException()
    if (goal.status !== 'Draft' && goal.status !== 'Rejected') {
      throw new ForbiddenException('Goal must be in Draft or Rejected status to submit')
    }
    const updated = await this.prisma.goal.update({
      where: { id },
      data:  { status: 'PendingApproval', rejectionReason: null }, // 重新提交時清除退回原因
      include: GOAL_INCLUDE,
    })
    // 通知主管與經理：有新目標待審核
    const employee = await this.prisma.user.findUnique({
      where:  { id: user.id },
      select: { name: true, supervisorId: true, managerId: true },
    })
    const recipientIds = [employee?.supervisorId, employee?.managerId]
      .filter((v): v is string => !!v)
    if (recipientIds.length) {
      void this.notifications.createForUsers(recipientIds, {
        type:    'GoalSubmitted',
        title:   '新目標待審核',
        message: `${user.name} 提交了目標「${updated.title}」，請前往團隊目標審核。`,
      })
    }
    return updated
  }

  async addMilestone(goalId: string, user: SessionUser, title: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)

    const last = await this.prisma.goalMilestone.findFirst({
      where:   { goalId },
      orderBy: { orderIndex: 'desc' },
    })
    return this.prisma.goalMilestone.create({
      data: { goalId, title, orderIndex: (last?.orderIndex ?? -1) + 1 },
    })
  }

  async toggleMilestone(goalId: string, milestoneId: string, user: SessionUser, note?: string) {
    const milestone = await this.prisma.goalMilestone.findUnique({ where: { id: milestoneId } })
    if (milestone?.goalId !== goalId) throw new NotFoundException('Milestone not found')

    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)

    const isCompleting = !milestone.completedAt
    return this.prisma.goalMilestone.update({
      where: { id: milestoneId },
      data: {
        completedAt: isCompleting ? new Date() : null,
        note:        isCompleting ? (note ?? null) : null,
      },
    })
  }

  async updateMilestoneNote(goalId: string, milestoneId: string, user: SessionUser, note: string | null) {
    const milestone = await this.prisma.goalMilestone.findUnique({ where: { id: milestoneId } })
    if (milestone?.goalId !== goalId) throw new NotFoundException('Milestone not found')
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)
    return this.prisma.goalMilestone.update({ where: { id: milestoneId }, data: { note } })
  }

  async updateMilestoneUrl(goalId: string, milestoneId: string, user: SessionUser, url: string | null) {
    const milestone = await this.prisma.goalMilestone.findUnique({ where: { id: milestoneId } })
    if (milestone?.goalId !== goalId) throw new NotFoundException('Milestone not found')
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)
    return this.prisma.goalMilestone.update({ where: { id: milestoneId }, data: { url } })
  }

  async reorderMilestones(goalId: string, ids: string[], user: SessionUser) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.goalMilestone.updateMany({
          where: { id, goalId },
          data: { orderIndex: index },
        })
      )
    )
  }

  async deleteMilestone(goalId: string, milestoneId: string, user: SessionUser) {
    const milestone = await this.prisma.goalMilestone.findUnique({ where: { id: milestoneId } })
    if (milestone?.goalId !== goalId) throw new NotFoundException('Milestone not found')

    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)

    await this.prisma.goalMilestone.delete({ where: { id: milestoneId } })
  }

  async deleteGoal(id: string, user: SessionUser) {
    const goal = await this.prisma.goal.findUnique({ where: { id } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertOwner(goal.userId, user)
    if (goal.status !== 'Draft') throw new BadRequestException('只有草稿目標可以刪除')
    await this.prisma.goal.delete({ where: { id } })
  }

  private assertOwner(goalOwnerId: string, user: SessionUser) {
    if (isGlobalRole(user)) return
    if (goalOwnerId !== user.id) throw new ForbiddenException()
  }

  private async assertCanRead(goalOwnerId: string, user: SessionUser) {
    if (isGlobalRole(user)) return
    if (goalOwnerId === user.id) return

    // RegionalHR can read any goal within their region
    if (user.role === Role.RegionalHR) {
      const employee = await this.prisma.user.findUnique({ where: { id: goalOwnerId } })
      if (employee?.regionId !== user.regionId) throw new ForbiddenException()
      return
    }

    if (user.role === Role.Supervisor || user.role === Role.Manager) {
      const employee = await this.prisma.user.findUnique({
        where:   { id: goalOwnerId },
        include: { supervisor: true },
      })
      if (!employee) throw new ForbiddenException()

      // Region check: supervisor/manager cannot cross region boundaries
      if (employee.regionId !== user.regionId) throw new ForbiddenException()

      if (user.role === Role.Supervisor && employee.supervisorId === user.id) return
      if (user.role === Role.Manager) {
        const isDirectReport = employee.managerId === user.id && !employee.supervisorId
        const isViaSuper     = employee.supervisor?.managerId === user.id
        if (isDirectReport || isViaSuper) return
      }
    }

    throw new ForbiddenException()
  }
}
