import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ReviewsService } from './reviews.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('reviews')
@UseGuards(AuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  getMyReviews(@CurrentUser() user: SessionUser) {
    return this.reviewsService.getMyReviews(user.id)
  }

  @Get(':id')
  @Roles(Role.Employee, Role.Supervisor, Role.Manager)
  getReview(@Param('id') id: string) {
    return this.reviewsService.getReview(id)
  }

  @Post(':id/employee-submit')
  @Roles(Role.Employee)
  submitEmployeeAnswers(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() answers: unknown
  ) {
    return this.reviewsService.submitEmployeeAnswers(id, user.id, answers)
  }

  @Post(':id/supervisor-submit')
  @Roles(Role.Supervisor)
  submitSupervisorEvaluation(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: unknown
  ) {
    return this.reviewsService.submitSupervisorEvaluation(id, user.id, dto)
  }

  @Post('publish/:cycleId')
  @Roles(Role.Manager)
  publishReviews(@Param('cycleId') cycleId: string, @CurrentUser() user: SessionUser) {
    return this.reviewsService.publishReviews(cycleId, user.id)
  }
}
