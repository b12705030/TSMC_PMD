import { Test } from '@nestjs/testing'
import { Client } from '@elastic/elasticsearch'
import { AuditService } from './audit.service'

// Mock the entire ES client
jest.mock('@elastic/elasticsearch', () => {
  const mockIndex   = jest.fn().mockResolvedValue({})
  const mockSearch  = jest.fn()
  const mockExists  = jest.fn()
  const mockCreate  = jest.fn().mockResolvedValue({})

  return {
    Client: jest.fn().mockImplementation(() => ({
      index:   mockIndex,
      search:  mockSearch,
      indices: { exists: mockExists, create: mockCreate },
    })),
    __mocks__: { mockIndex, mockSearch, mockExists, mockCreate },
  }
})

function getMocks() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@elastic/elasticsearch')
  const instance = (mod.Client as jest.Mock).mock.results[0]?.value
  return {
    index:  instance.index   as jest.Mock,
    search: instance.search  as jest.Mock,
    exists: instance.indices.exists as jest.Mock,
    create: instance.indices.create as jest.Mock,
  }
}

describe('AuditService', () => {
  let service: AuditService

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({ providers: [AuditService] }).compile()
    service = module.get(AuditService)
  })

  // ─── log() ────────────────────────────────────────────────────────────────

  describe('log()', () => {
    const entry = {
      userId: 'u1', userName: 'Alice', action: 'GOAL_CREATE',
      outcome: 'SUCCESS' as const, resource: 'goal', createdAt: new Date('2026-01-01T00:00:00Z'),
    }

    it('indexes entry to ES with ISO createdAt', async () => {
      const { index } = getMocks()
      await service.log(entry)
      expect(index).toHaveBeenCalledWith(expect.objectContaining({
        index: 'audit-logs',
        document: expect.objectContaining({ createdAt: '2026-01-01T00:00:00.000Z' }),
      }))
    })

    it('swallows ES errors and does not throw', async () => {
      const { index } = getMocks()
      index.mockRejectedValueOnce(new Error('ES down'))
      await expect(service.log(entry)).resolves.toBeUndefined()
    })
  })

  // ─── ensureIndex() ────────────────────────────────────────────────────────

  describe('ensureIndex()', () => {
    it('skips creation when index already exists', async () => {
      const { exists, create } = getMocks()
      exists.mockResolvedValueOnce(true)
      await service.ensureIndex()
      expect(create).not.toHaveBeenCalled()
    })

    it('creates index with strict mapping when it does not exist', async () => {
      const { exists, create } = getMocks()
      exists.mockResolvedValueOnce(false)
      await service.ensureIndex()
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ index: 'audit-logs' }))
    })

    it('swallows ES errors on create', async () => {
      const { exists, create } = getMocks()
      exists.mockResolvedValueOnce(false)
      create.mockRejectedValueOnce(new Error('ES down'))
      await expect(service.ensureIndex()).resolves.toBeUndefined()
    })
  })

  // ─── search() ─────────────────────────────────────────────────────────────

  describe('search()', () => {
    function makeHit(id: string, source: object) {
      return { _id: id, _source: source }
    }

    const mockResult = (hits: object[], total: number) => ({
      hits: { hits, total: { value: total } },
    })

    it('uses match_all when no params given', async () => {
      const { search } = getMocks()
      search.mockResolvedValueOnce(mockResult([], 0))
      await service.search({})
      expect(search).toHaveBeenCalledWith(expect.objectContaining({
        query: { match_all: {} },
      }))
    })

    it('uses multi_match when q is provided', async () => {
      const { search } = getMocks()
      search.mockResolvedValueOnce(mockResult([], 0))
      await service.search({ q: 'LOGIN' })
      expect(search).toHaveBeenCalledWith(expect.objectContaining({
        query: expect.objectContaining({ bool: expect.objectContaining({ must: expect.anything() }) }),
      }))
    })

    it('adds outcome term filter when outcome is provided', async () => {
      const { search } = getMocks()
      search.mockResolvedValueOnce(mockResult([], 0))
      await service.search({ outcome: 'FORBIDDEN' })
      const call = search.mock.calls[0][0]
      expect(call.query.bool.filter).toEqual(
        expect.arrayContaining([{ term: { outcome: 'FORBIDDEN' } }]),
      )
    })

    it('adds range filter when fromDate/toDate are provided', async () => {
      const { search } = getMocks()
      search.mockResolvedValueOnce(mockResult([], 0))
      await service.search({ fromDate: '2026-01-01', toDate: '2026-12-31' })
      const call = search.mock.calls[0][0]
      const rangeFilter = call.query.bool.filter.find((f: any) => f.range)
      expect(rangeFilter).toEqual({ range: { createdAt: { gte: '2026-01-01', lte: '2026-12-31' } } })
    })

    it('maps hits and returns total count', async () => {
      const { search } = getMocks()
      search.mockResolvedValueOnce(mockResult([makeHit('id1', { action: 'LOGIN' })], 1))
      const result = await service.search({})
      expect(result).toEqual({ data: [{ id: 'id1', action: 'LOGIN' }], total: 1 })
    })

    it('returns empty result when ES is unavailable', async () => {
      const { search } = getMocks()
      search.mockRejectedValueOnce(new Error('ES down'))
      const result = await service.search({ q: 'anything' })
      expect(result).toEqual({ data: [], total: 0 })
    })
  })
})
