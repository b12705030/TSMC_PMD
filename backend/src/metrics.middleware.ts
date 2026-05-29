import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { Counter, Histogram } from 'prom-client'

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
})

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
})

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now()

    res.on('finish', () => {
      const route = (req as any).route?.path ?? req.path
      const duration = (Date.now() - start) / 1000
      const labels = { method: req.method, route, status_code: String(res.statusCode) }
      httpRequestsTotal.inc(labels)
      httpRequestDuration.observe(labels, duration)
    })

    next()
  }
}
