ALTER TABLE "PerformanceCycle" ADD COLUMN "advanceConfirmed"   BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE "PerformanceCycle" ADD COLUMN "advanceConfirmedAt" TIMESTAMP(3);
