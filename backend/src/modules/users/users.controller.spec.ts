import { UsersController } from './users.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockUsersService = {
  listUsers:            jest.fn(),
  createUser:           jest.fn(),
  getDepartments:       jest.fn(),
  getTeamMembers:       jest.fn(),
  getTeamHierarchy:     jest.fn(),
  getDistinctRegions:   jest.fn(),
  getDistinctJobLevels: jest.fn(),
  getDistinctJobTitles: jest.fn(),
  getGroupedJobTitles:  jest.fn(),
  updateUser:           jest.fn(),
  getEmployee:          jest.fn(),
}

const mockGoalsService = {
  getGoalsByEmployee: jest.fn(),
}

const mockReviewsService = {
  getReviewsByEmployee: jest.fn(),
}

const user: SessionUser = {
  id:           'u1',
  employeeId:   'e1',
  name:         'Ada',
  email:        'ada@test.local',
  role:         Role.Manager,
  regionId:     'region-tw',
  region:       'Taiwan',
  departmentId: 'dept-1',
  department:   'Engineering',
  jobLevel:     'L2',
  jobTitle:     'Engineer',
}

describe('UsersController', () => {
  let controller: UsersController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new UsersController(mockUsersService as any, mockGoalsService as any, mockReviewsService as any)
  })

  it('parses pagination query params when listing users', async () => {
    mockUsersService.listUsers.mockResolvedValueOnce({ users: [], total: 0 })

    await controller.listUsers('ada', 'Employee', 'region-tw', '10', '25')

    expect(mockUsersService.listUsers).toHaveBeenCalledWith({
      search: 'ada',
      role: 'Employee',
      regionId: 'region-tw',
      from: 10,
      size: 25,
    })
  })

  it('uses default pagination when query params are absent', async () => {
    mockUsersService.listUsers.mockResolvedValueOnce({ users: [], total: 0 })

    await controller.listUsers()

    expect(mockUsersService.listUsers).toHaveBeenCalledWith({
      search: undefined,
      role: undefined,
      regionId: undefined,
      from: 0,
      size: 50,
    })
  })

  it('delegates create and update user calls', async () => {
    const createDto = { employeeId: 'e2', name: 'New', email: 'new@test.local', role: Role.Employee, regionId: 'r1', departmentId: 'd1', jobLevel: 'L2', jobTitle: 'Engineer' }
    const updateDto = { role: Role.Supervisor, jobTitle: 'Lead' }
    mockUsersService.createUser.mockResolvedValueOnce({ id: 'u2' })
    mockUsersService.updateUser.mockResolvedValueOnce({ id: 'u2' })

    await controller.createUser(createDto)
    await controller.updateUser('u2', updateDto)

    expect(mockUsersService.createUser).toHaveBeenCalledWith(createDto)
    expect(mockUsersService.updateUser).toHaveBeenCalledWith('u2', updateDto)
  })

  it('delegates team and metadata endpoints to users service', async () => {
    await controller.getTeam(user)
    await controller.getTeamHierarchy(user)
    await controller.getRegions()
    await controller.getJobLevels(user)
    await controller.getJobTitles(user)
    await controller.getJobTitlesGrouped(user)
    await controller.getDepartments('region-tw')

    expect(mockUsersService.getTeamMembers).toHaveBeenCalledWith(user)
    expect(mockUsersService.getTeamHierarchy).toHaveBeenCalledWith(user)
    expect(mockUsersService.getDistinctRegions).toHaveBeenCalled()
    expect(mockUsersService.getDistinctJobLevels).toHaveBeenCalledWith(user)
    expect(mockUsersService.getDistinctJobTitles).toHaveBeenCalledWith(user)
    expect(mockUsersService.getGroupedJobTitles).toHaveBeenCalledWith(user)
    expect(mockUsersService.getDepartments).toHaveBeenCalledWith('region-tw')
  })

  it('delegates employee detail, goals, and reviews lookups', async () => {
    await controller.getEmployee('emp-1', user)
    await controller.getEmployeeGoals('emp-1', user)
    await controller.getEmployeeReviews('emp-1', user)

    expect(mockUsersService.getEmployee).toHaveBeenCalledWith('emp-1', user)
    expect(mockGoalsService.getGoalsByEmployee).toHaveBeenCalledWith('emp-1', user)
    expect(mockReviewsService.getReviewsByEmployee).toHaveBeenCalledWith('emp-1', user)
  })
})
