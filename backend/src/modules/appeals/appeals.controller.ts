import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { AppealsService } from './appeals.service'
import { CreateAppealDto, RespondAppealDto } from './dto/appeal.dto'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('appeals')
@UseGuards(AuthGuard, RolesGuard)
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  // Manager / Admin 查看收到的申訴清單
  @Get()
  @Roles(Role.Manager, Role.Admin)
  getAppeals(@CurrentUser() user: SessionUser) {
    return this.appealsService.getAppealsForManager(user)
  }

  // 員工提出申訴
  @Post()
  @Roles(Role.Employee)
  createAppeal(@CurrentUser() user: SessionUser, @Body() dto: CreateAppealDto) {
    return this.appealsService.createAppeal(user, dto)
  }

  // 取得單筆申訴（員工看自己的、Manager 看收到的）
  @Get(':id')
  @Roles(Role.Employee, Role.Manager, Role.Admin)
  getAppeal(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.appealsService.getAppealById(id, user)
  }

  // Manager 回覆並解決申訴
  @Patch(':id/respond')
  @Roles(Role.Manager, Role.Admin)
  respondToAppeal(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: RespondAppealDto,
  ) {
    return this.appealsService.respondToAppeal(id, user, dto)
  }
}
