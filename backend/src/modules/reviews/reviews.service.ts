import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement review workflow
  async getMyReviews(_userId: string) { return [] }
  async getReview(_id: string) { return null }
  async submitEmployeeAnswers(_reviewId: string, _userId: string, _answers: unknown) { return null }
  async submitSupervisorEvaluation(_reviewId: string, _supervisorId: string, _dto: unknown) { return null }
  async publishReviews(_cycleId: string, _managerId: string) { return null }
  async getReviewsByEmployee(_employeeId: string) { return [] }
}
