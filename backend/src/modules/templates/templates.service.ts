import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Role } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { SessionUser } from '../../common/types/request.types'
import type { CreateTemplateDto } from './dto/create-template.dto'
import type { AddCustomQuestionDto } from './dto/add-question.dto'

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplates(user: SessionUser) {
    const where = (user.role === Role.Admin || user.role === (Role as any).GlobalHR)
      ? {}
      : { region: { name: user.region } }
    const templates = await this.prisma.formTemplate.findMany({
      where,
      include: {
        region:    { select: { name: true } },
        questions: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return templates.map(({ region, ...t }) => ({ ...t, region: region.name }))
  }

  async getTemplate(id: string, user: SessionUser) {
    const template = await this.prisma.formTemplate.findUnique({
      where:   { id },
      include: {
        region:    { select: { name: true } },
        questions: { orderBy: { orderIndex: 'asc' } },
      },
    })
    if (!template) throw new NotFoundException('Template not found')
    this.assertRegionAccess(template.regionId, user)
    const { region, ...rest } = template
    return { ...rest, region: region.name }
  }

  // 依 cycleId 跨 region 分組，供 GlobalHR / Admin 比對各區模板差異
  async getTemplatesByRegion(cycleId: string) {
    const templates = await this.prisma.formTemplate.findMany({
      where:   { cycleId },
      include: {
        region:    { select: { name: true } },
        questions: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return templates.reduce<Record<string, typeof templates>>((acc, t) => {
      const key = t.region.name
      acc[key] = [...(acc[key] ?? []), t]
      return acc
    }, {})
  }

  async createTemplate(dto: CreateTemplateDto, user: SessionUser) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: dto.cycleId } })
    if (!cycle) throw new BadRequestException('Cycle not found')
    if (user.role !== Role.Admin && !cycle.regions.includes(user.region)) {
      throw new ForbiddenException('Cycle does not belong to your region')
    }

    // Resolve regionId with strict validation
    let regionId: string
    if (user.role === Role.Admin) {
      if (cycle.regions.length === 0) {
        throw new BadRequestException('此週期尚未設定 Region')
      }
      if (cycle.regions.length > 1) {
        // Multi-region: Admin must explicitly specify regionId
        if (!dto.regionId) {
          throw new BadRequestException('此週期跨多個 Region，建立模板時必須指定 regionId')
        }
        const region = await this.prisma.region.findUnique({ where: { id: dto.regionId } })
        if (!region) throw new BadRequestException('指定的 Region 不存在')
        if (!cycle.regions.includes(region.name)) {
          throw new BadRequestException('指定的 Region 不屬於此週期')
        }
        regionId = region.id
      } else {
        // Single-region: Admin inherits the only region (dto.regionId ignored)
        const region = await this.prisma.region.findFirst({ where: { name: cycle.regions[0] } })
        if (!region) throw new BadRequestException('找不到對應的 Region')
        regionId = region.id
      }
    } else {
      // RegionalHR: always uses own region; dto.regionId is ignored
      regionId = user.regionId
    }

    return this.prisma.formTemplate.create({
      data: {
        name:          dto.name,
        cycleId:       dto.cycleId,
        regionId,
        appliesGrades: dto.appliesGrades,
        applyTitles:   dto.applyTitles,
        createdById:   user.id,
        questions: {
          create: dto.questions.map((q) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            options:      q.options ?? [],
            required:     q.required,
            orderIndex:   q.orderIndex,
            isCustom:     false,
            // 只有 Admin 能在建立時設定全球鎖定
            isGlobal:     user.role === Role.Admin ? ((q as any).isGlobal ?? false) : false,
          })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    })
  }

  async addCustomQuestion(templateId: string, dto: AddCustomQuestionDto, user: SessionUser) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id: templateId } })
    if (!template) throw new NotFoundException('Template not found')
    this.assertRegionAccess(template.regionId, user)

    const maxOrder = await this.prisma.templateQuestion.aggregate({
      where: { templateId },
      _max: { orderIndex: true },
    })
    const nextOrder = (maxOrder._max.orderIndex ?? -1) + 1

    return this.prisma.templateQuestion.create({
      data: {
        templateId,
        questionText:      dto.questionText,
        questionType:      dto.questionType,
        options:           dto.options ?? [],
        required:          dto.required,
        orderIndex:        nextOrder,
        isCustom:          true,
        isGlobal:          false,
        scopeDepartmentId: user.departmentId,
      },
    })
  }

  async deleteCustomQuestion(templateId: string, questionId: string, user: SessionUser) {
    const question = await this.prisma.templateQuestion.findUnique({ where: { id: questionId } })
    if (!question || question.templateId !== templateId) {
      throw new NotFoundException('Question not found')
    }
    // isGlobal 保護優先
    if (question.isGlobal) {
      throw new ForbiddenException('This question is globally required and cannot be deleted')
    }
    if (!question.isCustom) {
      throw new ForbiddenException('HR base questions cannot be deleted')
    }
    if (question.scopeDepartmentId !== user.departmentId) {
      throw new ForbiddenException('You can only delete questions from your own department')
    }
    await this.prisma.templateQuestion.delete({ where: { id: questionId } })
  }

  async publishTemplate(id: string, user: SessionUser) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id } })
    if (!template) throw new NotFoundException('Template not found')
    this.assertRegionAccess(template.regionId, user)
    if (template.status === 'Published') {
      throw new BadRequestException('Template is already published')
    }

    // Prevent duplicate coverage: same cycle + region + any overlapping grade/title
    const conflicts = await this.prisma.formTemplate.findMany({
      where: {
        id:       { not: id },
        cycleId:  template.cycleId,
        regionId: template.regionId,
        status:   'Published',
        appliesGrades: { hasSome: template.appliesGrades },
        applyTitles:   { hasSome: template.applyTitles },
      },
      select: { id: true, name: true },
    })
    if (conflicts.length > 0) {
      throw new BadRequestException(
        `發布失敗：與已發布模板「${conflicts.map((c) => c.name).join('、')}」的職等/職稱覆蓋範圍重疊，請調整後再發布。`,
      )
    }

    return this.prisma.formTemplate.update({
      where: { id },
      data:  { status: 'Published' },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    })
  }

  async setQuestionGlobalLock(
    templateId: string,
    questionId: string,
    isGlobal: boolean,
    user: SessionUser,
  ) {
    if (user.role !== Role.Admin) throw new ForbiddenException()
    const question = await this.prisma.templateQuestion.findUnique({ where: { id: questionId } })
    if (!question || question.templateId !== templateId) {
      throw new NotFoundException('Question not found')
    }
    return this.prisma.templateQuestion.update({
      where: { id: questionId },
      data:  { isGlobal },
    })
  }

  private assertRegionAccess(templateRegionId: string, user: SessionUser) {
    if (user.role === Role.Admin || user.role === (Role as any).GlobalHR) return
    if (templateRegionId !== user.regionId) throw new ForbiddenException()
  }
}
