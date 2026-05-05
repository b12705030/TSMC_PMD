import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('team')
  @Roles(Role.Manager, Role.Supervisor)
  getTeam(@CurrentUser() user: SessionUser) {
    return this.usersService.getTeamMembers(user)
  }

  @Get('team/hierarchy')
  @Roles(Role.Manager)
  getTeamHierarchy(@CurrentUser() user: SessionUser) {
    return this.usersService.getTeamHierarchy(user)
  }

  @Get('regions')
  @Roles(Role.Admin, Role.RegionalHR)
  getRegions() {
    return this.usersService.getDistinctRegions()
  }

  @Get('job-levels')
  @Roles(Role.Admin, Role.RegionalHR)
  getJobLevels() {
    return this.usersService.getDistinctJobLevels()
  }

  @Get('job-titles')
  @Roles(Role.Admin, Role.RegionalHR)
  getJobTitles() {
    return this.usersService.getDistinctJobTitles()
  }

  @Get(':id')
  @Roles(Role.Manager, Role.Supervisor, Role.RegionalHR, Role.Admin)
  getEmployee(@Param('id') id: string) {
    return this.usersService.getEmployee(id)
  }

  @Get(':id/goals')
  @Roles(Role.Manager, Role.Supervisor)
  getEmployeeGoals(@Param('id') _id: string) {
    // TODO: delegate to GoalsService
    return []
  }

  @Get(':id/reviews')
  @Roles(Role.Manager, Role.Supervisor)
  getEmployeeReviews(@Param('id') _id: string) {
    // TODO: delegate to ReviewsService
    return []
  }
}
