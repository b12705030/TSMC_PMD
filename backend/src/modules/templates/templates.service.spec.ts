import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { TemplatesService } from './templates.service'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockPrisma = {
  formTemplate: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  performanceCycle: {
    findUnique: jest.fn(),
  },
  templateQuestion: {
    aggregate:  jest.fn(),
    create:     jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
}

const mockNotifications = {
  createForUsers: jest.fn().mockResolvedValue(undefined),
}

function user(role: Role, overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id:           'user-1',
    employeeId:   'emp001',
    name:         'Ada',
    email:        'ada@test.local',
    role,
    regionId:     'region-1',
    region:       'Taiwan',
    departmentId: 'dept-1',
    department:   'Engineering',
    jobLevel:     'L2',
    jobTitle:     'Engineer',
    ...overrides,
  }
}

const templateDto = {
  name:          'Template',
  cycleId:       'cycle-1',
  appliesGrades: ['L2'],
  applyTitles:   ['Engineer'],
  questions: [
    { questionText: 'Q1', questionType: 'Text', required: true, orderIndex: 0 },
  ],
}

describe('TemplatesService', () => {
  let service: TemplatesService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new TemplatesService(mockPrisma as any, mockNotifications as any)
  })

  it('maps region relation to a display string when listing templates', async () => {
    mockPrisma.formTemplate.findMany.mockResolvedValueOnce([
      { id: 'tpl-1', name: 'Template', region: { name: 'Taiwan' }, questions: [] },
    ])

    const result = await service.getTemplates(user(Role.RegionalHR))

    expect(result[0].region).toBe('Taiwan')
    expect(mockPrisma.formTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { regionId: 'region-1' },
    }))
  })

  it('creates templates in the cycle region', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-1' })
    mockPrisma.formTemplate.create.mockResolvedValueOnce({ id: 'tpl-1' })

    await service.createTemplate(templateDto as any, user(Role.RegionalHR))

    expect(mockPrisma.formTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ regionId: 'region-1', cycleId: 'cycle-1' }),
    }))
  })

  it('lets admins create globally locked base questions with explicit options', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-1' })
    mockPrisma.formTemplate.create.mockResolvedValueOnce({ id: 'tpl-1' })

    await service.createTemplate({
      ...templateDto,
      questions: [
        { questionText: 'Q1', questionType: 'MultipleChoice', options: ['A'], required: true, orderIndex: 0, isGlobal: true },
      ],
    } as any, user(Role.Admin))

    expect(mockPrisma.formTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        questions: {
          create: [expect.objectContaining({ options: ['A'], isGlobal: true })],
        },
      }),
    }))
  })

  it('blocks creating a template for a cycle outside the user region', async () => {
    mockPrisma.performanceCycle.findUnique.mockResolvedValueOnce({ id: 'cycle-1', regionId: 'region-2' })

    await expect(service.createTemplate(templateDto as any, user(Role.RegionalHR)))
      .rejects.toThrow(ForbiddenException)
  })

  it('adds manager custom questions at the next order index', async () => {
    mockPrisma.formTemplate.findUnique.mockResolvedValueOnce({ id: 'tpl-1', regionId: 'region-1' })
    mockPrisma.templateQuestion.aggregate.mockResolvedValueOnce({ _max: { orderIndex: 2 } })
    mockPrisma.templateQuestion.create.mockResolvedValueOnce({ id: 'q-1', orderIndex: 3 })

    const result = await service.addCustomQuestion('tpl-1', {
      questionText: 'Department question',
      questionType: 'Text',
      required: true,
    }, user(Role.Manager))

    expect(result.orderIndex).toBe(3)
    expect(mockPrisma.templateQuestion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isCustom: true, scopeDepartmentId: 'dept-1', orderIndex: 3 }),
    }))
  })

  it('defaults custom question order from zero when a template has no questions', async () => {
    mockPrisma.formTemplate.findUnique.mockResolvedValueOnce({ id: 'tpl-1', regionId: 'region-1' })
    mockPrisma.templateQuestion.aggregate.mockResolvedValueOnce({ _max: { orderIndex: null } })
    mockPrisma.templateQuestion.create.mockResolvedValueOnce({ id: 'q-1', orderIndex: 0 })

    const result = await service.addCustomQuestion('tpl-1', {
      questionText: 'Department question',
      questionType: 'MultipleChoice',
      options: ['A', 'B'],
      required: false,
    }, user(Role.Manager))

    expect(result.orderIndex).toBe(0)
    expect(mockPrisma.templateQuestion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ options: ['A', 'B'], orderIndex: 0 }),
    }))
  })

  it('prevents deleting globally locked or HR base questions', async () => {
    mockPrisma.templateQuestion.findUnique.mockResolvedValueOnce({
      id: 'q-1', templateId: 'tpl-1', isGlobal: true, isCustom: true, scopeDepartmentId: 'dept-1',
    })
    await expect(service.deleteCustomQuestion('tpl-1', 'q-1', user(Role.Manager)))
      .rejects.toThrow(ForbiddenException)

    mockPrisma.templateQuestion.findUnique.mockResolvedValueOnce({
      id: 'q-2', templateId: 'tpl-1', isGlobal: false, isCustom: false, scopeDepartmentId: 'dept-1',
    })
    await expect(service.deleteCustomQuestion('tpl-1', 'q-2', user(Role.Manager)))
      .rejects.toThrow(ForbiddenException)
  })

  it('prevents publishing templates with overlapping published coverage', async () => {
    mockPrisma.formTemplate.findUnique.mockResolvedValueOnce({
      id: 'tpl-1',
      cycleId: 'cycle-1',
      regionId: 'region-1',
      status: 'Draft',
      appliesGrades: ['L2'],
      applyTitles: ['Engineer'],
    })
    mockPrisma.formTemplate.findMany.mockResolvedValueOnce([{ id: 'tpl-2', name: 'Existing' }])

    await expect(service.publishTemplate('tpl-1', user(Role.RegionalHR))).rejects.toThrow(BadRequestException)
  })

  it('publishes templates and notifies managers in the region', async () => {
    mockPrisma.formTemplate.findUnique.mockResolvedValueOnce({
      id: 'tpl-1',
      cycleId: 'cycle-1',
      regionId: 'region-1',
      status: 'Draft',
      appliesGrades: ['L2'],
      applyTitles: ['Engineer'],
    })
    mockPrisma.formTemplate.findMany.mockResolvedValueOnce([])
    mockPrisma.formTemplate.update.mockResolvedValueOnce({ id: 'tpl-1', name: 'Template', status: 'Published', cycleId: 'cycle-1' })
    mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'mgr-1' }, { id: 'mgr-2' }])

    const result = await service.publishTemplate('tpl-1', user(Role.RegionalHR))

    expect(result.status).toBe('Published')
    expect(mockNotifications.createForUsers).toHaveBeenCalledWith(['mgr-1', 'mgr-2'], expect.objectContaining({ type: 'TemplatePublished' }))
  })

  it('only admins can change global lock', async () => {
    await expect(service.setQuestionGlobalLock('tpl-1', 'q-1', true, user(Role.Manager)))
      .rejects.toThrow(ForbiddenException)

    mockPrisma.templateQuestion.findUnique.mockResolvedValueOnce({ id: 'q-1', templateId: 'tpl-1' })
    mockPrisma.templateQuestion.update.mockResolvedValueOnce({ id: 'q-1', isGlobal: true })

    await expect(service.setQuestionGlobalLock('tpl-1', 'q-1', true, user(Role.Admin)))
      .resolves.toEqual(expect.objectContaining({ isGlobal: true }))
  })

  it('throws not found when template is missing', async () => {
    mockPrisma.formTemplate.findUnique.mockResolvedValueOnce(null)

    await expect(service.getTemplate('missing', user(Role.Admin))).rejects.toThrow(NotFoundException)
  })
})
