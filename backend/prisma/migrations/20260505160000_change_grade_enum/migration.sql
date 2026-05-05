-- AlterEnum: Replace A/B/C/D with O/S_Plus/S/S_Minus/I/U
-- PostgreSQL does not support removing enum values directly.
-- Strategy: convert column to TEXT, drop old enum, create new enum, restore column.

-- Step 1: detach column from old enum
ALTER TABLE "PerformanceReview" ALTER COLUMN "grade" TYPE TEXT;

-- Step 2: migrate any existing data (A→O, B→S, C→I, D→U)
UPDATE "PerformanceReview"
SET "grade" = CASE "grade"
  WHEN 'A' THEN 'O'
  WHEN 'B' THEN 'S'
  WHEN 'C' THEN 'I'
  WHEN 'D' THEN 'U'
  ELSE NULL
END
WHERE "grade" IS NOT NULL;

-- Step 3: drop old enum
DROP TYPE "ReviewGrade";

-- Step 4: create new enum
CREATE TYPE "ReviewGrade" AS ENUM ('O', 'S_Plus', 'S', 'S_Minus', 'I', 'U');

-- Step 5: restore column with new enum
ALTER TABLE "PerformanceReview"
  ALTER COLUMN "grade" TYPE "ReviewGrade" USING "grade"::"ReviewGrade";
