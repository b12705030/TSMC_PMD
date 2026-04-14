import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuditService } from './audit.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { Role } from '../../common/enums/role.enum'

@Controller('audit')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.Admin, Role.RegionalHR)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getLogs(@Query('q') query = '', @Query('from') from = '0', @Query('size') size = '50') {
    return this.auditService.search(query, Number(from), Number(size))
  }
}
