import { TemplatesController } from './templates.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockTemplatesService = {
  getTemplatesByRegion:    jest.fn(),
  getTemplates:            jest.fn(),
  getTemplate:             jest.fn(),
  createTemplate:          jest.fn(),
  addCustomQuestion:       jest.fn(),
  deleteCustomQuestion:    jest.fn(),
  publishTemplate:         jest.fn(),
  setQuestionGlobalLock:   jest.fn(),
}

const user: SessionUser = {
  id:           'u1',
  employeeId:   'e1',
  name:         'Ada',
  email:        'ada@test.local',
  role:         Role.RegionalHR,
  regionId:     'region-tw',
  region:       'Taiwan',
  departmentId: 'dept-1',
  department:   'Engineering',
  jobLevel:     'L2',
  jobTitle:     'Engineer',
}

describe('TemplatesController', () => {
  let controller: TemplatesController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new TemplatesController(mockTemplatesService as any)
  })

  it('delegates compare, list, and detail reads to the service', async () => {
    await controller.compareTemplates('cycle-1')
    await controller.getTemplates(user)
    await controller.getTemplate('tpl-1', user)

    expect(mockTemplatesService.getTemplatesByRegion).toHaveBeenCalledWith('cycle-1')
    expect(mockTemplatesService.getTemplates).toHaveBeenCalledWith(user)
    expect(mockTemplatesService.getTemplate).toHaveBeenCalledWith('tpl-1', user)
  })

  it('delegates template creation with body and current user', async () => {
    const dto = { name: 'Template', cycleId: 'cycle-1', appliesGrades: ['L2'], applyTitles: ['Engineer'], questions: [] }

    await controller.createTemplate(dto as any, user)

    expect(mockTemplatesService.createTemplate).toHaveBeenCalledWith(dto, user)
  })

  it('delegates custom question actions', async () => {
    const dto = { questionText: 'Q', questionType: 'Text', required: true }

    await controller.addCustomQuestion('tpl-1', dto as any, user)
    await controller.deleteCustomQuestion('tpl-1', 'q-1', user)

    expect(mockTemplatesService.addCustomQuestion).toHaveBeenCalledWith('tpl-1', dto, user)
    expect(mockTemplatesService.deleteCustomQuestion).toHaveBeenCalledWith('tpl-1', 'q-1', user)
  })

  it('delegates publish and global lock actions', async () => {
    await controller.publishTemplate('tpl-1', user)
    await controller.lockQuestion('tpl-1', 'q-1', true, user)

    expect(mockTemplatesService.publishTemplate).toHaveBeenCalledWith('tpl-1', user)
    expect(mockTemplatesService.setQuestionGlobalLock).toHaveBeenCalledWith('tpl-1', 'q-1', true, user)
  })
})
