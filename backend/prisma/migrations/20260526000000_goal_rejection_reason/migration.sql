-- AlterEnum
ALTER TYPE "GoalStatus" ADD VALUE 'Rejected';

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "rejectionReason" TEXT;
