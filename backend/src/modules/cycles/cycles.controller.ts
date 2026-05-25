import { Body, Controller, Get, Param, Post, Patch, UseGuards } from '@nestjs/common'
import { CyclesService } from './cycles.service'
import { CreateCycleDto } from './dto/create-cycle.dto'
import { UpdateCycleDto } from './dto/update-cycle.dto'
import { PostponeCycleDto } from './dto/postpone-cycle.dto'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('cycles')
@UseGuards(AuthGuard, RolesGuard)
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get()
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR, Role.Manager, Role.Supervisor, Role.Employee)
  getCycles(@CurrentUser() user: SessionUser) {
    return this.cyclesService.getCycles(user)
  }

  @Get(':id/manager-questionnaire-status')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  getManagerQuestionnaireStatus(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.cyclesService.getManagerQuestionnaireStatus(id, user)
  }

  @Get(':id')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR, Role.Manager, Role.Supervisor, Role.Employee)
  getCycle(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.cyclesService.getCycle(id, user)
  }

  @Post()
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  createCycle(@Body() dto: CreateCycleDto, @CurrentUser() user: SessionUser) {
    return this.cyclesService.createCycle(dto, user)
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  updateCycle(@Param('id') id: string, @Body() dto: UpdateCycleDto, @CurrentUser() user: SessionUser) {
    return this.cyclesService.updateCycle(id, dto, user)
  }

  @Patch(':id/advance')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  advanceStatus(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.cyclesService.advanceStatus(id, user)
  }

  @Patch(':id/confirm-advance')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  confirmAdvance(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.cyclesService.confirmAdvance(id, user)
  }

  @Patch(':id/postpone')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
  postpone(
    @Param('id') id: string,
    @Body() dto: PostponeCycleDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.cyclesService.postpone(id, dto, user)
  }
}
