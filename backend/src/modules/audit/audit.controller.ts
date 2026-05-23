import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuditService } from './audit.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { Role } from '../../common/enums/role.enum'

@Controller('audit')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getLogs(
    @Query('q') q = '',
    @Query('outcome') outcome?: string,
    @Query('resource') resource?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('from') from = '0',
    @Query('size') size = '50',
  ) {
    return this.auditService.search({
      q,
      outcome,
      resource,
      fromDate,
      toDate,
      from: Number(from),
      size: Number(size),
    })
  }
}
