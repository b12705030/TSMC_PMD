import { Test } from '@nestjs/testing'
import { AuditService } from './audit.service'
import { PrismaService } from '../../prisma/prisma.service'

const mockPrisma = {
  auditLog: {
    create:   jest.fn(),
    count:    jest.fn(),
    findMany: jest.fn(),
  },
}

describe('AuditService', () => {
  let service: AuditService

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    service = module.get(AuditService)
  })

  // ─── log() ────────────────────────────────────────────────────────────────

  describe('log()', () => {
    const entry = {
      userId: 'u1', userName: 'Alice', action: 'GOAL_CREATE',
      outcome: 'SUCCESS' as const, resource: 'goal', createdAt: new Date('2026-01-01T00:00:00Z'),
    }

    it('creates an audit log record in Prisma', async () => {
      mockPrisma.auditLog.create.mockResolvedValueOnce({})
      await service.log(entry)
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            userName: 'Alice',
            action: 'GOAL_CREATE',
            outcome: 'SUCCESS',
            resource: 'goal',
          }),
        }),
      )
    })

    it('swallows Prisma errors and does not throw', async () => {
      mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('DB down'))
      await expect(service.log(entry)).resolves.toBeUndefined()
    })
  })

  // ─── search() ─────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('returns paginated results with total', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(1)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([{ id: 'log1', action: 'LOGIN' }])
      const result = await service.search({})
      expect(result).toEqual({ data: [{ id: 'log1', action: 'LOGIN' }], total: 1 })
    })

    it('applies outcome filter', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([])
      await service.search({ outcome: 'FORBIDDEN' })
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ outcome: 'FORBIDDEN' }) }),
      )
    })

    it('applies regionId filter', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([])
      await service.search({ regionId: 'region-tw' })
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userRegionId: 'region-tw' }) }),
      )
    })

    it('applies date range filter', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([])
      await service.search({ fromDate: '2026-01-01', toDate: '2026-12-31' })
      const call = mockPrisma.auditLog.count.mock.calls[0][0]
      expect(call.where.createdAt).toEqual({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-12-31'),
      })
    })

    it('applies text search via OR clause', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(0)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([])
      await service.search({ q: 'Alice' })
      const call = mockPrisma.auditLog.count.mock.calls[0][0]
      expect(call.where.OR).toBeDefined()
    })

    it('uses skip/take from from/size params', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(100)
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([])
      await service.search({ from: 20, size: 10 })
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      )
    })
  })
})
