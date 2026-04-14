import { Injectable, UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import type { LoginDto } from './dto/login.dto'

const SESSION_TTL_MS = 1000 * 60 * 60 * 8 // 8 hours

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async login(dto: LoginDto, ipAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { employeeId: dto.employeeId },
    })

    if (!user) throw new UnauthorizedException('Invalid credentials')

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash)
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials')

    const sessionId = uuidv4()
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    void this.audit.log({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      resource: 'auth',
      resourceId: user.id,
      detail: { employeeId: user.employeeId },
      ipAddress,
    })

    return { sessionId, user }
  }

  async logout(sessionId: string, userId: string, ipAddress: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } })

    void this.audit.log({
      userId,
      userName: '',
      action: 'LOGOUT',
      resource: 'auth',
      resourceId: userId,
      detail: {},
      ipAddress,
    })
  }

  async getMe(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or invalid')
    }

    const { user } = session
    return {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      region: user.region,
      department: user.department,
      jobLevel: user.jobLevel,
      jobTitle: user.jobTitle,
    }
  }
}
