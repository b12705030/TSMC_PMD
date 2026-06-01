import { ReviewsController } from './reviews.controller'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

const mockReviewsService = {
  getMyReviews:          jest.fn(),
  getTeamReviews:        jest.fn(),
  getCycleReviews:       jest.fn(),
  publishAll:            jest.fn(),
  getReviewStats:        jest.fn(),
  getReview:             jest.fn(),
  saveEmployeeAnswers:   jest.fn(),
  submitEmployee:        jest.fn(),
  saveSupervisorReview:  jest.fn(),
  submitSupervisor:      jest.fn(),
  calibrate:             jest.fn(),
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

describe('ReviewsController', () => {
  let controller: ReviewsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new ReviewsController(mockReviewsService as any)
  })

  it('delegates collection and stats endpoints to the service', async () => {
    await controller.getMyReviews(user)
    await controller.getTeamReviews(user)
    await controller.getCycleReviews('cycle-1', user)
    await controller.getReviewStats(user)

    expect(mockReviewsService.getMyReviews).toHaveBeenCalledWith('u1')
    expect(mockReviewsService.getTeamReviews).toHaveBeenCalledWith(user)
    expect(mockReviewsService.getCycleReviews).toHaveBeenCalledWith('cycle-1', user)
    expect(mockReviewsService.getReviewStats).toHaveBeenCalledWith(user)
  })

  it('delegates review detail and employee answer actions', async () => {
    const answersDto = { answers: [{ questionId: 'q1', answer: 'done' }] }

    await controller.getReview('review-1', user)
    await controller.saveEmployeeAnswers('review-1', user, answersDto)
    await controller.submitEmployee('review-1', user)

    expect(mockReviewsService.getReview).toHaveBeenCalledWith('review-1', user)
    expect(mockReviewsService.saveEmployeeAnswers).toHaveBeenCalledWith('review-1', user, answersDto)
    expect(mockReviewsService.submitEmployee).toHaveBeenCalledWith('review-1', user)
  })

  it('delegates supervisor review actions', async () => {
    const dto = { answers: [{ questionId: 'q1', answer: 'good' }], comment: 'ok', grade: 'S' }

    await controller.saveSupervisorReview('review-1', user, dto as any)
    await controller.submitSupervisor('review-1', user)

    expect(mockReviewsService.saveSupervisorReview).toHaveBeenCalledWith('review-1', user, dto)
    expect(mockReviewsService.submitSupervisor).toHaveBeenCalledWith('review-1', user)
  })

  it('delegates calibration and publish actions', async () => {
    const calibrateDto = { grade: 'S_Plus', rank: 1 }

    await controller.calibrate('review-1', user, calibrateDto as any)
    await controller.publishAll('cycle-1', user)

    expect(mockReviewsService.calibrate).toHaveBeenCalledWith('review-1', user, calibrateDto)
    expect(mockReviewsService.publishAll).toHaveBeenCalledWith('cycle-1', user)
  })
})
