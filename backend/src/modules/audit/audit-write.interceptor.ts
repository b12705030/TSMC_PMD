import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { AuditService } from './audit.service'
import { ROUTE_ACTION_MAP, extractResourceId } from './route-action.map'
import type { RequestWithUser } from '../../common/types/request.types'

@Injectable()
export class AuditWriteInterceptor implements NestInterceptor {
  private readonly WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<RequestWithUser>()
    if (!this.WRITE_METHODS.has(req.method)) return next.handle()

    const routePattern: string = (req as any).route?.path ?? req.path
    const mapEntry = ROUTE_ACTION_MAP[`${req.method}:${routePattern}`]
    if (!mapEntry) return next.handle()

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse()
          void this.auditService.log({
            userId:       req.user?.id       ?? 'anonymous',
            userName:     req.user?.name     ?? 'anonymous',
            userRegionId: req.user?.regionId,
            action:       mapEntry.action,
            outcome:    'SUCCESS',
            resource:   mapEntry.resource,
            resourceId: extractResourceId(routePattern, req.path),
            httpMethod: req.method,
            httpPath:   req.path,
            httpStatus: res.statusCode,
            ipAddress:  req.ip,
            userAgent:  req.headers['user-agent'] as string | undefined,
            detail:     sanitizeBody(req.body),
            createdAt:  new Date(),
          })
        },
        // error callback 不處理：ForbiddenExceptionFilter 負責 403 記錄
      }),
    )
  }
}

const SENSITIVE_KEYS = new Set(['password', 'token', 'secret', 'accessToken', 'refreshToken', 'apiKey', 'authorization'])

function sanitizeBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeBody(value)
    } else {
      result[key] = value
    }
  }
  return result
}
