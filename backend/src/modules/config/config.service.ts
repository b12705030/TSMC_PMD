import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { isGlobalRole } from '../../common/utils/region.util'
import type { SessionUser } from '../../common/types/request.types'
import type { UpdateConfigDto } from './dto/update-config.dto'

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /config/region — current user's region config (or all regions for Admin/GlobalHR)
  async getMyRegionConfig(user: SessionUser) {
    const where = isGlobalRole(user) ? {} : { regionId: user.regionId }
    return this.prisma.regionConfig.findMany({
      where,
      include: { region: { select: { id: true, name: true, code: true } } },
      orderBy: [{ regionId: 'asc' }, { key: 'asc' }],
    })
  }

  // GET /config/region/:regionId — specific region config (Admin/GlobalHR only)
  async getRegionConfig(regionId: string, user: SessionUser) {
    if (!isGlobalRole(user)) throw new ForbiddenException()
    return this.prisma.regionConfig.findMany({
      where:   { regionId },
      include: { region: { select: { id: true, name: true, code: true } } },
      orderBy: { key: 'asc' },
    })
  }

  // PUT /config/region/:key — update one config entry for the user's region
  async updateConfig(key: string, dto: UpdateConfigDto, user: SessionUser) {
    if (!isGlobalRole(user) && user.role !== Role.RegionalHR) {
      throw new ForbiddenException()
    }

    // Admin can supply an explicit regionId to update other regions; others can only update their own
    const targetRegionId = (user.role === Role.Admin && dto.regionId)
      ? dto.regionId
      : user.regionId

    const existing = await this.prisma.regionConfig.findUnique({
      where: { regionId_key: { regionId: targetRegionId, key } },
    })
    if (!existing) throw new NotFoundException(`Config key "${key}" not found for region`)

    return this.prisma.regionConfig.update({
      where: { regionId_key: { regionId: targetRegionId, key } },
      data:  { value: dto.value },
      include: { region: { select: { id: true, name: true, code: true } } },
    })
  }
}
