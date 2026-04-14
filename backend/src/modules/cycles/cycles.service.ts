import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement cycle management
  async getCycles(_region: string) { return [] }
  async getCycle(_id: string) { return null }
  async createCycle(_dto: unknown) { return null }
  async updateCycleStatus(_id: string, _status: string) { return null }
}
