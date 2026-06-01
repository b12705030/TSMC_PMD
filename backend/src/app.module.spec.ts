import { MODULE_METADATA } from '@nestjs/common/constants'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { HealthController } from './health.controller'
import { AppModule } from './app.module'
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
import { ThrottlerGuard } from '@nestjs/throttler'

describe('AppModule', () => {
  it('wires the core application modules and global providers', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule)
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule)

    expect(imports).toEqual(expect.arrayContaining([
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
    ]))
    expect(controllers).toEqual([HealthController])
    expect(providers).toEqual(expect.arrayContaining([
      { provide: APP_INTERCEPTOR, useClass: AuditWriteInterceptor },
      { provide: APP_FILTER, useClass: ForbiddenExceptionFilter },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
    ]))
  })
})
