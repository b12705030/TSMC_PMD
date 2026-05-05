import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { CycleStatus, Role, TemplateStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { SessionUser } from '../../common/types/request.types'
import type { CreateCycleDto } from './dto/create-cycle.dto'
import type { UpdateCycleDto } from './dto/update-cycle.dto'

// Valid forward-only status transitions
const NEXT_STATUS: Record<CycleStatus, CycleStatus | null> = {
  GoalSetting: CycleStatus.InProgress,
  InProgress:  CycleStatus.UnderReview,
  UnderReview: CycleStatus.Completed,
  Completed:   null,
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
    const updated = await this.prisma.performanceCycle.update({
      where: { id },
      data:  { status: next },
    })
    if (next === CycleStatus.InProgress) {
      await this.autoCreateReviews(cycle.id, cycle.regions)
    }
    return updated
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
