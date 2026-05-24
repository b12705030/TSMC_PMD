import { Injectable, Logger } from '@nestjs/common'
import { Client } from '@elastic/elasticsearch'
import type { AuditLogEntry } from './audit-log.interface'
import { isGlobalRole } from '../../common/utils/region.util'
import type { SessionUser } from '../../common/types/request.types'

const INDEX = 'audit-logs'

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
          createdAt: entry.createdAt.toISOString(),
        },
      })
    } catch (err) {
      // Audit logging must never crash the main flow
      this.logger.error('Failed to write audit log', err)
    }
  }

  async ensureIndex(): Promise<void> {
    try {
      const exists = await this.es.indices.exists({ index: INDEX })

      if (!exists) {
        await this.es.indices.create({
          index: INDEX,
          mappings: {
            dynamic: 'strict',
            properties: {
              userId:       { type: 'keyword' },
              userName:     { type: 'keyword' },
              userRegionId: { type: 'keyword' },
              action:       { type: 'keyword' },
              outcome:      { type: 'keyword' },
              resource:     { type: 'keyword' },
              resourceId:   { type: 'keyword' },
              httpMethod:   { type: 'keyword' },
              httpPath:     { type: 'keyword' },
              httpStatus:   { type: 'integer' },
              ipAddress:    { type: 'ip' },
              userAgent:    { type: 'text', index: false },
              detail:       { type: 'object', dynamic: true },
              createdAt:    { type: 'date' },
            },
          },
        } as any)
        this.logger.log('audit-logs index created')
      } else {
        // Add userRegionId to existing index (no-op if already present)
        await this.es.indices.putMapping({
          index: INDEX,
          properties: { userRegionId: { type: 'keyword' } },
        } as any)
        this.logger.log('audit-logs mapping updated')
      }
    } catch (err) {
      this.logger.error('Failed to ensure audit-logs index', err)
    }
  }

  async search(opts: {
    q?: string
    outcome?: string
    resource?: string
    fromDate?: string
    toDate?: string
    from?: number
    size?: number
  } = {}, user?: SessionUser): Promise<{ data: object[]; total: number }> {
    const { q, outcome, resource, fromDate, toDate, from = 0, size = 50 } = opts
    try {
      const filters: object[] = []
      if (user && !isGlobalRole(user)) filters.push({ term: { userRegionId: user.regionId } })
      if (outcome)              filters.push({ term: { outcome } })
      if (resource)             filters.push({ term: { resource } })
      if (fromDate || toDate)   filters.push({ range: { createdAt: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) } } })

      const esQuery = filters.length || q
        ? {
            bool: {
              ...(q && { must: { multi_match: { query: q, fields: ['action', 'resource', 'userName'] } } }),
              ...(filters.length && { filter: filters }),
            },
          }
        : { match_all: {} }

      const result = await this.es.search({
        index: INDEX,
        from,
        size,
        sort: [{ createdAt: { order: 'desc' } }],
        query: esQuery,
        track_total_hits: true,
      })

      const total = typeof result.hits.total === 'number'
        ? result.hits.total
        : (result.hits.total?.value ?? 0)

      const data = result.hits.hits.map((hit) => ({ id: hit._id ?? '', ...(hit._source as object) }))
      return { data, total }
    } catch (err) {
      this.logger.warn('Elasticsearch unavailable, returning empty audit log', err)
      return { data: [], total: 0 }
    }
  }
}
