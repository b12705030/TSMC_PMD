import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { NotificationType, Role } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { isGlobalRole } from '../../common/utils/region.util'
import type { SessionUser } from '../../common/types/request.types'
import type { CreateTemplateDto } from './dto/create-template.dto'
import type { AddCustomQuestionDto } from './dto/add-question.dto'

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getTemplates(user: SessionUser) {
    const where = isGlobalRole(user)
      ? {}
      : { regionId: user.regionId }
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
    if (!isGlobalRole(user) && cycle.regionId !== user.regionId) {
      throw new ForbiddenException('Cycle does not belong to your region')
    }

    // Template region always follows the cycle's region
    const regionId = cycle.regionId

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

    const published = await this.prisma.formTemplate.update({
      where: { id },
      data:  { status: 'Published' },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    })

    // 通知同地區所有 Manager 前往新增自訂題目
    const managers = await this.prisma.user.findMany({
      where:  { regionId: template.regionId, role: Role.Manager },
      select: { id: true },
    })
    if (managers.length > 0) {
      await this.notifications.createForUsers(
        managers.map((m) => m.id),
        {
          type:    NotificationType.TemplatePublished,
          title:   '績效評核模板已發布',
          message: `HR 已發布模板「${published.name}」，請前往新增部門自訂題目。`,
          cycleId: template.cycleId ?? undefined,
        },
      )
    }

    return published
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
    if (isGlobalRole(user)) return
    if (templateRegionId !== user.regionId) throw new ForbiddenException()
  }
}
