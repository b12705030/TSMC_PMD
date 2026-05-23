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
    const raw = await this.prisma.user.findUnique({
      where: { employeeId: dto.employeeId },
    })

    if (!raw) throw new UnauthorizedException('Invalid credentials')

    const passwordMatch = await bcrypt.compare(dto.password, raw.passwordHash)
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials')

    const sessionId = uuidv4()
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: raw.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    void this.audit.log({
      userId:       raw.id,
      userName:     raw.name,
      userRegionId: raw.regionId,
      action:       'LOGIN',
      outcome:      'SUCCESS',
      resource:     'auth',
      resourceId:   raw.id,
      httpMethod:   'POST',
      httpPath:     '/auth/login',
      httpStatus:   200,
      detail:       { employeeId: raw.employeeId },
      ipAddress,
      createdAt:    new Date(),
    })

    // Reload with relations so the response has region/department names
    const user = await this.prisma.user.findUnique({
      where: { id: raw.id },
      include: { region: true, department: true },
    })

    return {
      sessionId,
      user: {
        id:           user!.id,
        employeeId:   user!.employeeId,
        name:         user!.name,
        email:        user!.email,
        role:         user!.role,
        regionId:     user!.regionId,
        region:       user!.region.name,
        departmentId: user!.departmentId,
        department:   user!.department.name,
        jobLevel:     user!.jobLevel,
        jobTitle:     user!.jobTitle,
      },
    }
  }

  async logout(sessionId: string, userId: string, userName: string, userRegionId: string, ipAddress: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } })

    void this.audit.log({
      userId,
      userName,
      userRegionId,
      action:       'LOGOUT',
      outcome:      'SUCCESS',
      resource:     'auth',
      resourceId:   userId,
      httpMethod:   'POST',
      httpPath:     '/auth/logout',
      httpStatus:   204,
      detail:       {},
      ipAddress,
      createdAt:    new Date(),
    })
  }

  async getMe(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { include: { region: true, department: true } } },
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
      regionId: user.regionId,
      region: user.region.name,
      departmentId: user.departmentId,
      department: user.department.name,
      jobLevel: user.jobLevel,
      jobTitle: user.jobTitle,
    }
  }
}
