import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { GoalsService } from './goals.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'
import { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto'

@Controller('goals')
@UseGuards(AuthGuard, RolesGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  getMyGoals(@CurrentUser() user: SessionUser) {
    return this.goalsService.getMyGoals(user.id)
  }

  @Get('team')
  @Roles(Role.Supervisor, Role.Manager, Role.RegionalHR, Role.Admin)
  getTeamGoals(@CurrentUser() user: SessionUser) {
    return this.goalsService.getTeamGoals(user)
  }

  @Get('employee/:employeeId')
  @Roles(Role.Supervisor, Role.Manager, Role.Admin)
  getEmployeeGoalsInline(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.goalsService.getGoalsByEmployee(employeeId, user)
  }

  @Get(':id')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager, Role.Admin)
  getGoal(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.goalsService.getGoal(id, user)
  }

  @Post()
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  createGoal(@CurrentUser() user: SessionUser, @Body() dto: CreateGoalDto) {
    return this.goalsService.createGoal(user, dto)
  }

  @Put(':id')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  updateGoal(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.updateGoal(id, user, dto)
  }

  @Post(':id/progress')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  addProgress(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body('content') content: string,
  ) {
    return this.goalsService.addProgressUpdate(id, user, content)
  }

  @Post(':id/milestones')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  addMilestone(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body('title') title: string,
  ) {
    return this.goalsService.addMilestone(id, user, title)
  }

  @Patch(':id/milestones/:milestoneId')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  toggleMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: SessionUser,
    @Body('note') note?: string,
  ) {
    return this.goalsService.toggleMilestone(id, milestoneId, user, note)
  }

  @Patch(':id/milestones/:milestoneId/note')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  updateMilestoneNote(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: SessionUser,
    @Body('note') note: string | null,
  ) {
    return this.goalsService.updateMilestoneNote(id, milestoneId, user, note ?? null)
  }

  @Patch(':id/milestones/:milestoneId/url')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  updateMilestoneUrl(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: SessionUser,
    @Body('url') url: string | null,
  ) {
    return this.goalsService.updateMilestoneUrl(id, milestoneId, user, url ?? null)
  }

  @Put(':id/milestones/reorder')
  @HttpCode(204)
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  reorderMilestones(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body('ids') ids: string[],
  ) {
    return this.goalsService.reorderMilestones(id, ids, user)
  }

  @Delete(':id/milestones/:milestoneId')
  @HttpCode(204)
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  deleteMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.goalsService.deleteMilestone(id, milestoneId, user)
  }

  @Patch(':id/approve')
  @Roles(Role.Supervisor, Role.Manager, Role.Admin)
  approveGoal(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.goalsService.approveGoal(id, user)
  }

  @Patch(':id/reject')
  @Roles(Role.Supervisor, Role.Manager, Role.Admin)
  rejectGoal(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() body: { reason?: string },
  ) {
    return this.goalsService.rejectGoal(id, user, body.reason)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  deleteGoal(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.goalsService.deleteGoal(id, user)
  }

  @Patch(':id/submit')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  submitGoal(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.goalsService.submitGoal(id, user)
  }
}
