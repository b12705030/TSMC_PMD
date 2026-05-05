/*
  Warnings:

  - You are about to drop the column `region` on the `PerformanceCycle` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "PerformanceCycle_region_idx";

-- AlterTable
ALTER TABLE "PerformanceCycle" DROP COLUMN "region",
ADD COLUMN     "regions" TEXT[];
