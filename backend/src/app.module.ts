import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { HealthController } from './health.controller'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { MetricsMiddleware } from './metrics.middleware'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { GoalsModule } from './modules/goals/goals.module'
import { ReviewsModule } from './modules/reviews/reviews.module'
import { CyclesModule } from './modules/cycles/cycles.module'
import { TemplatesModule } from './modules/templates/templates.module'
import { AppealsModule } from './modules/appeals/appeals.module'
import { RegionConfigModule } from './modules/config/config.module'
import { AuditModule } from './modules/audit/audit.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { AuditWriteInterceptor } from './modules/audit/audit-write.interceptor'
import { ForbiddenExceptionFilter } from './modules/audit/forbidden.filter'

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // IP-based throttle：每分鐘最多 60 次請求（正常使用完全不受影響）
    // Login 端點會覆寫為更嚴格的 10 次 / 分鐘
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    GoalsModule,
    ReviewsModule,
    CyclesModule,
    TemplatesModule,
    AppealsModule,
    RegionConfigModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [
    // 全域注冊：支援 DI（能注入 AuditService），比 app.useGlobalInterceptors() 正確
    { provide: APP_INTERCEPTOR, useClass: AuditWriteInterceptor },
    { provide: APP_FILTER,      useClass: ForbiddenExceptionFilter },
    { provide: APP_GUARD,       useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*')
  }
}
