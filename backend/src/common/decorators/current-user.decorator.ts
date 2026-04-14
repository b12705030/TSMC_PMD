import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { RequestWithUser } from '../types/request.types'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>()
    return request.user
  }
)
