import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { AuditService } from './audit.service'

@Injectable()
export class EsIndexSetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EsIndexSetupService.name)

  constructor(private readonly auditService: AuditService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.auditService.ensureIndex()
    this.logger.log('Elasticsearch audit-logs index verified')
  }
}
