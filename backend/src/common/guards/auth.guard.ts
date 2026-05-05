import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { RequestWithUser } from '../types/request.types'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>()
    const sessionId = request.cookies?.sessionId as string | undefined

    if (!sessionId) throw new UnauthorizedException('Not authenticated')

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { include: { region: true, department: true } } },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or invalid')
    }

    const { user } = session
    request.user = {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role as import('../enums/role.enum').Role,
      regionId: user.regionId,
      region: user.region.name,
      departmentId: user.departmentId,
      department: user.department.name,
      jobLevel: user.jobLevel,
      jobTitle: user.jobTitle,
    }

    return true
  }
}
