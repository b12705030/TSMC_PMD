import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement template management
  async getTemplates(_region: string) { return [] }
  async getTemplate(_id: string) { return null }
  async createTemplate(_dto: unknown) { return null }
  async updateTemplate(_id: string, _dto: unknown) { return null }
}
