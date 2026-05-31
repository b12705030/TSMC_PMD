import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { Prisma, Role, ReviewStatus } from '@prisma/client'
import { isGlobalRole } from '../../common/utils/region.util'
import type { SessionUser } from '../../common/types/request.types'
import type { SaveAnswersDto, SaveSupervisorReviewDto, CalibrateDto } from './dto/review.dto'
import { validateReviewAnswers } from './review-answers.util'

const REVIEW_INCLUDE = {
  cycle:      true,
  template:   { include: { questions: { orderBy: { orderIndex: 'asc' as const } } } },
  employee:   { select: { id: true, name: true, employeeId: true, jobLevel: true, jobTitle: true, departmentId: true, managerId: true, regionId: true } },
  supervisor: { select: { id: true, name: true, employeeId: true } },
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getMyReviews(userId: string) {
    const reviews = await this.prisma.performanceReview.findMany({
      where:   { employeeId: userId },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return reviews.map((r) => this.scopeQuestions(r))
  }

  async getReview(id: string, user: SessionUser) {
    const review = await this.prisma.performanceReview.findUnique({
      where:   { id },
      include: REVIEW_INCLUDE,
    })
    if (!review) throw new NotFoundException('Review not found')
    await this.assertAccess(review, user)
    return this.scopeQuestions(review)
  }

  // Supervisor: reviews waiting for their action
  async getTeamReviews(user: SessionUser) {
    if (isGlobalRole(user)) {
      const reviews = await this.prisma.performanceReview.findMany({
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
      })
      return reviews.map((r) => this.scopeQuestions(r))
    }
    if (user.role === Role.RegionalHR) {
      const reviews = await this.prisma.performanceReview.findMany({
        where:   { employee: { regionId: user.regionId } },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
      })
      return reviews.map((r) => this.scopeQuestions(r))
    }
    if (user.role === Role.Supervisor) {
      const reviews = await this.prisma.performanceReview.findMany({
        where:   { supervisorId: user.id },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
      })
      return reviews.map((r) => this.scopeQuestions(r))
    }
    if (user.role === Role.Manager) {
      const reviews = await this.prisma.performanceReview.findMany({
        where: {
          OR: [
            { employee: { supervisor: { managerId: user.id } } },
            { employee: { managerId: user.id, supervisorId: null } },
          ],
        },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
      })
      return reviews.map((r) => this.scopeQuestions(r))
    }
    throw new ForbiddenException()
  }

  // Manager: all reviews in a cycle for calibration
  async getCycleReviews(cycleId: string, user: SessionUser) {
    if (user.role !== Role.Manager && user.role !== Role.RegionalHR && !isGlobalRole(user)) {
      throw new ForbiddenException()
    }

    if (user.role === Role.RegionalHR) {
      const reviews = await this.prisma.performanceReview.findMany({
        where:   { cycleId, employee: { regionId: user.regionId } },
        include: REVIEW_INCLUDE,
        orderBy: [{ grade: 'asc' }, { rank: 'asc' }, { createdAt: 'asc' }],
      })
      return reviews.map((r) => this.scopeQuestions(r))
    }

    const where = isGlobalRole(user)
      ? { cycleId }
      : {
          cycleId,
          OR: [
            { employee: { supervisor: { managerId: user.id } } },
            { employee: { managerId: user.id, supervisorId: null } },
          ],
        }
    const reviews = await this.prisma.performanceReview.findMany({
      where,
      include: REVIEW_INCLUDE,
      orderBy: [{ grade: 'asc' }, { rank: 'asc' }, { createdAt: 'asc' }],
    })
    return reviews.map((r) => this.scopeQuestions(r))
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
    const review = await this.prisma.performanceReview.findUnique({
      where:   { id },
      include: {
        template: { include: { questions: true } },
        employee: { select: { departmentId: true } },
      },
    })
    if (!review) throw new NotFoundException('Review not found')
    if (review.employeeId !== user.id) throw new ForbiddenException()
    if (review.status !== ReviewStatus.PendingEmployeeSubmit) throw new ForbiddenException('Already submitted')

    const scopedQuestions = review.template.questions.filter(
      (q) => q.scopeDepartmentId === null || q.scopeDepartmentId === review.employee.departmentId
    )
    validateReviewAnswers(
      review.employeeAnswers as { questionId: string; answer: string }[],
      scopedQuestions,
    )

    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data:  { status: ReviewStatus.PendingSupervisorReview },
    })
    // 通知 Supervisor（或直屬 Manager）：員工已提交自評
    const recipientId = review.supervisorId
      ?? (await this.prisma.user.findUnique({ where: { id: review.employeeId }, select: { managerId: true } }))?.managerId
    if (recipientId) {
      void this.notifications.createForUsers([recipientId], {
        type:    'ReviewSubmitted',
        title:   '員工自評已完成',
        message: `${user.name} 已提交自評，請前往填寫評核。`,
      })
    }
    return updated
  }

  // Supervisor / Manager (for direct-reports): save review (draft)
  async saveSupervisorReview(id: string, user: SessionUser, dto: SaveSupervisorReviewDto) {
    const review = await this.prisma.performanceReview.findUnique({
      where:   { id },
      include: { employee: { select: { managerId: true } } },
    })
    if (!review) throw new NotFoundException('Review not found')
    const isReviewer = review.supervisorId === user.id ||
      (review.supervisorId === null && review.employee.managerId === user.id)
    if (!isReviewer) throw new ForbiddenException()
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

  // Supervisor / Manager (for direct-reports): submit → status moves to PendingManagerApproval
  async submitSupervisor(id: string, user: SessionUser) {
    const review = await this.prisma.performanceReview.findUnique({
      where:   { id },
      include: {
        template: { include: { questions: true } },
        employee: { select: { managerId: true, departmentId: true } },
      },
    })
    if (!review) throw new NotFoundException('Review not found')
    const isReviewer = review.supervisorId === user.id ||
      (review.supervisorId === null && review.employee.managerId === user.id)
    if (!isReviewer) throw new ForbiddenException()
    if (review.status !== ReviewStatus.PendingSupervisorReview) throw new ForbiddenException()

    const scopedQuestions = review.template.questions.filter(
      (q) => q.scopeDepartmentId === null || q.scopeDepartmentId === review.employee.departmentId
    )
    validateReviewAnswers(
      review.supervisorAnswers as { questionId: string; answer: string }[],
      scopedQuestions,
      true,  // supervisor per-question comments are optional
    )

    if (!review.grade) {
      throw new BadRequestException('請先選擇等第才能送出評核')
    }

    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data:  { status: ReviewStatus.PendingManagerApproval },
    })
    // 通知 Manager：Supervisor 已完成初評
    const managerId = review.employee.managerId
    if (managerId) {
      void this.notifications.createForUsers([managerId], {
        type:    'ReviewApproved',
        title:   '主管初評已完成',
        message: `${user.name} 已完成評核初評，請前往進行校準。`,
      })
    }
    return updated
  }

  // Manager: calibrate a single review (set grade / rank)
  async calibrate(id: string, user: SessionUser, dto: CalibrateDto) {
    const review = await this.findAndCheck(id)
    if (user.role !== Role.Manager && !isGlobalRole(user)) throw new ForbiddenException()
    if (review.status !== ReviewStatus.PendingManagerApproval) throw new ForbiddenException()
    await this.assertAccess(review, user)
    return this.prisma.performanceReview.update({
      where: { id },
      data:  { grade: dto.grade, ...(dto.rank !== undefined && { rank: dto.rank }) },
    })
  }

  // Supervisor / Manager: reviews for a specific employee
  async getReviewsByEmployee(employeeId: string, user: SessionUser) {
    if (user.role !== Role.Supervisor && user.role !== Role.Manager && !isGlobalRole(user)) {
      throw new ForbiddenException()
    }
    const employee = await this.prisma.user.findUnique({
      where:   { id: employeeId },
      include: { supervisor: true },
    })
    if (!employee) throw new NotFoundException('Employee not found')

    // Region isolation
    if (!isGlobalRole(user) && employee.regionId !== user.regionId) throw new ForbiddenException()

    if (user.role === Role.Supervisor && employee.supervisorId !== user.id) throw new ForbiddenException()
    if (user.role === Role.Manager) {
      const isDirectReport = employee.managerId === user.id && !employee.supervisorId
      const isViaSuper     = employee.supervisor?.managerId === user.id
      if (!isDirectReport && !isViaSuper) throw new ForbiddenException()
    }
    const reviews = await this.prisma.performanceReview.findMany({
      where:   { employeeId },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return reviews.map((r) => this.scopeQuestions(r))
  }

  // Manager: publish all PendingManagerApproval reviews in a cycle
  async publishAll(cycleId: string, user: SessionUser) {
    if (user.role !== Role.Manager && !isGlobalRole(user)) throw new ForbiddenException()
    const pending = await this.prisma.performanceReview.findMany({
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
      select: { id: true, grade: true },
    })

    const missingGrade = pending.filter((r) => !r.grade)
    if (missingGrade.length > 0) {
      throw new BadRequestException(
        `有 ${missingGrade.length} 份評核尚未設定等第，請完成校準後再發布。`,
      )
    }

    await this.prisma.performanceReview.updateMany({
      where: { id: { in: pending.map((r) => r.id) } },
      data:  { status: ReviewStatus.Published, publishedAt: new Date() },
    })
    // 通知所有受影響的員工：評核結果已發布
    const employeeIds = (await this.prisma.performanceReview.findMany({
      where:  { id: { in: pending.map((r) => r.id) } },
      select: { employeeId: true },
    })).map((r) => r.employeeId)
    if (employeeIds.length) {
      void this.notifications.createForUsers(employeeIds, {
        type:    'ReviewPublished',
        title:   '績效評核結果已發布',
        message: '你的績效評核結果已發布，請前往查看。',
      })
    }
  }

  async getReviewStats(user: SessionUser) {
    let where: Prisma.PerformanceReviewWhereInput = {}
    if (user.role === Role.Supervisor) {
      where = { supervisorId: user.id }
    } else if (user.role === Role.Manager) {
      where = {
        OR: [
          { employee: { supervisor: { managerId: user.id } } },
          { employee: { managerId: user.id, supervisorId: null } },
        ],
      }
    } else if (user.role === Role.RegionalHR) {
      where = { employee: { regionId: user.regionId } }
    }
    // Admin 和 GlobalHR：where = {} → 全域統計

    const reviews = await this.prisma.performanceReview.findMany({
      where,
      select: { status: true, grade: true },
    })

    const gradeDistribution: Record<string, number> = {}
    const statusCount: Record<string, number> = {}
    for (const r of reviews) {
      if (r.grade) gradeDistribution[r.grade] = (gradeDistribution[r.grade] ?? 0) + 1
      // Supervisors must not know a review is under appeal — count Appealed as Published
      const displayStatus = user.role === Role.Supervisor && r.status === ReviewStatus.Appealed
        ? ReviewStatus.Published
        : r.status
      statusCount[displayStatus] = (statusCount[displayStatus] ?? 0) + 1
    }

    return { total: reviews.length, gradeDistribution, statusCount }
  }

  private scopeQuestions<T extends {
    template: { questions: { scopeDepartmentId: string | null }[] }
    employee: { departmentId: string }
  }>(review: T): T {
    return {
      ...review,
      template: {
        ...review.template,
        questions: review.template.questions.filter(
          (q) => q.scopeDepartmentId === null || q.scopeDepartmentId === review.employee.departmentId
        ),
      },
    }
  }

  private async findAndCheck(id: string) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } })
    if (!review) throw new NotFoundException('Review not found')
    return review
  }

  private async assertAccess(review: { employeeId: string; supervisorId: string | null }, user: SessionUser) {
    if (isGlobalRole(user)) return
    if (review.employeeId === user.id) return
    if (review.supervisorId === user.id) return

    // RegionalHR can access any review within their region
    if (user.role === Role.RegionalHR) {
      const emp = await this.prisma.user.findUnique({ where: { id: review.employeeId } })
      if (emp?.regionId !== user.regionId) throw new ForbiddenException()
      return
    }

    if (user.role === Role.Manager) {
      const employee = await this.prisma.user.findUnique({
        where:   { id: review.employeeId },
        include: { supervisor: true },
      })
      if (!employee) throw new ForbiddenException()
      // Region check
      if (employee.regionId !== user.regionId) throw new ForbiddenException()
      const isDirectReport = employee.managerId === user.id && !employee.supervisorId
      const isViaSuper     = employee.supervisor?.managerId === user.id
      if (isDirectReport || isViaSuper) return
    }

    throw new ForbiddenException()
  }
}
