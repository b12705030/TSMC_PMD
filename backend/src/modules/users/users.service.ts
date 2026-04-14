import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { SessionUser } from '../../common/types/request.types'
import { Role } from '../../common/enums/role.enum'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeamMembers(currentUser: SessionUser) {
    // Manager sees entire unit; Supervisor sees direct reports
    if (currentUser.role === Role.Manager) {
      return this.prisma.user.findMany({
        where: { department: currentUser.department },
        select: userSelectFields,
      })
    }

    if (currentUser.role === Role.Supervisor) {
      return this.prisma.user.findMany({
        where: { supervisorId: currentUser.id },
        select: userSelectFields,
      })
    }

    return []
  }

  async getEmployee(employeeId: string) {
    return this.prisma.user.findUnique({
      where: { id: employeeId },
      select: userSelectFields,
    })
  }
}

const userSelectFields = {
  id: true,
  employeeId: true,
  name: true,
  email: true,
  role: true,
  region: true,
  department: true,
  jobLevel: true,
  jobTitle: true,
  managerId: true,
  supervisorId: true,
  createdAt: true,
  updatedAt: true,
}
