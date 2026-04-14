import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { GoalsService } from './goals.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('goals')
@UseGuards(AuthGuard, RolesGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @Roles(Role.Employee, Role.Supervisor)
  getMyGoals(@CurrentUser() user: SessionUser) {
    return this.goalsService.getMyGoals(user.id)
  }

  @Get(':id')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  getGoal(@Param('id') id: string) {
    return this.goalsService.getGoal(id)
  }

  @Post()
  @Roles(Role.Employee)
  createGoal(@CurrentUser() user: SessionUser, @Body() dto: unknown) {
    return this.goalsService.createGoal(user.id, dto)
  }

  @Put(':id')
  @Roles(Role.Employee)
  updateGoal(@Param('id') id: string, @Body() dto: unknown) {
    return this.goalsService.updateGoal(id, dto)
  }

  @Post(':id/progress')
  @Roles(Role.Employee)
  addProgress(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body('content') content: string
  ) {
    return this.goalsService.addProgressUpdate(id, user.id, content)
  }
}
