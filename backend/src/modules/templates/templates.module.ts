import { Module } from '@nestjs/common'
import { TemplatesController } from './templates.controller'
import { TemplatesService } from './templates.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports:     [NotificationsModule],
  controllers: [TemplatesController],
  providers:   [TemplatesService],
})
export class TemplatesModule {}
