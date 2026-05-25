import { Module } from '@nestjs/common'
import { CyclesController } from './cycles.controller'
import { CyclesService } from './cycles.service'
import { CyclesScheduler } from './cycles.scheduler'
import { NotificationsModule } from '../notifications/notifications.module'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports:     [PrismaModule, NotificationsModule],
  controllers: [CyclesController],
  providers:   [CyclesService, CyclesScheduler],
  exports:     [CyclesService],
})
export class CyclesModule {}
