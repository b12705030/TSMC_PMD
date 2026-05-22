import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import { ForbiddenException } from '@nestjs/common'
import { AuditService } from './audit.service'
import type { RequestWithUser } from '../../common/types/request.types'

@Catch(ForbiddenException)
export class ForbiddenExceptionFilter implements ExceptionFilter {
  constructor(private readonly auditService: AuditService) {}

  catch(exception: ForbiddenException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const req = ctx.getRequest<RequestWithUser>()
    const res = ctx.getResponse()

    // 完整 forbidden reason 只進 ES，不進 HTTP response
    void this.auditService.log({
      userId:     req.user?.id    ?? 'anonymous',
      userName:   req.user?.name  ?? 'anonymous',
      action:     'ACCESS_DENIED',
      outcome:    'FORBIDDEN',
      resource:   req.path.split('/')[1] ?? 'unknown',
      resourceId: req.path.split('/')[2],
      httpMethod: req.method,
      httpPath:   req.path,
      httpStatus: 403,
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'] as string | undefined,
      detail:     { reason: exception.message, routePattern: (req as any).route?.path },
      createdAt:  new Date(),
    })

    // 固定回應：不含任何員工姓名、部門名稱等業務資訊
    res.status(403).json({
      statusCode: 403,
      message:   'Access denied.',
      timestamp: new Date().toISOString(),
      path:      req.url,
    })
  }
}
