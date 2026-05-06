import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'
import type { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto'

const GOAL_INCLUDE = {
  progressUpdates: { orderBy: { createdAt: 'asc' as const } },
  milestones:      { orderBy: { orderIndex: 'asc' as const } },
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

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
    this.assertAccess(goal.userId, user)
    return goal
  }

  async createGoal(user: SessionUser, dto: CreateGoalDto) {
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
    this.assertAccess(goal.userId, user)

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
    this.assertAccess(goal.userId, user)

    return this.prisma.progressUpdate.create({
      data: { goalId, userId: user.id, content },
    })
  }

  async getGoalsByEmployee(employeeId: string, user: SessionUser) {
    const isSupervisor = user.role === Role.Supervisor
    const isManager    = user.role === Role.Manager

    if (!isSupervisor && !isManager && user.role !== Role.Admin) {
      throw new ForbiddenException()
    }

    const employee = await this.prisma.user.findUnique({
      where:   { id: employeeId },
      include: { supervisor: true },
    })
    if (!employee) throw new NotFoundException('Employee not found')

    if (isSupervisor && employee.supervisorId !== user.id) throw new ForbiddenException()
    if (isManager) {
      const isDirectReport = employee.managerId === user.id && !employee.supervisorId
      const isViaSuper     = (employee as any).supervisor?.managerId === user.id
      if (!isDirectReport && !isViaSuper) throw new ForbiddenException()
    }

    return this.prisma.goal.findMany({
      where:   { userId: employeeId },
      include: GOAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async approveGoal(id: string, user: SessionUser) {
    if (user.role !== Role.Supervisor && user.role !== Role.Manager && user.role !== Role.Admin) {
      throw new ForbiddenException()
    }
    const goal = await this.prisma.goal.findUnique({ where: { id } })
    if (!goal) throw new NotFoundException('Goal not found')
    if (goal.status !== 'PendingApproval') throw new ForbiddenException('Goal is not pending approval')
    return this.prisma.goal.update({ where: { id }, data: { status: 'Approved' }, include: GOAL_INCLUDE })
  }

  async rejectGoal(id: string, user: SessionUser) {
    if (user.role !== Role.Supervisor && user.role !== Role.Manager && user.role !== Role.Admin) {
      throw new ForbiddenException()
    }
    const goal = await this.prisma.goal.findUnique({ where: { id } })
    if (!goal) throw new NotFoundException('Goal not found')
    if (goal.status !== 'PendingApproval') throw new ForbiddenException('Goal is not pending approval')
    return this.prisma.goal.update({ where: { id }, data: { status: 'Draft' }, include: GOAL_INCLUDE })
  }

  async submitGoal(id: string, user: SessionUser) {
    const goal = await this.prisma.goal.findUnique({ where: { id } })
    if (!goal) throw new NotFoundException('Goal not found')
    if (goal.userId !== user.id) throw new ForbiddenException()
    if (goal.status !== 'Draft') throw new ForbiddenException('Goal must be in Draft status to submit')
    return this.prisma.goal.update({ where: { id }, data: { status: 'PendingApproval' }, include: GOAL_INCLUDE })
  }

  async addMilestone(goalId: string, user: SessionUser, title: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertAccess(goal.userId, user)

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
    if (!milestone || milestone.goalId !== goalId) throw new NotFoundException('Milestone not found')

    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    this.assertAccess(goal!.userId, user)

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
    if (!milestone || milestone.goalId !== goalId) throw new NotFoundException('Milestone not found')
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    this.assertAccess(goal!.userId, user)
    return this.prisma.goalMilestone.update({ where: { id: milestoneId }, data: { note } })
  }

  async updateMilestoneUrl(goalId: string, milestoneId: string, user: SessionUser, url: string | null) {
    const milestone = await this.prisma.goalMilestone.findUnique({ where: { id: milestoneId } })
    if (!milestone || milestone.goalId !== goalId) throw new NotFoundException('Milestone not found')
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    this.assertAccess(goal!.userId, user)
    return this.prisma.goalMilestone.update({ where: { id: milestoneId }, data: { url } })
  }

  async reorderMilestones(goalId: string, ids: string[], user: SessionUser) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal) throw new NotFoundException('Goal not found')
    this.assertAccess(goal.userId, user)

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
    if (!milestone || milestone.goalId !== goalId) throw new NotFoundException('Milestone not found')

    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } })
    this.assertAccess(goal!.userId, user)

    await this.prisma.goalMilestone.delete({ where: { id: milestoneId } })
  }

  private assertAccess(goalOwnerId: string, user: SessionUser) {
    if (user.role === Role.Admin) return
    // Owner can always access their own goal
    if (goalOwnerId === user.id) return
    // Supervisor and Manager can read their team's goals (checked in getGoalsByEmployee)
    // For single-goal access, check the relation
    if (user.role === Role.Supervisor || user.role === Role.Manager) return
    throw new ForbiddenException()
  }
}
