import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { TemplatesService } from './templates.service'
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
    return this.templatesService.getTemplates(user.region)
  }

  @Get(':id')
  @Roles(Role.Admin, Role.RegionalHR, Role.Manager)
  getTemplate(@Param('id') id: string) {
    return this.templatesService.getTemplate(id)
  }

  @Post()
  @Roles(Role.RegionalHR, Role.Manager)
  createTemplate(@Body() dto: unknown) {
    return this.templatesService.createTemplate(dto)
  }

  @Put(':id')
  @Roles(Role.Manager)
  updateTemplate(@Param('id') id: string, @Body() dto: unknown) {
    return this.templatesService.updateTemplate(id, dto)
  }
}
