-- CreateEnum
CREATE TYPE "CycleType" AS ENUM ('Annual', 'Quarterly', 'Probation');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('GoalSetting', 'InProgress', 'UnderReview', 'Completed');

-- CreateTable
CREATE TABLE "PerformanceCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CycleType" NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'GoalSetting',
    "region" TEXT NOT NULL,
    "goalSettingStart" TIMESTAMP(3) NOT NULL,
    "goalSettingEnd" TIMESTAMP(3) NOT NULL,
    "reviewStart" TIMESTAMP(3) NOT NULL,
    "reviewEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceCycle_region_idx" ON "PerformanceCycle"("region");
