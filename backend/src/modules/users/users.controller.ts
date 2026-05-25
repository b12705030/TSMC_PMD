import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { UpdateUserDto } from './dto/update-user.dto'
import { CreateUserDto } from './dto/create-user.dto'
import { GoalsService } from '../goals/goals.service'
import { ReviewsService } from '../reviews/reviews.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly goalsService: GoalsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Get()
  @Roles(Role.Admin, Role.GlobalHR)
  listUsers(
    @Query('search')   search?: string,
    @Query('role')     role?: string,
    @Query('regionId') regionId?: string,
    @Query('from')     from?: string,
    @Query('size')     size?: string,
  ) {
    return this.usersService.listUsers({
      search,
      role,
      regionId,
      from: from ? Number(from) : 0,
      size: size ? Number(size) : 50,
    })
  }

  @Post()
  @Roles(Role.Admin)
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto)
  }

  @Get('departments')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  getDepartments(@Query('regionId') regionId?: string) {
    return this.usersService.getDepartments(regionId)
  }

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
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  getRegions() {
    return this.usersService.getDistinctRegions()
  }

  @Get('job-levels')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  getJobLevels(@CurrentUser() user: SessionUser) {
    return this.usersService.getDistinctJobLevels(user)
  }

  @Get('job-titles')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  getJobTitles(@CurrentUser() user: SessionUser) {
    return this.usersService.getDistinctJobTitles(user)
  }

  @Get('job-titles-grouped')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  getJobTitlesGrouped(@CurrentUser() user: SessionUser) {
    return this.usersService.getGroupedJobTitles(user)
  }

  // PATCH 必須在 :id GET 之前，避免路由衝突
  @Patch(':id')
  @Roles(Role.Admin)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto)
  }

  @Get(':id')
  @Roles(Role.Admin, Role.GlobalHR, Role.Manager, Role.Supervisor, Role.RegionalHR)
  getEmployee(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.usersService.getEmployee(id, user)
  }

  @Get(':id/goals')
  @Roles(Role.Manager, Role.Supervisor)
  getEmployeeGoals(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.goalsService.getGoalsByEmployee(id, user)
  }

  @Get(':id/reviews')
  @Roles(Role.Manager, Role.Supervisor)
  getEmployeeReviews(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.reviewsService.getReviewsByEmployee(id, user)
  }
}
