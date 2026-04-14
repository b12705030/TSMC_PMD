import { Injectable, Logger } from '@nestjs/common'
import { Client } from '@elastic/elasticsearch'

const INDEX = 'audit-logs'

interface AuditLogEntry {
  userId: string
  userName: string
  action: string
  resource: string
  resourceId: string
  detail: Record<string, unknown>
  ipAddress: string
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)
  private readonly es: Client

  constructor() {
    this.es = new Client({
      node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200',
      requestTimeout: 3000,
      maxRetries: 0,
      ...(process.env.ELASTICSEARCH_USERNAME && {
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD ?? '',
        },
      }),
    })
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.es.index({
        index: INDEX,
        document: {
          ...entry,
          createdAt: new Date().toISOString(),
        },
      })
    } catch (err) {
      // Audit logging must never crash the main flow
      this.logger.error('Failed to write audit log', err)
    }
  }

  async search(query: string, from = 0, size = 50) {
    try {
      const result = await this.es.search({
        index: INDEX,
        from,
        size,
        sort: [{ createdAt: { order: 'desc' } }],
        query: query
          ? { multi_match: { query, fields: ['action', 'resource', 'userName'] } }
          : { match_all: {} },
      })

      return result.hits.hits.map((hit) => ({ id: hit._id ?? '', ...(hit._source as object) }))
    } catch (err) {
      this.logger.warn('Elasticsearch unavailable, returning empty audit log', err)
      return []
    }
  }
}
