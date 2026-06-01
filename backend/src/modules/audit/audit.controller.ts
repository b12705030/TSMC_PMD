import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuditService } from './audit.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { Role } from '../../common/enums/role.enum'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { isGlobalRole } from '../../common/utils/region.util'
import type { SessionUser } from '../../common/types/request.types'

class AuditQueryDto {
  q?: string
  outcome?: string
  resource?: string
  fromDate?: string
  toDate?: string
  from?: string
  size?: string
}

@Controller('audit')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getLogs(
    @CurrentUser() user: SessionUser,
    @Query() query: AuditQueryDto,
  ) {
    return this.auditService.search({
      q:        query.q        ?? '',
      outcome:  query.outcome,
      resource: query.resource,
      regionId: isGlobalRole(user) ? undefined : user.regionId,
      fromDate: query.fromDate,
      toDate:   query.toDate,
      from:     Number(query.from  ?? 0),
      size:     Number(query.size  ?? 50),
    })
  }
}
