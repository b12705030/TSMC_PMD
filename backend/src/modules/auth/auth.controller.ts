import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { AuthGuard } from '../../common/guards/auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { SessionUser } from '../../common/types/request.types'

const COOKIE_NAME = 'sessionId'
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 1000 * 60 * 60 * 8, // 8 hours
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = (req.ip ?? req.socket.remoteAddress) ?? 'unknown'
    const { sessionId, user } = await this.authService.login(dto, ip)
    res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS)
    return { user }
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const sessionId = req.cookies?.[COOKIE_NAME] as string | undefined
    if (!sessionId) throw new UnauthorizedException()
    const ip = (req.ip ?? req.socket.remoteAddress) ?? 'unknown'
    await this.authService.logout(sessionId, user.id, user.name, user.regionId, ip)
    res.clearCookie(COOKIE_NAME)
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@CurrentUser() user: SessionUser) {
    return user
  }
}
