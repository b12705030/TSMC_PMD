-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GlobalHR';

-- AlterTable
ALTER TABLE "TemplateQuestion" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false;
