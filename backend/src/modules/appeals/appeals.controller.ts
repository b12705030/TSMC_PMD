import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { AppealsService } from './appeals.service'
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

  @Get()
  @Roles(Role.Manager)
  getAppeals(@CurrentUser() user: SessionUser) {
    return this.appealsService.getAppealsForManager(user.id)
  }

  @Post()
  @Roles(Role.Employee)
  createAppeal(@CurrentUser() user: SessionUser, @Body() dto: unknown) {
    return this.appealsService.createAppeal(user.id, dto)
  }

  @Post(':id/respond')
  @Roles(Role.Manager)
  respondToAppeal(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body('response') response: string
  ) {
    return this.appealsService.respondToAppeal(id, user.id, response)
  }
}
