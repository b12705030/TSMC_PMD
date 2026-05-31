import { Injectable, UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import type { LoginDto } from './dto/login.dto'

const SESSION_TTL_MS   = 1000 * 60 * 60 * 8 // 8 hours
const MAX_ATTEMPTS     = 5
const LOCKOUT_MS       = 1000 * 60 * 10      // 10 minutes

interface AttemptRecord { count: number; lockedUntil: number | null }

@Injectable()
export class AuthService {
  // 帳號鎖定記錄（key = employeeId）— 重啟後重置，足夠用於開發/demo
  private readonly loginAttempts = new Map<string, AttemptRecord>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private getAttemptRecord(employeeId: string): AttemptRecord {
    if (!this.loginAttempts.has(employeeId)) {
      this.loginAttempts.set(employeeId, { count: 0, lockedUntil: null })
    }
    return this.loginAttempts.get(employeeId)!
  }

  async login(dto: LoginDto, ipAddress: string) {
    // ── 帳號鎖定檢查 ────────────────────────────────────────────────────────
    const record = this.getAttemptRecord(dto.employeeId)
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      const remainMinutes = Math.ceil((record.lockedUntil - Date.now()) / 60000)
      throw new UnauthorizedException(
        `Account locked due to too many failed attempts. Try again in ${remainMinutes} minute(s).`
      )
    }
    // 鎖定時間已過，重置
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
      record.count = 0
      record.lockedUntil = null
    }

    const raw = await this.prisma.user.findUnique({
      where: { employeeId: dto.employeeId },
    })

    if (!raw) {
      // 帳號不存在也計入失敗次數（防止帳號列舉）
      record.count += 1
      if (record.count >= MAX_ATTEMPTS) record.lockedUntil = Date.now() + LOCKOUT_MS
      throw new UnauthorizedException('Invalid credentials')
    }

    const passwordMatch = await bcrypt.compare(dto.password, raw.passwordHash)
    if (!passwordMatch) {
      record.count += 1
      if (record.count >= MAX_ATTEMPTS) record.lockedUntil = Date.now() + LOCKOUT_MS
      throw new UnauthorizedException('Invalid credentials')
    }

    // 登入成功 → 重置計數
    record.count = 0
    record.lockedUntil = null

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
        managerId:    user!.managerId    ?? undefined,
        supervisorId: user!.supervisorId ?? undefined,
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
      id:           user.id,
      employeeId:   user.employeeId,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      regionId:     user.regionId,
      region:       user.region.name,
      departmentId: user.departmentId,
      department:   user.department.name,
      jobLevel:     user.jobLevel,
      jobTitle:     user.jobTitle,
      managerId:    user.managerId    ?? undefined,
      supervisorId: user.supervisorId ?? undefined,
    }
  }
}
