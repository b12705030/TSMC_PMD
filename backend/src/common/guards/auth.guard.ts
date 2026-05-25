import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { RequestWithUser } from '../types/request.types'

const IDLE_TIMEOUT_MS = 1000 * 60 * 30 // 30 分鐘閒置自動過期

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

    // 閒置逾時檢查
    const idleMs = Date.now() - session.lastActiveAt.getTime()
    if (idleMs > IDLE_TIMEOUT_MS) {
      await this.prisma.session.delete({ where: { id: sessionId } })
      throw new UnauthorizedException('Session idle timeout')
    }

    // 非同步更新 lastActiveAt（不阻塞請求）
    void this.prisma.session.update({
      where: { id: sessionId },
      data:  { lastActiveAt: new Date() },
    })

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
