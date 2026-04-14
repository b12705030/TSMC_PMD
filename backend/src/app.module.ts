import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { GoalsModule } from './modules/goals/goals.module'
import { ReviewsModule } from './modules/reviews/reviews.module'
import { CyclesModule } from './modules/cycles/cycles.module'
import { TemplatesModule } from './modules/templates/templates.module'
import { AppealsModule } from './modules/appeals/appeals.module'
import { AuditModule } from './modules/audit/audit.module'

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
    AuditModule,
  ],
})
export class AppModule {}
