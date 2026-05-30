import { BadRequestException } from '@nestjs/common'
import { CycleStatus, Role, TemplateStatus } from '@prisma/client'
import { truncateAll, connectTestDb } from '../helpers/db'
import {
  createUser,
  createRegion,
  createDepartment,
  createCycle,
  createTemplate,
  toSessionUser,
} from '../helpers/seed'
import { createCyclesService, disconnectTestDb } from '../helpers/integration-setup'

describe('CyclesService (integration)', () => {
  const cycles = createCyclesService()

  beforeAll(async () => {
    await connectTestDb()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  beforeEach(async () => {
    await truncateAll()
  })

  it('advanceStatus to EmployeeReview fails without published template', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const hr = await createUser(Role.RegionalHR, region, dept)
    const cycle = await createCycle(region, { status: CycleStatus.InProgress })

    await expect(
      cycles.advanceStatus(cycle.id, toSessionUser(hr)),
    ).rejects.toThrow(BadRequestException)
  })

  it('advanceStatus from InProgress to EmployeeReview succeeds with published template', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const manager = await createUser(Role.Manager, region, dept)
    const hr = await createUser(Role.RegionalHR, region, dept)
    await createUser(Role.Employee, region, dept, {
      managerId: manager.id,
      jobLevel:  'L2',
      jobTitle:  'Software Engineer',
    })
    const cycle = await createCycle(region, { status: CycleStatus.InProgress })
    await createTemplate(cycle, region, hr, {
      status:        TemplateStatus.Published,
      appliesGrades: ['L2'],
      applyTitles:   ['Software Engineer'],
    })

    const advanced = await cycles.advanceStatus(cycle.id, toSessionUser(hr))
    expect(advanced.status).toBe(CycleStatus.EmployeeReview)

    const { prisma } = await import('../helpers/db')
    const reviewCount = await prisma.performanceReview.count({ where: { cycleId: cycle.id } })
    expect(reviewCount).toBeGreaterThanOrEqual(1)
  })
})
