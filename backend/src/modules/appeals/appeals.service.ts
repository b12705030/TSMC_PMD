import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Role } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { isGlobalRole } from '../../common/utils/region.util'
import type { SessionUser } from '../../common/types/request.types'
import type { CreateAppealDto, RespondAppealDto } from './dto/appeal.dto'

const APPEAL_INCLUDE = {
  employee: { select: { id: true, name: true, employeeId: true, jobTitle: true, jobLevel: true } },
  manager:  { select: { id: true, name: true } },
  review: {
    select: {
      id: true, grade: true, supervisorComment: true,
      cycle:    { select: { id: true, name: true } },
      template: { select: { id: true, name: true, questions: true } },
    },
  },
} as const

@Injectable()
export class AppealsService {
  constructor(private readonly prisma: PrismaService) {}

  // 員工提出申訴
  async createAppeal(user: SessionUser, dto: CreateAppealDto) {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id: dto.reviewId },
    })
    if (!review)                          throw new NotFoundException('找不到評核')
    if (review.employeeId !== user.id)    throw new ForbiddenException()
    if (review.status !== 'Published')    throw new BadRequestException('只有已發布的評核才能申訴')

    const existing = await this.prisma.appeal.findUnique({ where: { reviewId: dto.reviewId } })
    if (existing) throw new BadRequestException('此評核已有申訴，不可重複提交')

    // 找到員工的 Manager：employee → supervisor.managerId 或直接 employee.managerId
    const employee = await this.prisma.user.findUnique({
      where:   { id: user.id },
      include: { supervisor: true },
    })
    const managerId = employee?.supervisor?.managerId ?? employee?.managerId
    if (!managerId) throw new BadRequestException('找不到您的上級經理，無法提出申訴')

    const [appeal] = await this.prisma.$transaction([
      this.prisma.appeal.create({
        data:    { reviewId: dto.reviewId, employeeId: user.id, managerId, reason: dto.reason },
        include: APPEAL_INCLUDE,
      }),
      this.prisma.performanceReview.update({
        where: { id: dto.reviewId },
        data:  { status: 'Appealed' },
      }),
    ])
    return appeal
  }

  // Manager / Admin / RegionalHR 查看申訴清單
  async getAppealsForManager(user: SessionUser) {
    if (isGlobalRole(user)) {
      return this.prisma.appeal.findMany({
        include: APPEAL_INCLUDE,
        orderBy: { createdAt: 'desc' },
      })
    }

    if (user.role === Role.RegionalHR) {
      return this.prisma.appeal.findMany({
        where:   { employee: { regionId: user.regionId } },
        include: APPEAL_INCLUDE,
        orderBy: { createdAt: 'desc' },
      })
    }

    // Manager: 只看指派給自己的申訴
    return this.prisma.appeal.findMany({
      where:   { managerId: user.id },
      include: APPEAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  // 取得單筆申訴（當事員工、指定 Manager、RegionalHR 同地區、或 Admin/GlobalHR 可看）
  async getAppealById(id: string, user: SessionUser) {
    const appeal = await this.prisma.appeal.findUnique({
      where:   { id },
      include: APPEAL_INCLUDE,
    })
    if (!appeal) throw new NotFoundException()

    if (isGlobalRole(user)) return appeal

    if (user.role === Role.RegionalHR) {
      const emp = await this.prisma.user.findUnique({ where: { id: appeal.employeeId } })
      if (emp?.regionId !== user.regionId) throw new ForbiddenException()
      return appeal
    }

    if (user.id !== appeal.employeeId && user.id !== appeal.managerId) {
      throw new ForbiddenException()
    }
    return appeal
  }

  // Manager / Admin 回覆並解決申訴（可選調整等第）
  async respondToAppeal(id: string, user: SessionUser, dto: RespondAppealDto) {
    const appeal = await this.prisma.appeal.findUnique({ where: { id } })
    if (!appeal)                                                           throw new NotFoundException()
    if (!isGlobalRole(user) && appeal.managerId !== user.id)               throw new ForbiddenException()
    if (appeal.status === 'Resolved')                                      throw new BadRequestException('此申訴已解決')

    const [updatedAppeal] = await this.prisma.$transaction([
      this.prisma.appeal.update({
        where:   { id },
        data:    { managerResponse: dto.response, status: 'Resolved', resolvedAt: new Date() },
        include: APPEAL_INCLUDE,
      }),
      this.prisma.performanceReview.update({
        where: { id: appeal.reviewId },
        data:  {
          status: 'Published',
          ...(dto.newGrade && { grade: dto.newGrade }),
        },
      }),
    ])
    return updatedAppeal
  }
}
