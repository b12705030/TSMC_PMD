import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common'
import { ConfigService } from './config.service'
import { UpdateConfigDto } from './dto/update-config.dto'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Role } from '../../common/enums/role.enum'
import type { SessionUser } from '../../common/types/request.types'

@Controller('config')
@UseGuards(AuthGuard, RolesGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  // GET /config/region — 取得當前 user 地區的所有設定
  @Get('region')
  @Roles(Role.Admin, Role.GlobalHR, Role.RegionalHR, Role.Manager, Role.Supervisor, Role.Employee)
  getMyRegionConfig(@CurrentUser() user: SessionUser) {
    return this.configService.getMyRegionConfig(user)
  }

  // GET /config/region/:regionId — 取得指定地區的設定（Admin/GlobalHR only）
  @Get('region/:regionId')
  @Roles(Role.Admin, Role.GlobalHR)
  getRegionConfig(@Param('regionId') regionId: string, @CurrentUser() user: SessionUser) {
    return this.configService.getRegionConfig(regionId, user)
  }

  // PUT /config/region/:key — 更新一筆設定（Admin 可跨地區；RegionalHR 限自己地區）
  @Put('region/:key')
  @Roles(Role.Admin, Role.RegionalHR)
  updateConfig(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.configService.updateConfig(key, dto, user)
  }
}
