CREATE TYPE "NotificationType" AS ENUM ('CycleAdvanceReminder', 'CycleAutoAdvanced', 'CyclePostponed');

CREATE TABLE "Notification" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "type"      "NotificationType" NOT NULL,
  "title"     TEXT         NOT NULL,
  "message"   TEXT         NOT NULL,
  "read"      BOOLEAN      NOT NULL DEFAULT false,
  "cycleId"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_cycleId_idx" ON "Notification"("cycleId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
