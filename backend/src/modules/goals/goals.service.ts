import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement goal CRUD and progress updates
  async getMyGoals(_userId: string) { return [] }
  async getGoal(_id: string) { return null }
  async createGoal(_userId: string, _dto: unknown) { return null }
  async updateGoal(_id: string, _dto: unknown) { return null }
  async addProgressUpdate(_goalId: string, _userId: string, _content: string) { return null }
  async getGoalsByEmployee(_employeeId: string) { return [] }
}
