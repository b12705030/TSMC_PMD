-- AlterEnum: Add new notification types
ALTER TYPE "NotificationType" ADD VALUE 'GoalApproved';
ALTER TYPE "NotificationType" ADD VALUE 'AppealFiled';
ALTER TYPE "NotificationType" ADD VALUE 'AppealResolved';
ALTER TYPE "NotificationType" ADD VALUE 'ReviewSubmitted';
ALTER TYPE "NotificationType" ADD VALUE 'ReviewApproved';
ALTER TYPE "NotificationType" ADD VALUE 'ReviewPublished';
