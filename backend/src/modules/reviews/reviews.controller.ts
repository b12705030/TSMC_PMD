import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ReviewsService } from './reviews.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import { SaveAnswersDto, SaveSupervisorReviewDto, CalibrateDto } from './dto/review.dto'
import type { SessionUser } from '../../common/types/request.types'

@Controller('reviews')
@UseGuards(AuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Employee: my own reviews
  @Get()
  @Roles(Role.Employee, Role.Supervisor, Role.Manager, Role.Admin)
  getMyReviews(@CurrentUser() user: SessionUser) {
    return this.reviewsService.getMyReviews(user.id)
  }

  // Supervisor / Manager / Admin: team reviews
  @Get('team')
  @Roles(Role.Supervisor, Role.Manager, Role.Admin)
  getTeamReviews(@CurrentUser() user: SessionUser) {
    return this.reviewsService.getTeamReviews(user)
  }

  // Manager / Admin: all reviews in a cycle for calibration
  @Get('calibrate/:cycleId')
  @Roles(Role.Manager, Role.Admin)
  getCycleReviews(@Param('cycleId') cycleId: string, @CurrentUser() user: SessionUser) {
    return this.reviewsService.getCycleReviews(cycleId, user)
  }

  // Manager / Admin: publish all pending reviews in a cycle
  @Post('cycle/:cycleId/publish')
  @HttpCode(204)
  @Roles(Role.Manager, Role.Admin)
  publishAll(@Param('cycleId') cycleId: string, @CurrentUser() user: SessionUser) {
    return this.reviewsService.publishAll(cycleId, user)
  }

  // Manager / HR / Admin: grade distribution + status counts
  @Get('stats')
  @Roles(Role.Supervisor, Role.Manager, Role.GlobalHR, Role.RegionalHR, Role.Admin)
  getReviewStats(@CurrentUser() user: SessionUser) {
    return this.reviewsService.getReviewStats(user)
  }

  // Any role with access: single review
  @Get(':id')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager, Role.Admin)
  getReview(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.reviewsService.getReview(id, user)
  }

  // Employee: save answers (draft)
  @Put(':id/answers')
  @Roles(Role.Employee)
  saveEmployeeAnswers(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: SaveAnswersDto,
  ) {
    return this.reviewsService.saveEmployeeAnswers(id, user, dto)
  }

  // Employee: submit → PendingSupervisorReview
  @Post(':id/submit')
  @Roles(Role.Employee)
  submitEmployee(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.reviewsService.submitEmployee(id, user)
  }

  // Supervisor / Manager (for direct-reports): save review (draft)
  @Put(':id/supervisor')
  @Roles(Role.Supervisor, Role.Manager)
  saveSupervisorReview(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: SaveSupervisorReviewDto,
  ) {
    return this.reviewsService.saveSupervisorReview(id, user, dto)
  }

  // Supervisor / Manager (for direct-reports): submit → PendingManagerApproval
  @Post(':id/supervisor/submit')
  @Roles(Role.Supervisor, Role.Manager)
  submitSupervisor(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.reviewsService.submitSupervisor(id, user)
  }

  // Manager / Admin: calibrate single review (grade + rank)
  @Put(':id/calibrate')
  @Roles(Role.Manager, Role.Admin)
  calibrate(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: CalibrateDto,
  ) {
    return this.reviewsService.calibrate(id, user, dto)
  }
}
