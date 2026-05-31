import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR, Role.Manager, Role.Supervisor, Role.Employee)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@CurrentUser() user: SessionUser) {
    return this.notificationsService.getNotifications(user)
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: SessionUser) {
    return this.notificationsService.getUnreadCount(user)
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.notificationsService.markRead(id, user)
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: SessionUser) {
    return this.notificationsService.markAllRead(user)
  }
}
