import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { SessionUser } from '../../common/types/request.types'
import { Role } from '../../common/enums/role.enum'

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
      // Employees who report directly to this manager (no supervisor)
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

  async getDistinctRegions(): Promise<string[]> {
    const regions = await this.prisma.region.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    return regions.map((r) => r.name)
  }

  async getDistinctJobLevels(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      select: { jobLevel: true },
      distinct: ['jobLevel'],
      orderBy: { jobLevel: 'asc' },
    })
    return rows.map((r) => r.jobLevel)
  }

  async getDistinctJobTitles(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      select: { jobTitle: true },
      distinct: ['jobTitle'],
      orderBy: { jobTitle: 'asc' },
    })
    return rows.map((r) => r.jobTitle)
  }

  async getEmployee(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { region: true, department: true },
    })
    if (!user) return null
    return flattenUser(user)
  }
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
