import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { TemplatesService } from './templates.service'
import { CreateTemplateDto } from './dto/create-template.dto'
import { AddCustomQuestionDto } from './dto/add-question.dto'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('templates')
@UseGuards(AuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // 跨區域比較端點須在 :id 路由之前
  @Get('compare')
  @Roles(Role.Admin, Role.GlobalHR)
  compareTemplates(@Query('cycleId') cycleId: string) {
    return this.templatesService.getTemplatesByRegion(cycleId)
  }

  @Get()
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR, Role.Manager)
  getTemplates(@CurrentUser() user: SessionUser) {
    return this.templatesService.getTemplates(user)
  }

  @Get(':id')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR, Role.Manager)
  getTemplate(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.templatesService.getTemplate(id, user)
  }

  @Post()
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: SessionUser) {
    return this.templatesService.createTemplate(dto, user)
  }

  @Post(':id/questions')
  @Roles(Role.Manager)
  addCustomQuestion(
    @Param('id') id: string,
    @Body() dto: AddCustomQuestionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.templatesService.addCustomQuestion(id, dto, user)
  }

  @Delete(':id/questions/:questionId')
  @Roles(Role.Manager)
  deleteCustomQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.templatesService.deleteCustomQuestion(id, questionId, user)
  }

  @Patch(':id/publish')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  publishTemplate(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.templatesService.publishTemplate(id, user)
  }

  @Patch(':id/questions/:questionId/lock')
  @Roles(Role.Admin)
  lockQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body('isGlobal') isGlobal: boolean,
    @CurrentUser() user: SessionUser,
  ) {
    return this.templatesService.setQuestionGlobalLock(id, questionId, isGlobal, user)
  }
}
