import { Module } from '@nestjs/common'
import { AuditService } from './audit.service'
import { AuditController } from './audit.controller'
import { AuditWriteInterceptor } from './audit-write.interceptor'
import { ForbiddenExceptionFilter } from './forbidden.filter'

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditWriteInterceptor,
    ForbiddenExceptionFilter,
  ],
  exports: [AuditService, AuditWriteInterceptor, ForbiddenExceptionFilter],
})
export class AuditModule {}
