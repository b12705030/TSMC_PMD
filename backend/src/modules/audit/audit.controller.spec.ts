import { Test, TestingModule } from '@nestjs/testing'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'

const mockSearch = jest.fn().mockResolvedValue({ data: [], total: 0 })
const mockAuditService = { search: mockSearch } as unknown as AuditService
const passGuard = { canActivate: () => true }

describe('AuditController', () => {
  let controller: AuditController

  beforeEach(async () => {
    jest.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers:   [{ provide: AuditService, useValue: mockAuditService }],
    })
      .overrideGuard(AuthGuard).useValue(passGuard)
      .overrideGuard(RolesGuard).useValue(passGuard)
      .compile()
    controller = module.get(AuditController)
  })

  it('calls search with default params when no query given', async () => {
    await controller.getLogs('', undefined, undefined, undefined, undefined, '0', '50')
    expect(mockSearch).toHaveBeenCalledWith({
      q: '', outcome: undefined, resource: undefined,
      fromDate: undefined, toDate: undefined, from: 0, size: 50,
    })
  })

  it('passes outcome and resource filters to service', async () => {
    await controller.getLogs('LOGIN', 'SUCCESS', 'auth', undefined, undefined, '0', '20')
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
      q: 'LOGIN', outcome: 'SUCCESS', resource: 'auth', size: 20,
    }))
  })

  it('passes date range filters to service', async () => {
    await controller.getLogs('', undefined, undefined, '2026-01-01', '2026-12-31', '0', '50')
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
      fromDate: '2026-01-01', toDate: '2026-12-31',
    }))
  })

  it('parses from/size as numbers', async () => {
    await controller.getLogs('', undefined, undefined, undefined, undefined, '100', '25')
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ from: 100, size: 25 }))
  })

  it('returns the result from AuditService.search', async () => {
    mockSearch.mockResolvedValueOnce({ data: [{ id: 'x' }], total: 1 })
    const result = await controller.getLogs('', undefined, undefined, undefined, undefined, '0', '50')
    expect(result).toEqual({ data: [{ id: 'x' }], total: 1 })
  })
})
