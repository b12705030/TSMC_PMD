import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
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

  @Get()
  @Roles(Role.Admin, Role.RegionalHR, Role.Manager)
  getTemplates(@CurrentUser() user: SessionUser) {
    return this.templatesService.getTemplates(user)
  }

  @Get(':id')
  @Roles(Role.Admin, Role.RegionalHR, Role.Manager)
  getTemplate(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.templatesService.getTemplate(id, user)
  }

  // RegionalHR creates base template with locked questions
  @Post()
  @Roles(Role.Admin, Role.RegionalHR)
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: SessionUser) {
    return this.templatesService.createTemplate(dto, user)
  }

  // Manager adds a custom question to an existing template
  @Post(':id/questions')
  @Roles(Role.Manager)
  addCustomQuestion(
    @Param('id') id: string,
    @Body() dto: AddCustomQuestionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.templatesService.addCustomQuestion(id, dto, user)
  }

  // Manager deletes their own custom question
  @Delete(':id/questions/:questionId')
  @Roles(Role.Manager)
  deleteCustomQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.templatesService.deleteCustomQuestion(id, questionId, user)
  }

  // RegionalHR publishes a template (locks it for use)
  @Patch(':id/publish')
  @Roles(Role.Admin, Role.RegionalHR)
  publishTemplate(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.templatesService.publishTemplate(id, user)
  }
}
