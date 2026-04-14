import { Body, Controller, Get, Param, Post, Patch, UseGuards } from '@nestjs/common'
import { CyclesService } from './cycles.service'
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
  @Roles(Role.Admin, Role.RegionalHR)
  getCycles(@CurrentUser() user: SessionUser) {
    return this.cyclesService.getCycles(user.region)
  }

  @Get(':id')
  @Roles(Role.Admin, Role.RegionalHR)
  getCycle(@Param('id') id: string) {
    return this.cyclesService.getCycle(id)
  }

  @Post()
  @Roles(Role.Admin, Role.RegionalHR)
  createCycle(@Body() dto: unknown) {
    return this.cyclesService.createCycle(dto)
  }

  @Patch(':id/status')
  @Roles(Role.Admin, Role.RegionalHR)
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.cyclesService.updateCycleStatus(id, status)
  }
}
