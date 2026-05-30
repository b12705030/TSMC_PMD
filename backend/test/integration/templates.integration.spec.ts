import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { CycleStatus, Role, TemplateStatus, QuestionType } from '@prisma/client'
import { truncateAll, connectTestDb } from '../helpers/db'
import {
  createUser,
  createRegion,
  createDepartment,
  createCycle,
  createTemplate,
  toSessionUser,
} from '../helpers/seed'
import { createTemplatesService, disconnectTestDb } from '../helpers/integration-setup'

const baseQuestions = [
  {
    questionText: 'Achievement',
    questionType: QuestionType.Text,
    required:     true,
    orderIndex:   0,
    options:      [],
  },
]

describe('TemplatesService (integration)', () => {
  const templates = createTemplatesService()

  beforeAll(async () => {
    await connectTestDb()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  beforeEach(async () => {
    await truncateAll()
  })

  it('RegionalHR creates template for cycle in own region', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const hr = await createUser(Role.RegionalHR, region, dept)
    const cycle = await createCycle(region, { status: CycleStatus.GoalSetting })

    const template = await templates.createTemplate(
      {
        name:          'HR Template',
        cycleId:       cycle.id,
        appliesGrades: ['L2'],
        applyTitles:   ['Software Engineer'],
        questions:     baseQuestions,
      },
      toSessionUser(hr),
    )

    expect(template.regionId).toBe(region.id)
    expect(template.questions).toHaveLength(1)
  })

  it('RegionalHR cannot create template for cycle in another region', async () => {
    const tw = await createRegion({ name: 'Taiwan', code: 'TW' })
    const us = await createRegion({ name: 'US', code: 'US' })
    const twDept = await createDepartment(tw)
    const hr = await createUser(Role.RegionalHR, tw, twDept)
    const usCycle = await createCycle(us)

    await expect(
      templates.createTemplate(
        {
          name:          'Bad',
          cycleId:       usCycle.id,
          appliesGrades: ['L2'],
          applyTitles:   ['Software Engineer'],
          questions:     baseQuestions,
        },
        toSessionUser(hr),
      ),
    ).rejects.toThrow(ForbiddenException)
  })

  it('publishTemplate succeeds when no conflicting published template', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const hr = await createUser(Role.RegionalHR, region, dept)
    const cycle = await createCycle(region)
    const draft = await createTemplate(cycle, region, hr, {
      appliesGrades: ['L2'],
      applyTitles:   ['Software Engineer'],
    })

    const published = await templates.publishTemplate(draft.id, toSessionUser(hr))
    expect(published.status).toBe(TemplateStatus.Published)
  })

  it('publishTemplate fails when grade/title overlap with existing published template', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const hr = await createUser(Role.RegionalHR, region, dept)
    const cycle = await createCycle(region)
    const first = await createTemplate(cycle, region, hr, {
      appliesGrades: ['L2', 'L3'],
      applyTitles:   ['Software Engineer'],
      status:        TemplateStatus.Published,
    })
    const second = await createTemplate(cycle, region, hr, {
      name:          'Overlap template',
      appliesGrades: ['L2'],
      applyTitles:   ['Software Engineer'],
    })

    await expect(
      templates.publishTemplate(second.id, toSessionUser(hr)),
    ).rejects.toThrow(BadRequestException)

    expect(first.status).toBe(TemplateStatus.Published)
  })
})
