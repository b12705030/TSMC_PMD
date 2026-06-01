import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { CycleStatus, GoalStatus, Role } from '@prisma/client'
import { truncateAll, connectTestDb } from '../helpers/db'
import {
  createUser,
  createRegion,
  createDepartment,
  createCycle,
  createGoal,
  toSessionUser,
} from '../helpers/seed'
import { createGoalsService, disconnectTestDb } from '../helpers/integration-setup'

const goalDto = {
  title:       'Test goal',
  description: 'desc',
  metric:      'metric',
  targetValue: '100',
  relevance:   'rel',
  dueDate:     '2026-12-31',
}

describe('GoalsService (integration)', () => {
  const goals = createGoalsService()

  beforeAll(async () => {
    await connectTestDb()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  beforeEach(async () => {
    await truncateAll()
  })

  it('employee creates a goal in Draft', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const employee = await createUser(Role.Employee, region, dept)
    const user = toSessionUser(employee)

    const goal = await goals.createGoal(user, goalDto)
    expect(goal.userId).toBe(employee.id)
    expect(goal.status).toBe(GoalStatus.Draft)
  })

  it('rejects linking goal to cycle in another region', async () => {
    const tw = await createRegion({ name: 'Taiwan', code: 'TW' })
    const us = await createRegion({ name: 'US', code: 'US' })
    const twDept = await createDepartment(tw)
    const usDept = await createDepartment(us)
    const employee = await createUser(Role.Employee, tw, twDept)
    const usCycle = await createCycle(us, { status: CycleStatus.GoalSetting })

    await expect(
      goals.createGoal(toSessionUser(employee), { ...goalDto, cycleId: usCycle.id }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('rejects linking goal to Completed cycle', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const employee = await createUser(Role.Employee, region, dept)
    const cycle = await createCycle(region, { status: CycleStatus.Completed })

    await expect(
      goals.createGoal(toSessionUser(employee), { ...goalDto, cycleId: cycle.id }),
    ).rejects.toThrow(BadRequestException)
  })

  it('owner can update goal; other employee cannot', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const owner = await createUser(Role.Employee, region, dept)
    const other = await createUser(Role.Employee, region, dept)
    const goal = await createGoal(owner)

    await goals.updateGoal(goal.id, toSessionUser(owner), { title: 'Updated' })
    const updated = await goals.getGoal(goal.id, toSessionUser(owner))
    expect(updated.title).toBe('Updated')

    await expect(
      goals.updateGoal(goal.id, toSessionUser(other), { title: 'Hacked' }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('supervisor approves pending goal', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const supervisor = await createUser(Role.Supervisor, region, dept)
    const employee = await createUser(Role.Employee, region, dept, {
      supervisorId: supervisor.id,
    })
    const goal = await createGoal(employee, { status: GoalStatus.PendingApproval })

    const approved = await goals.approveGoal(goal.id, toSessionUser(supervisor))
    expect(approved.status).toBe(GoalStatus.Approved)
  })

  it('employee submits draft goal for approval', async () => {
    const region = await createRegion()
    const dept = await createDepartment(region)
    const employee = await createUser(Role.Employee, region, dept)
    const goal = await createGoal(employee, { status: GoalStatus.Draft })

    const submitted = await goals.submitGoal(goal.id, toSessionUser(employee))
    expect(submitted.status).toBe(GoalStatus.PendingApproval)
  })
})
