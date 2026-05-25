import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service'
import type { SessionUser } from '../../common/types/request.types'
import { Role } from '../../common/enums/role.enum'
import type { CreateUserDto } from './dto/create-user.dto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeamMembers(currentUser: SessionUser) {
    if (currentUser.role === Role.Manager) {
      const users = await this.prisma.user.findMany({
        where: { supervisor: { managerId: currentUser.id } },
        include: { region: true, department: true },
      })
      return users.map(flattenUser)
    }

    if (currentUser.role === Role.Supervisor) {
      const users = await this.prisma.user.findMany({
        where: { supervisorId: currentUser.id },
        include: { region: true, department: true },
      })
      return users.map(flattenUser)
    }

    return []
  }

  async getTeamHierarchy(currentUser: SessionUser) {
    const [supervisors, directReports] = await Promise.all([
      this.prisma.user.findMany({
        where: { managerId: currentUser.id, role: Role.Supervisor },
        include: {
          region: true,
          department: true,
          supervisedUsers: { include: { region: true, department: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { managerId: currentUser.id, supervisorId: null, role: Role.Employee },
        include: { region: true, department: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return {
      groups: supervisors.map((sup) => ({
        supervisor: flattenUser(sup),
        employees:  sup.supervisedUsers.map(flattenUser),
      })),
      directReports: directReports.map(flattenUser),
    }
  }

  async getDistinctRegions() {
    return this.prisma.region.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    })
  }

  async getDistinctJobLevels(user: SessionUser): Promise<string[]> {
    const isGlobal = user.role === Role.Admin || user.role === Role.GlobalHR
    const rows = await this.prisma.user.findMany({
      where: isGlobal ? {} : { regionId: user.regionId },
      select: { jobLevel: true },
      distinct: ['jobLevel'],
      orderBy: { jobLevel: 'asc' },
    })
    return rows.map((r) => r.jobLevel)
  }

  async getDistinctJobTitles(user: SessionUser): Promise<string[]> {
    const isGlobal = user.role === Role.Admin || user.role === Role.GlobalHR
    const rows = await this.prisma.user.findMany({
      where: isGlobal ? {} : { regionId: user.regionId },
      select: { jobTitle: true },
      distinct: ['jobTitle'],
      orderBy: { jobTitle: 'asc' },
    })
    return rows.map((r) => r.jobTitle)
  }

  async getEmployee(id: string, currentUser: SessionUser) {
    const target = await this.prisma.user.findUnique({
      where:   { id },
      include: { region: true, department: true, supervisor: { select: { managerId: true } } },
    })
    if (!target) return null

    if (currentUser.role !== Role.Admin && currentUser.role !== Role.GlobalHR) {
      if (currentUser.role === Role.RegionalHR) {
        if (target.regionId !== currentUser.regionId) throw new ForbiddenException()
      } else if (currentUser.role === Role.Supervisor) {
        if (target.supervisorId !== currentUser.id) throw new ForbiddenException()
      } else if (currentUser.role === Role.Manager) {
        const isDirectReport = target.managerId === currentUser.id && !target.supervisorId
        const isViaSuper     = target.supervisor?.managerId === currentUser.id
        if (!isDirectReport && !isViaSuper) throw new ForbiddenException()
      }
    }

    const { supervisor: _sv, ...rest } = target
    return flattenUser(rest as UserWithRelations)
  }

  async listUsers(opts: {
    search?: string
    role?: string
    regionId?: string
    from?: number
    size?: number
  }) {
    const { search, role, regionId, from = 0, size = 50 } = opts
    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name:       { contains: search, mode: 'insensitive' } },
        { email:      { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (role)     where.role     = role
    if (regionId) where.regionId = regionId

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { region: true, department: true },
        orderBy: { name: 'asc' },
        skip: from,
        take: size,
      }),
      this.prisma.user.count({ where }),
    ])

    return { users: users.map(flattenUser), total }
  }

  async createUser(dto: CreateUserDto) {
    const [byEid, byEmail] = await Promise.all([
      this.prisma.user.findUnique({ where: { employeeId: dto.employeeId } }),
      this.prisma.user.findUnique({ where: { email: dto.email } }),
    ])
    if (byEid)   throw new ConflictException(`Employee ID "${dto.employeeId}" already exists`)
    if (byEmail) throw new ConflictException(`Email "${dto.email}" already exists`)

    const passwordHash = await bcrypt.hash('TSMC@1234', 10)
    const created = await this.prisma.user.create({
      data: {
        employeeId:   dto.employeeId,
        name:         dto.name,
        email:        dto.email,
        role:         dto.role as unknown as Role,
        regionId:     dto.regionId,
        departmentId: dto.departmentId,
        jobLevel:     dto.jobLevel,
        jobTitle:     dto.jobTitle,
        passwordHash,
      },
      include: { region: true, department: true },
    })
    return flattenUser(created)
  }

  async getDepartments(regionId?: string) {
    return this.prisma.department.findMany({
      where: regionId ? { regionId } : {},
      select: { id: true, name: true, regionId: true },
      orderBy: { name: 'asc' },
    })
  }

  async updateUser(id: string, dto: UpdateUserFields) {
    const target = await this.prisma.user.findUnique({ where: { id } })
    if (!target) throw new NotFoundException('User not found')

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role         !== undefined && { role: dto.role as any }),
        ...(dto.regionId     !== undefined && { regionId: dto.regionId }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.jobLevel     !== undefined && { jobLevel: dto.jobLevel }),
        ...(dto.jobTitle     !== undefined && { jobTitle: dto.jobTitle }),
      },
      include: { region: true, department: true },
    })

    // 立即清除該使用者所有 session，確保新存取邊界立即生效
    await this.prisma.session.deleteMany({ where: { userId: id } })

    return flattenUser(updated)
  }
}

export interface UpdateUserFields {
  role?: string
  regionId?: string
  departmentId?: string
  jobLevel?: string
  jobTitle?: string
}

type UserWithRelations = {
  id: string; employeeId: string; name: string; email: string; role: string
  regionId: string; region: { name: string }
  departmentId: string; department: { name: string }
  jobLevel: string; jobTitle: string
  managerId: string | null; supervisorId: string | null
  createdAt: Date; updatedAt: Date
  supervisedUsers?: UserWithRelations[]
}

function flattenUser(user: UserWithRelations) {
  const { region, department, supervisedUsers: _sup, ...rest } = user
  return { ...rest, region: region.name, department: department.name }
}
