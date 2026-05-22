import { of, throwError } from 'rxjs'
import { AuditWriteInterceptor } from './audit-write.interceptor'
import { AuditService } from './audit.service'

const mockLog = jest.fn().mockResolvedValue(undefined)
const mockAuditService = { log: mockLog } as unknown as AuditService

function makeContext(method: string, routePath: string, actualPath: string, body: object = {}) {
  const req = { method, route: { path: routePath }, path: actualPath, ip: '127.0.0.1', body, headers: {}, user: { id: 'u1', name: 'Alice' } }
  const res = { statusCode: 200 }
  return {
    switchToHttp: () => ({
      getRequest:  () => req,
      getResponse: () => res,
    }),
  } as any
}

describe('AuditWriteInterceptor', () => {
  let interceptor: AuditWriteInterceptor

  beforeEach(() => {
    jest.clearAllMocks()
    interceptor = new AuditWriteInterceptor(mockAuditService)
  })

  it('does not log GET requests', (done) => {
    const ctx  = makeContext('GET', '/goals', '/goals')
    const next = { handle: () => of({ id: '1' }) }
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(mockLog).not.toHaveBeenCalled()
      done()
    })
  })

  it('logs SUCCESS on mapped POST route', (done) => {
    const ctx  = makeContext('POST', '/goals', '/goals')
    const next = { handle: () => of({ id: 'g1' }) }
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({
        action:  'GOAL_CREATE',
        resource: 'goal',
        outcome: 'SUCCESS',
        userId:  'u1',
        userName: 'Alice',
      }))
      done()
    })
  })

  it('does not log unmapped routes', (done) => {
    const ctx  = makeContext('POST', '/unknown-route', '/unknown-route')
    const next = { handle: () => of({}) }
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(mockLog).not.toHaveBeenCalled()
      done()
    })
  })

  it('extracts resourceId from route pattern :id', (done) => {
    const ctx  = makeContext('PATCH', '/cycles/:id', '/cycles/cycle-abc', {})
    const next = { handle: () => of({}) }
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({
        resourceId: 'cycle-abc',
      }))
      done()
    })
  })

  it('sanitizes password / token / secret from body detail', (done) => {
    const ctx  = makeContext('POST', '/goals', '/goals', { title: 'x', password: 'secret123', token: 'tok' })
    const next = { handle: () => of({}) }
    interceptor.intercept(ctx, next).subscribe(() => {
      const detail = mockLog.mock.calls[0][0].detail as Record<string, unknown>
      expect(detail).not.toHaveProperty('password')
      expect(detail).not.toHaveProperty('token')
      expect(detail).toHaveProperty('title', 'x')
      done()
    })
  })

  it('does not log when handler throws (ForbiddenExceptionFilter handles 403)', (done) => {
    const ctx  = makeContext('POST', '/goals', '/goals')
    const next = { handle: () => throwError(() => new Error('Forbidden')) }
    interceptor.intercept(ctx, next).subscribe({
      error: () => {
        expect(mockLog).not.toHaveBeenCalled()
        done()
      },
    })
  })
})
