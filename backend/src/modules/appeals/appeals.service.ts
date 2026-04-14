import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AppealsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement appeal workflow
  async getAppealsForManager(_managerId: string) { return [] }
  async createAppeal(_employeeId: string, _dto: unknown) { return null }
  async respondToAppeal(_appealId: string, _managerId: string, _response: string) { return null }
}
