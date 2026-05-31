import { Module } from '@nestjs/common'
import { AppealsController } from './appeals.controller'
import { AppealsService } from './appeals.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [AppealsController],
  providers: [AppealsService],
})
export class AppealsModule {}
