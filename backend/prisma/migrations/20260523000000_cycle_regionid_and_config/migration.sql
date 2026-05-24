-- ============================================================
-- Migration: cycle_regionid_and_config
-- 1. PerformanceCycle.regions (String[]) → regionId (FK to Region)
-- 2. 新增 RegionConfig 表
-- ============================================================

-- ── PerformanceCycle: 新增 regionId 欄位（先 nullable）────────
ALTER TABLE "PerformanceCycle" ADD COLUMN "regionId" TEXT;

-- ── 回填：從 regions[1] (region name) 對應到 Region.id ────────
UPDATE "PerformanceCycle" pc
SET    "regionId" = r.id
FROM   "Region" r
WHERE  r.name = pc.regions[1];

-- ── 若有未匹配的列，嘗試用 Global region 填充 ──────────────────
UPDATE "PerformanceCycle"
SET    "regionId" = (SELECT id FROM "Region" WHERE code = 'GLOBAL' LIMIT 1)
WHERE  "regionId" IS NULL;

-- ── 設為 NOT NULL 並加上 FK ────────────────────────────────────
ALTER TABLE "PerformanceCycle" ALTER COLUMN "regionId" SET NOT NULL;
ALTER TABLE "PerformanceCycle"
  ADD CONSTRAINT "PerformanceCycle_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PerformanceCycle_regionId_idx" ON "PerformanceCycle"("regionId");

-- ── 移除舊欄位 ────────────────────────────────────────────────
ALTER TABLE "PerformanceCycle" DROP COLUMN "regions";

-- ============================================================
-- RegionConfig 表
-- ============================================================

CREATE TABLE "RegionConfig" (
    "id"        TEXT NOT NULL,
    "regionId"  TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegionConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegionConfig_regionId_key_key" ON "RegionConfig"("regionId", "key");
CREATE INDEX "RegionConfig_regionId_idx" ON "RegionConfig"("regionId");

ALTER TABLE "RegionConfig"
  ADD CONSTRAINT "RegionConfig_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
