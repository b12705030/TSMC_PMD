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
    const where = user.role === Role.Admin ? {} : { region: { name: user.region } }
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

  // RegionalHR creates the base template with locked questions
  async createTemplate(dto: CreateTemplateDto, user: SessionUser) {

    // Verify cycle belongs to user's region
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: dto.cycleId } })
    if (!cycle) throw new BadRequestException('Cycle not found')
    if (user.role !== Role.Admin && !cycle.regions.includes(user.region)) {
      throw new ForbiddenException('Cycle does not belong to your region')
    }

    // Resolve regionId: Admin → use first region of cycle; HR → own region
    let regionId = user.regionId
    if (user.role === Role.Admin && cycle.regions.length > 0) {
      const regionRec = await this.prisma.region.findFirst({ where: { name: cycle.regions[0] } })
      if (regionRec) regionId = regionRec.id
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
          })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    })
  }

  // Manager adds a custom question scoped to their department
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
        scopeDepartmentId: user.departmentId,
      },
    })
  }

  // Manager can only delete their own custom questions
  async deleteCustomQuestion(templateId: string, questionId: string, user: SessionUser) {
    const question = await this.prisma.templateQuestion.findUnique({ where: { id: questionId } })
    if (!question || question.templateId !== templateId) {
      throw new NotFoundException('Question not found')
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

  private assertRegionAccess(templateRegionId: string, user: SessionUser) {
    if (user.role !== Role.Admin && templateRegionId !== user.regionId) {
      throw new ForbiddenException()
    }
  }
}
