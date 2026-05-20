-- Migration: add_region_department_tables
-- 建立 Region / Department 資料表，並將 User / FormTemplate 的字串欄位遷移為 FK

-- ── 1. 移除舊 index ──────────────────────────────────────────────────────────
DROP INDEX "FormTemplate_region_idx";
DROP INDEX "User_department_idx";
DROP INDEX "User_region_idx";

-- ── 2. 建立 Region 表 ────────────────────────────────────────────────────────
CREATE TABLE "Region" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- ── 3. 建立 Department 表 ────────────────────────────────────────────────────
CREATE TABLE "Department" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "regionId"  TEXT NOT NULL,
    "parentId"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Department_name_regionId_key" ON "Department"("name", "regionId");
CREATE INDEX "Department_regionId_idx" ON "Department"("regionId");

-- ── 4. 填入 Region 種子資料 ──────────────────────────────────────────────────
INSERT INTO "Region" ("id", "name", "code", "createdAt") VALUES
  (gen_random_uuid(), 'Global',        'GLOBAL', NOW()),
  (gen_random_uuid(), 'Taiwan',        'TW',     NOW()),
  (gen_random_uuid(), 'North America', 'NA',     NOW()),
  (gen_random_uuid(), 'Japan',         'JP',     NOW()),
  (gen_random_uuid(), 'Europe',        'EU',     NOW());

-- ── 5. 填入 Department 種子資料（先建父部門）────────────────────────────────
-- Global
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'IT',r.id,NULL,NOW() FROM "Region" r WHERE r.code='GLOBAL';

-- Taiwan top-level
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Engineering',r.id,NULL,NOW() FROM "Region" r WHERE r.code='TW';
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Human Resources',r.id,NULL,NOW() FROM "Region" r WHERE r.code='TW';

-- North America top-level
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Engineering',r.id,NULL,NOW() FROM "Region" r WHERE r.code='NA';
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Human Resources',r.id,NULL,NOW() FROM "Region" r WHERE r.code='NA';

-- Japan top-level
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Engineering',r.id,NULL,NOW() FROM "Region" r WHERE r.code='JP';
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Human Resources',r.id,NULL,NOW() FROM "Region" r WHERE r.code='JP';

-- Europe top-level
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Engineering',r.id,NULL,NOW() FROM "Region" r WHERE r.code='EU';
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Human Resources',r.id,NULL,NOW() FROM "Region" r WHERE r.code='EU';

-- ── 6. 填入子部門（需要父部門 ID）────────────────────────────────────────────
-- Taiwan children
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Process Engineering',r.id,d.id,NOW()
  FROM "Region" r JOIN "Department" d ON d."regionId"=r.id AND d.name='Engineering'
  WHERE r.code='TW';
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Equipment Engineering',r.id,d.id,NOW()
  FROM "Region" r JOIN "Department" d ON d."regionId"=r.id AND d.name='Engineering'
  WHERE r.code='TW';
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Recruiting',r.id,d.id,NOW()
  FROM "Region" r JOIN "Department" d ON d."regionId"=r.id AND d.name='Human Resources'
  WHERE r.code='TW';

-- NA children
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Process Engineering',r.id,d.id,NOW()
  FROM "Region" r JOIN "Department" d ON d."regionId"=r.id AND d.name='Engineering'
  WHERE r.code='NA';

-- Japan children
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Process Engineering',r.id,d.id,NOW()
  FROM "Region" r JOIN "Department" d ON d."regionId"=r.id AND d.name='Engineering'
  WHERE r.code='JP';

-- Europe children
INSERT INTO "Department" ("id","name","regionId","parentId","createdAt")
  SELECT gen_random_uuid(),'Process Engineering',r.id,d.id,NOW()
  FROM "Region" r JOIN "Department" d ON d."regionId"=r.id AND d.name='Engineering'
  WHERE r.code='EU';

-- ── 7. User：加 nullable FK 欄位 ─────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN "regionId"     TEXT;
ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;

-- ── 8. User：依舊的 region 字串設定 regionId（APAC 映射到 Taiwan）────────────
UPDATE "User" SET "regionId" = (
  SELECT r.id FROM "Region" r
  WHERE r.name = CASE "User"."region" WHEN 'APAC' THEN 'Taiwan' ELSE "User"."region" END
  LIMIT 1
);
-- 無法匹配的 fallback → Global
UPDATE "User" SET "regionId" = (SELECT id FROM "Region" WHERE code = 'GLOBAL')
WHERE "regionId" IS NULL;

-- ── 9. User：依舊的 department 字串 + regionId 設定 departmentId ─────────────
UPDATE "User" u SET "departmentId" = (
  SELECT d.id FROM "Department" d
  WHERE d."regionId" = u."regionId" AND d.name = u."department"
  LIMIT 1
);
-- fallback：同名部門但不限 region
UPDATE "User" u SET "departmentId" = (
  SELECT d.id FROM "Department" d WHERE d.name = u."department" LIMIT 1
) WHERE "departmentId" IS NULL;
-- 最終 fallback → Global/IT
UPDATE "User" SET "departmentId" = (
  SELECT d.id FROM "Department" d
  JOIN "Region" r ON d."regionId" = r.id
  WHERE d.name = 'IT' AND r.code = 'GLOBAL'
) WHERE "departmentId" IS NULL;

-- ── 10. User：設為 NOT NULL，刪舊欄位 ───────────────────────────────────────
ALTER TABLE "User" ALTER COLUMN "regionId"     SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "departmentId" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "region";
ALTER TABLE "User" DROP COLUMN "department";

-- ── 11. FormTemplate：加 nullable FK 與新陣列欄位 ────────────────────────────
ALTER TABLE "FormTemplate" ADD COLUMN "regionId"      TEXT;
ALTER TABLE "FormTemplate" ADD COLUMN "appliesGrades" TEXT[];
ALTER TABLE "FormTemplate" ADD COLUMN "applyTitles"   TEXT[];

-- ── 12. FormTemplate：資料遷移 ───────────────────────────────────────────────
UPDATE "FormTemplate" SET "regionId" = (
  SELECT r.id FROM "Region" r WHERE r.name = "FormTemplate"."region" LIMIT 1
);
UPDATE "FormTemplate" SET "regionId" = (SELECT id FROM "Region" WHERE code = 'GLOBAL')
WHERE "regionId" IS NULL;
UPDATE "FormTemplate" SET "appliesGrades" = ARRAY["appliesGrade"]::"text"[];
UPDATE "FormTemplate" SET "applyTitles"   = ARRAY["appliesTitle"]::"text"[];

-- ── 13. FormTemplate：設為 NOT NULL，刪舊欄位 ───────────────────────────────
ALTER TABLE "FormTemplate" ALTER COLUMN "regionId" SET NOT NULL;
ALTER TABLE "FormTemplate" DROP COLUMN "region";
ALTER TABLE "FormTemplate" DROP COLUMN "appliesGrade";
ALTER TABLE "FormTemplate" DROP COLUMN "appliesTitle";

-- ── 14. 加 FK constraints ────────────────────────────────────────────────────
ALTER TABLE "Department" ADD CONSTRAINT "Department_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 15. 加新 index ───────────────────────────────────────────────────────────
CREATE INDEX "User_regionId_idx"        ON "User"("regionId");
CREATE INDEX "User_departmentId_idx"    ON "User"("departmentId");
CREATE INDEX "FormTemplate_regionId_idx" ON "FormTemplate"("regionId");
