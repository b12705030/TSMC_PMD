-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('Text', 'Rating', 'MultipleChoice');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('Draft', 'Published');

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "appliesGrade" TEXT NOT NULL,
    "appliesTitle" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'Draft',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "scopeDepartmentId" TEXT,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL DEFAULT 'Text',
    "options" TEXT[],
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormTemplate_region_idx" ON "FormTemplate"("region");

-- CreateIndex
CREATE INDEX "FormTemplate_cycleId_idx" ON "FormTemplate"("cycleId");

-- CreateIndex
CREATE INDEX "TemplateQuestion_templateId_idx" ON "TemplateQuestion"("templateId");

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateQuestion" ADD CONSTRAINT "TemplateQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
