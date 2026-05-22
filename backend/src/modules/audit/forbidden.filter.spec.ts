import { ForbiddenException } from '@nestjs/common'
import { ForbiddenExceptionFilter } from './forbidden.filter'
import { AuditService } from './audit.service'

const mockLog = jest.fn().mockResolvedValue(undefined)
const mockAuditService = { log: mockLog } as unknown as AuditService

function makeHost(path: string, method = 'GET', user = { id: 'u1', name: 'Alice' }) {
  const statusFn = jest.fn().mockReturnThis()
  const jsonFn   = jest.fn()
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user, path, method, ip: '1.2.3.4',
        headers: { 'user-agent': 'test-agent' },
        route: { path },
        url: path,
      }),
      getResponse: () => ({ status: statusFn, json: jsonFn }),
    }),
    _status: statusFn,
    _json:   jsonFn,
  } as any
}

describe('ForbiddenExceptionFilter', () => {
  let filter: ForbiddenExceptionFilter

  beforeEach(() => {
    jest.clearAllMocks()
    filter = new ForbiddenExceptionFilter(mockAuditService)
  })

  it('logs to ES with outcome=FORBIDDEN and action=ACCESS_DENIED', () => {
    const host = makeHost('/goals/abc')
    filter.catch(new ForbiddenException('Insufficient permissions'), host)
    expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({
      action:  'ACCESS_DENIED',
      outcome: 'FORBIDDEN',
      httpStatus: 403,
      userId:  'u1',
      userName: 'Alice',
    }))
  })

  it('includes exception message in ES detail but NOT in HTTP response', () => {
    const host = makeHost('/templates/t1')
    filter.catch(new ForbiddenException('You lack permission'), host)

    // ES log contains the reason
    const detail = mockLog.mock.calls[0][0].detail as Record<string, unknown>
    expect(detail.reason).toBe('You lack permission')

    // HTTP response is generic
    expect(host._json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
      message: 'Access denied.',
    }))
    const body = host._json.mock.calls[0][0] as Record<string, unknown>
    expect(body).not.toHaveProperty('reason')
    expect(body).not.toHaveProperty('detail')
  })

  it('responds with HTTP 403 status', () => {
    const host = makeHost('/users/u2')
    filter.catch(new ForbiddenException(), host)
    expect(host._status).toHaveBeenCalledWith(403)
  })

  it('handles anonymous (unauthenticated) requests gracefully', () => {
    // Build a host with NO user property on the request
    const statusFn = jest.fn().mockReturnThis()
    const jsonFn   = jest.fn()
    const anonHost = {
      switchToHttp: () => ({
        getRequest:  () => ({ path: '/goals', method: 'POST', ip: '1.2.3.4', headers: {}, route: { path: '/goals' }, url: '/goals' }),
        getResponse: () => ({ status: statusFn, json: jsonFn }),
      }),
    } as any
    filter.catch(new ForbiddenException(), anonHost)
    expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({
      userId:   'anonymous',
      userName: 'anonymous',
    }))
  })
})
