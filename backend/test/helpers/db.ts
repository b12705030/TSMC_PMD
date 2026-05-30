import { PrismaClient } from '@prisma/client'

// TEST_DATABASE_URL must be set to prevent accidental truncation of production data
const url = process.env.TEST_DATABASE_URL
if (!url) {
  throw new Error('TEST_DATABASE_URL is not set. Set it before running tests.')
}

export const prisma = new PrismaClient({
  datasources: { db: { url } },
})

// Wipes all tables in one shot — CASCADE handles FK order automatically
export async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Session", "Appeal", "PerformanceReview",
      "ProgressUpdate", "GoalMilestone", "Goal",
      "TemplateQuestion", "FormTemplate", "PerformanceCycle",
      "RegionConfig", "User", "Department", "Region"
    RESTART IDENTITY CASCADE
  `)
}

export async function connectTestDb(): Promise<void> {
  await prisma.$connect()
}
