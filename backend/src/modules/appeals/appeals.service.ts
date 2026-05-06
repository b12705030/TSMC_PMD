import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
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

  // Manager 查看自己收到的申訴清單
  async getAppealsForManager(managerId: string) {
    return this.prisma.appeal.findMany({
      where:   { managerId },
      include: APPEAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  // 取得單筆申訴（只有當事員工和指定 Manager 可看，主管不可見）
  async getAppealById(id: string, user: SessionUser) {
    const appeal = await this.prisma.appeal.findUnique({
      where:   { id },
      include: APPEAL_INCLUDE,
    })
    if (!appeal) throw new NotFoundException()
    if (user.id !== appeal.employeeId && user.id !== appeal.managerId) {
      throw new ForbiddenException()
    }
    return appeal
  }

  // Manager 回覆並解決申訴（可選調整等第）
  async respondToAppeal(id: string, user: SessionUser, dto: RespondAppealDto) {
    const appeal = await this.prisma.appeal.findUnique({ where: { id } })
    if (!appeal)                        throw new NotFoundException()
    if (appeal.managerId !== user.id)   throw new ForbiddenException()
    if (appeal.status === 'Resolved')   throw new BadRequestException('此申訴已解決')

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
          ...(dto.newGrade && { grade: dto.newGrade as any }),
        },
      }),
    ])
    return updatedAppeal
  }
}
