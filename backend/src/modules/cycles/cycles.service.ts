import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { CycleStatus, ReviewStatus, Role, TemplateStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { SessionUser } from '../../common/types/request.types'
import type { CreateCycleDto } from './dto/create-cycle.dto'
import type { UpdateCycleDto } from './dto/update-cycle.dto'

// Valid forward-only status transitions
const NEXT_STATUS: Record<CycleStatus, CycleStatus | null> = {
  GoalSetting:      CycleStatus.InProgress,
  InProgress:       CycleStatus.EmployeeReview,
  EmployeeReview:   CycleStatus.SupervisorReview,
  SupervisorReview: CycleStatus.Calibration,
  Calibration:      CycleStatus.Completed,
  Completed:        null,
}

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCycles(user: SessionUser) {
    const where = user.role === Role.Admin ? {} : { regions: { has: user.region } }
    return this.prisma.performanceCycle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getCycle(id: string, user: SessionUser) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id } })
    if (!cycle) throw new NotFoundException('Cycle not found')
    if (user.role !== Role.Admin && !cycle.regions.includes(user.region)) {
      throw new ForbiddenException()
    }
    return cycle
  }

  async createCycle(dto: CreateCycleDto, user: SessionUser) {
    // RegionalHR 只能建立含自己 region 的 cycle；Admin 可自由指定多個 region
    const regions = user.role === Role.Admin ? dto.regions : [user.region]
    return this.prisma.performanceCycle.create({
      data: {
        name:             dto.name,
        type:             dto.type,
        regions,
        goalSettingStart: new Date(dto.goalSettingStart),
        goalSettingEnd:   new Date(dto.goalSettingEnd),
        reviewStart:      new Date(dto.reviewStart),
        reviewEnd:        new Date(dto.reviewEnd),
      },
    })
  }

  async updateCycle(id: string, dto: UpdateCycleDto, user: SessionUser) {
    // 只有 Admin 可以編輯 cycle
    if (user.role !== Role.Admin) throw new ForbiddenException('Only Admin can edit cycles')
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id } })
    if (!cycle) throw new NotFoundException('Cycle not found')
    if (cycle.status !== CycleStatus.GoalSetting) {
      throw new BadRequestException('Cycle can only be edited during GoalSetting stage')
    }
    const data: Record<string, unknown> = {}
    if (dto.name)             data.name             = dto.name
    if (dto.regions)          data.regions          = dto.regions
    if (dto.goalSettingStart) data.goalSettingStart  = new Date(dto.goalSettingStart)
    if (dto.goalSettingEnd)   data.goalSettingEnd    = new Date(dto.goalSettingEnd)
    if (dto.reviewStart)      data.reviewStart       = new Date(dto.reviewStart)
    if (dto.reviewEnd)        data.reviewEnd         = new Date(dto.reviewEnd)
    return this.prisma.performanceCycle.update({ where: { id }, data })
  }

  async advanceStatus(id: string, user: SessionUser) {
    const cycle = await this.getCycle(id, user)
    const next = NEXT_STATUS[cycle.status]
    if (!next) throw new BadRequestException('Cycle is already completed')

    // Before starting employee review: check published template exists, then dry-run for coverage gaps
    if (next === CycleStatus.EmployeeReview) {
      const publishedTemplate = await this.prisma.formTemplate.findFirst({
        where: { cycleId: id, status: TemplateStatus.Published },
      })
      if (!publishedTemplate) {
        throw new BadRequestException('此週期尚未有已發布的評核模板，請先發布模板後再開始員工自評期。')
      }

      const unmatched = await this.dryRunReviews(cycle.id, cycle.regions)
      if (unmatched.length > 0) {
        throw new BadRequestException({
          message: `有 ${unmatched.length} 位員工找不到匹配的評核模板，推進前請補齊模板覆蓋範圍。`,
          unmatched,
        })
      }
    }

    // Completeness gates before advancing
    if (next === CycleStatus.SupervisorReview) {
      const pendingCount = await this.prisma.performanceReview.count({
        where: { cycleId: id, status: ReviewStatus.PendingEmployeeSubmit },
      })
      if (pendingCount > 0) {
        throw new BadRequestException(
          `尚有 ${pendingCount} 位員工未完成自評，請等所有員工提交後再推進。`,
        )
      }
    }

    if (next === CycleStatus.Calibration) {
      const pendingCount = await this.prisma.performanceReview.count({
        where: { cycleId: id, status: ReviewStatus.PendingSupervisorReview },
      })
      if (pendingCount > 0) {
        throw new BadRequestException(
          `尚有 ${pendingCount} 份評核未由主管完成審核，請等所有主管提交後再推進。`,
        )
      }
    }

    if (next === CycleStatus.Completed) {
      const pendingCount = await this.prisma.performanceReview.count({
        where: { cycleId: id, status: ReviewStatus.PendingManagerApproval },
      })
      if (pendingCount > 0) {
        throw new BadRequestException(
          `尚有 ${pendingCount} 份評核未由主管校準發布，請完成校準後再關閉週期。`,
        )
      }
    }

    const updated = await this.prisma.performanceCycle.update({
      where: { id },
      data:  { status: next },
    })

    // Auto-create PerformanceReview records when employee review period starts
    if (next === CycleStatus.EmployeeReview) {
      await this.autoCreateReviews(cycle.id, cycle.regions)
    }

    return updated
  }

  async getManagerQuestionnaireStatus(id: string, user: SessionUser) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id } })
    if (!cycle) throw new NotFoundException('Cycle not found')
    if (user.role !== Role.Admin && !cycle.regions.includes(user.region as string)) {
      throw new ForbiddenException()
    }

    // Departments that have already added custom questions to this cycle's templates
    const customQuestions = await this.prisma.templateQuestion.findMany({
      where: {
        isCustom: true,
        template: { cycleId: id },
        scopeDepartmentId: { not: null },
      },
      select:   { scopeDepartmentId: true },
      distinct: ['scopeDepartmentId'],
    })
    const activeDeptIds = new Set(customQuestions.map((q) => q.scopeDepartmentId!))

    // All managers in this cycle's regions
    const managers = await this.prisma.user.findMany({
      where: {
        role:   Role.Manager,
        region: { name: { in: cycle.regions } },
      },
      select: { id: true, name: true, departmentId: true },
    })

    return {
      complete: managers.filter((m) => activeDeptIds.has(m.departmentId)),
      pending:  managers.filter((m) => !activeDeptIds.has(m.departmentId)),
    }
  }

  // Dry-run: return employees that have no matching Published template
  private async dryRunReviews(cycleId: string, cycleRegions: string[]) {
    const [employees, templates] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.Employee, region: { name: { in: cycleRegions } }, supervisorId: { not: null } },
        select: { id: true, name: true, jobLevel: true, jobTitle: true, region: { select: { name: true } } },
      }),
      this.prisma.formTemplate.findMany({
        where: { cycleId, status: TemplateStatus.Published },
        select: { appliesGrades: true, applyTitles: true, region: { select: { name: true } } },
      }),
    ])

    return employees
      .filter((emp) => !templates.some(
        (t) =>
          t.region.name === emp.region.name &&
          t.appliesGrades.includes(emp.jobLevel) &&
          t.applyTitles.includes(emp.jobTitle),
      ))
      .map((emp) => ({ id: emp.id, name: emp.name, jobLevel: emp.jobLevel, jobTitle: emp.jobTitle, region: emp.region.name }))
  }

  // When cycle moves to InProgress: create one PerformanceReview per employee that
  // matches a Published template (by jobLevel in appliesGrades AND jobTitle in applyTitles).
  private async autoCreateReviews(cycleId: string, cycleRegions: string[]) {
    const [employees, templates] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: Role.Employee,
          region: { name: { in: cycleRegions } },
          supervisorId: { not: null },
        },
        select: {
          id: true,
          jobLevel: true,
          jobTitle: true,
          supervisorId: true,
          region: { select: { name: true } },
        },
      }),
      this.prisma.formTemplate.findMany({
        where: { cycleId, status: TemplateStatus.Published },
        select: {
          id: true,
          appliesGrades: true,
          applyTitles: true,
          region: { select: { name: true } },
        },
      }),
    ])

    const rows: { cycleId: string; employeeId: string; supervisorId: string; templateId: string }[] = []

    for (const emp of employees) {
      const tpl = templates.find(
        (t) =>
          t.region.name === emp.region.name &&
          t.appliesGrades.includes(emp.jobLevel) &&
          t.applyTitles.includes(emp.jobTitle),
      )
      if (!tpl) {
        console.warn(`autoCreateReviews: no template for employee ${emp.id} (${emp.jobLevel} / ${emp.jobTitle})`)
        continue
      }
      rows.push({ cycleId, employeeId: emp.id, supervisorId: emp.supervisorId!, templateId: tpl.id })
    }

    if (rows.length) {
      await this.prisma.performanceReview.createMany({ data: rows, skipDuplicates: true })
    }
  }
}
