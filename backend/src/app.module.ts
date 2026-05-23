import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
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
import { AuditWriteInterceptor } from './modules/audit/audit-write.interceptor'
import { ForbiddenExceptionFilter } from './modules/audit/forbidden.filter'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  providers: [
    // 全域注冊：支援 DI（能注入 AuditService），比 app.useGlobalInterceptors() 正確
    { provide: APP_INTERCEPTOR, useClass: AuditWriteInterceptor },
    { provide: APP_FILTER,      useClass: ForbiddenExceptionFilter },
  ],
})
export class AppModule {}
