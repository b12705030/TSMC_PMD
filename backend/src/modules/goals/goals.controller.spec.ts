import { GoalsController } from './goals.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockGoalsService = {
  getMyGoals:           jest.fn(),
  getTeamGoals:         jest.fn(),
  getGoalsByEmployee:   jest.fn(),
  getGoal:              jest.fn(),
  createGoal:           jest.fn(),
  updateGoal:           jest.fn(),
  addProgressUpdate:    jest.fn(),
  addMilestone:         jest.fn(),
  toggleMilestone:      jest.fn(),
  updateMilestoneNote:  jest.fn(),
  updateMilestoneUrl:   jest.fn(),
  reorderMilestones:    jest.fn(),
  deleteMilestone:      jest.fn(),
  approveGoal:          jest.fn(),
  rejectGoal:           jest.fn(),
  deleteGoal:           jest.fn(),
  submitGoal:           jest.fn(),
}

const user: SessionUser = {
  id:           'u1',
  employeeId:   'e1',
  name:         'Ada',
  email:        'ada@test.local',
  role:         Role.Employee,
  regionId:     'region-tw',
  region:       'Taiwan',
  departmentId: 'dept-1',
  department:   'Engineering',
  jobLevel:     'L2',
  jobTitle:     'Engineer',
}

describe('GoalsController', () => {
  let controller: GoalsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new GoalsController(mockGoalsService as any)
  })

  it('delegates collection and detail reads to the service', async () => {
    await controller.getMyGoals(user)
    await controller.getTeamGoals(user)
    await controller.getEmployeeGoalsInline('emp-1', user)
    await controller.getGoal('goal-1', user)

    expect(mockGoalsService.getMyGoals).toHaveBeenCalledWith('u1')
    expect(mockGoalsService.getTeamGoals).toHaveBeenCalledWith(user)
    expect(mockGoalsService.getGoalsByEmployee).toHaveBeenCalledWith('emp-1', user)
    expect(mockGoalsService.getGoal).toHaveBeenCalledWith('goal-1', user)
  })

  it('delegates goal create/update/progress endpoints', async () => {
    const createDto = { title: 'Goal', description: 'd', metric: 'm', targetValue: 't', relevance: 'r', dueDate: '2026-12-31' }
    const updateDto = { title: 'Updated' }

    await controller.createGoal(user, createDto)
    await controller.updateGoal('goal-1', user, updateDto)
    await controller.addProgress('goal-1', user, 'progress')

    expect(mockGoalsService.createGoal).toHaveBeenCalledWith(user, createDto)
    expect(mockGoalsService.updateGoal).toHaveBeenCalledWith('goal-1', user, updateDto)
    expect(mockGoalsService.addProgressUpdate).toHaveBeenCalledWith('goal-1', user, 'progress')
  })

  it('delegates milestone endpoints and normalizes nullable note/url bodies', async () => {
    await controller.addMilestone('goal-1', user, 'Milestone')
    await controller.toggleMilestone('goal-1', 'm-1', user, 'done')
    await controller.updateMilestoneNote('goal-1', 'm-1', user, undefined as unknown as string | null)
    await controller.updateMilestoneUrl('goal-1', 'm-1', user, undefined as unknown as string | null)
    await controller.reorderMilestones('goal-1', user, ['m-2', 'm-1'])
    await controller.deleteMilestone('goal-1', 'm-1', user)

    expect(mockGoalsService.addMilestone).toHaveBeenCalledWith('goal-1', user, 'Milestone')
    expect(mockGoalsService.toggleMilestone).toHaveBeenCalledWith('goal-1', 'm-1', user, 'done')
    expect(mockGoalsService.updateMilestoneNote).toHaveBeenCalledWith('goal-1', 'm-1', user, null)
    expect(mockGoalsService.updateMilestoneUrl).toHaveBeenCalledWith('goal-1', 'm-1', user, null)
    expect(mockGoalsService.reorderMilestones).toHaveBeenCalledWith('goal-1', ['m-2', 'm-1'], user)
    expect(mockGoalsService.deleteMilestone).toHaveBeenCalledWith('goal-1', 'm-1', user)
  })

  it('delegates approval, rejection, deletion, and submission actions', async () => {
    await controller.approveGoal('goal-1', user)
    await controller.rejectGoal('goal-1', user, { reason: 'needs work' })
    await controller.deleteGoal('goal-1', user)
    await controller.submitGoal('goal-1', user)

    expect(mockGoalsService.approveGoal).toHaveBeenCalledWith('goal-1', user)
    expect(mockGoalsService.rejectGoal).toHaveBeenCalledWith('goal-1', user, 'needs work')
    expect(mockGoalsService.deleteGoal).toHaveBeenCalledWith('goal-1', user)
    expect(mockGoalsService.submitGoal).toHaveBeenCalledWith('goal-1', user)
  })
})
