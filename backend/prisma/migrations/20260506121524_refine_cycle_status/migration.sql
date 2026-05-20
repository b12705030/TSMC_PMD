/*
  Warnings:

  - The values [UnderReview] on the enum `CycleStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CycleStatus_new" AS ENUM ('GoalSetting', 'InProgress', 'EmployeeReview', 'SupervisorReview', 'Calibration', 'Completed');
ALTER TABLE "PerformanceCycle" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PerformanceCycle" ALTER COLUMN "status" TYPE "CycleStatus_new" USING ("status"::text::"CycleStatus_new");
ALTER TYPE "CycleStatus" RENAME TO "CycleStatus_old";
ALTER TYPE "CycleStatus_new" RENAME TO "CycleStatus";
DROP TYPE "CycleStatus_old";
ALTER TABLE "PerformanceCycle" ALTER COLUMN "status" SET DEFAULT 'GoalSetting';
COMMIT;
