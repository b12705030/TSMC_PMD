import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Role, ReviewStatus } from '@prisma/client'
import type { SessionUser } from '../../common/types/request.types'
import type { SaveAnswersDto, SaveSupervisorReviewDto, CalibrateDto } from './dto/review.dto'

const REVIEW_INCLUDE = {
  cycle:      true,
  template:   { include: { questions: { orderBy: { orderIndex: 'asc' as const } } } },
  employee:   { select: { id: true, name: true, employeeId: true, jobLevel: true, jobTitle: true } },
  supervisor: { select: { id: true, name: true, employeeId: true } },
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyReviews(userId: string) {
    return this.prisma.performanceReview.findMany({
      where:   { employeeId: userId },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getReview(id: string, user: SessionUser) {
    const review = await this.prisma.performanceReview.findUnique({
      where:   { id },
      include: REVIEW_INCLUDE,
    })
    if (!review) throw new NotFoundException('Review not found')
    this.assertAccess(review, user)
    return review
  }

  // Supervisor: reviews waiting for their action
  async getTeamReviews(user: SessionUser) {
    if (user.role === Role.Supervisor) {
      return this.prisma.performanceReview.findMany({
        where:   { supervisorId: user.id },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
      })
    }
    if (user.role === Role.Manager || user.role === Role.Admin) {
      return this.prisma.performanceReview.findMany({
        where: {
          OR: [
            { employee: { supervisor: { managerId: user.id } } },
            { employee: { managerId: user.id, supervisorId: null } },
          ],
        },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
      })
    }
    throw new ForbiddenException()
  }

  // Manager: all reviews in a cycle for calibration
  async getCycleReviews(cycleId: string, user: SessionUser) {
    if (user.role !== Role.Manager && user.role !== Role.Admin) throw new ForbiddenException()
    const where = user.role === Role.Admin
      ? { cycleId }
      : {
          cycleId,
          OR: [
            { employee: { supervisor: { managerId: user.id } } },
            { employee: { managerId: user.id, supervisorId: null } },
          ],
        }
    return this.prisma.performanceReview.findMany({
      where,
      include: REVIEW_INCLUDE,
      orderBy: [{ grade: 'asc' }, { rank: 'asc' }, { createdAt: 'asc' }],
    })
  }

  // Employee: save answers (draft)
  async saveEmployeeAnswers(id: string, user: SessionUser, dto: SaveAnswersDto) {
    const review = await this.findAndCheck(id)
    if (review.employeeId !== user.id) throw new ForbiddenException()
    if (review.status !== ReviewStatus.PendingEmployeeSubmit) throw new ForbiddenException('Already submitted')
    return this.prisma.performanceReview.update({
      where: { id },
      data:  { employeeAnswers: dto.answers as object[] },
    })
  }

  // Employee: submit → status moves to PendingSupervisorReview
  async submitEmployee(id: string, user: SessionUser) {
    const review = await this.findAndCheck(id)
    if (review.employeeId !== user.id) throw new ForbiddenException()
    if (review.status !== ReviewStatus.PendingEmployeeSubmit) throw new ForbiddenException('Already submitted')
    return this.prisma.performanceReview.update({
      where: { id },
      data:  { status: ReviewStatus.PendingSupervisorReview },
    })
  }

  // Supervisor: save review (draft)
  async saveSupervisorReview(id: string, user: SessionUser, dto: SaveSupervisorReviewDto) {
    const review = await this.findAndCheck(id)
    if (review.supervisorId !== user.id) throw new ForbiddenException()
    if (review.status !== ReviewStatus.PendingSupervisorReview) throw new ForbiddenException()
    return this.prisma.performanceReview.update({
      where: { id },
      data: {
        ...(dto.answers  && { supervisorAnswers: dto.answers as object[] }),
        ...(dto.comment  !== undefined && { supervisorComment: dto.comment }),
        ...(dto.grade    !== undefined && { grade: dto.grade }),
      },
    })
  }

  // Supervisor: submit → status moves to PendingManagerApproval
  async submitSupervisor(id: string, user: SessionUser) {
    const review = await this.findAndCheck(id)
    if (review.supervisorId !== user.id) throw new ForbiddenException()
    if (review.status !== ReviewStatus.PendingSupervisorReview) throw new ForbiddenException()
    return this.prisma.performanceReview.update({
      where: { id },
      data:  { status: ReviewStatus.PendingManagerApproval },
    })
  }

  // Manager: calibrate a single review (set grade / rank)
  async calibrate(id: string, user: SessionUser, dto: CalibrateDto) {
    const review = await this.findAndCheck(id)
    if (user.role !== Role.Manager && user.role !== Role.Admin) throw new ForbiddenException()
    if (review.status !== ReviewStatus.PendingManagerApproval) throw new ForbiddenException()
    return this.prisma.performanceReview.update({
      where: { id },
      data:  { grade: dto.grade, ...(dto.rank !== undefined && { rank: dto.rank }) },
    })
  }

  // Manager: publish all PendingManagerApproval reviews in a cycle
  async publishAll(cycleId: string, user: SessionUser) {
    if (user.role !== Role.Manager && user.role !== Role.Admin) throw new ForbiddenException()
    const ids = await this.prisma.performanceReview.findMany({
      where: {
        cycleId,
        status: ReviewStatus.PendingManagerApproval,
        ...(user.role === Role.Manager && {
          OR: [
            { employee: { supervisor: { managerId: user.id } } },
            { employee: { managerId: user.id, supervisorId: null } },
          ],
        }),
      },
      select: { id: true },
    })
    await this.prisma.performanceReview.updateMany({
      where: { id: { in: ids.map((r) => r.id) } },
      data:  { status: ReviewStatus.Published, publishedAt: new Date() },
    })
  }

  private async findAndCheck(id: string) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } })
    if (!review) throw new NotFoundException('Review not found')
    return review
  }

  private assertAccess(review: { employeeId: string; supervisorId: string }, user: SessionUser) {
    if (user.role === Role.Admin || user.role === Role.Manager) return
    if (review.employeeId === user.id) return
    if (review.supervisorId === user.id) return
    throw new ForbiddenException()
  }
}
