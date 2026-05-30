import type { PrismaService } from '../../src/prisma/prisma.service'
import { AuthService } from '../../src/modules/auth/auth.service'
import { GoalsService } from '../../src/modules/goals/goals.service'
import { TemplatesService } from '../../src/modules/templates/templates.service'
import { ReviewsService } from '../../src/modules/reviews/reviews.service'
import { CyclesService } from '../../src/modules/cycles/cycles.service'
import { AuditService } from '../../src/modules/audit/audit.service'
import { prisma } from './db'

/** Prisma client pointed at TEST_DATABASE_URL, typed as Nest PrismaService */
export const testPrisma = prisma as unknown as PrismaService

const mockAudit: Pick<AuditService, 'log'> = {
  log: jest.fn().mockResolvedValue(undefined),
}

export function createAuthService(): AuthService {
  return new AuthService(testPrisma, mockAudit as AuditService)
}

export function createGoalsService(): GoalsService {
  return new GoalsService(testPrisma)
}

export function createTemplatesService(): TemplatesService {
  return new TemplatesService(testPrisma)
}

export function createReviewsService(): ReviewsService {
  return new ReviewsService(testPrisma)
}

export function createCyclesService(): CyclesService {
  return new CyclesService(testPrisma)
}

export async function disconnectTestDb(): Promise<void> {
  await prisma.$disconnect()
}
