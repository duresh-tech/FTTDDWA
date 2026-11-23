-- Adds tenant_countries, and replaces the free-text tenant_states.country with a
-- required countryId FK.
--
-- The backfill below synthesises one country per distinct (business, country
-- text) found in tenant_states. It uses the business's own countryCode when the
-- country text matches the business's country, and a deterministic hashed code
-- otherwise. Review the generated rows on a restored dump before applying this
-- to real data. The countryId column is added nullable, filled, then made NOT
-- NULL - so any row the backfill misses fails loudly instead of being silently
-- orphaned.

-- CreateEnum
CREATE TYPE "TenantCountryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "tenant_countries" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "countryName" VARCHAR(100) NOT NULL,
    "countryNameTamil" VARCHAR(100),
    "countryCode" VARCHAR(10) NOT NULL,
    "status" "TenantCountryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_countries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_countries_systemCode_key" ON "tenant_countries"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_countries_status_idx" ON "tenant_countries"("status");

-- CreateIndex
CREATE INDEX "tenant_countries_tenantBusinessId_idx" ON "tenant_countries"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_countries_tenantBusinessId_countryCode_key" ON "tenant_countries"("tenantBusinessId", "countryCode");

-- AlterTable: nullable first, so the backfill below can fill every row.
ALTER TABLE "tenant_states" ADD COLUMN "countryId" CHAR(36);

-- CreateIndex
CREATE INDEX "tenant_states_countryId_idx" ON "tenant_states"("countryId");

-- Backfill: one country per distinct (tenantBusinessId, legacy country text).
WITH legacy AS (
    SELECT
        s."tenantBusinessId" AS bid,
        coalesce(nullif(btrim(s."country"), ''), 'Unknown') AS name,
        coalesce(nullif(btrim(b."country"), ''), '') AS business_country,
        coalesce(nullif(btrim(b."countryCode"), ''), '') AS business_code
    FROM "tenant_states" s
    LEFT JOIN "tenant_business" b ON b."id" = s."tenantBusinessId"
    GROUP BY
        s."tenantBusinessId",
        coalesce(nullif(btrim(s."country"), ''), 'Unknown'),
        coalesce(nullif(btrim(b."country"), ''), ''),
        coalesce(nullif(btrim(b."countryCode"), ''), '')
), coded AS (
    SELECT
        bid,
        name,
        CASE
            WHEN business_country = name AND business_code <> '' AND length(business_code) <= 10
                THEN business_code
            ELSE upper(substr(md5(bid || '|' || name), 1, 8))
        END AS code
    FROM legacy
), inserted AS (
    INSERT INTO "tenant_countries" (
        "id", "systemCode", "tenantBusinessId", "countryName", "countryNameTamil",
        "countryCode", "status", "createdAt", "updatedAt", "deletedAt"
    )
    SELECT
        gen_random_uuid()::text,
        'CTR-' || substr(md5(bid || '|' || name || '|' || clock_timestamp()::text), 1, 26),
        bid,
        name,
        NULL,
        code,
        'ACTIVE',
        extract(epoch from now())::bigint,
        extract(epoch from now())::bigint,
        NULL
    FROM coded
    RETURNING "id", "tenantBusinessId", "countryName"
)
UPDATE "tenant_states" s
SET "countryId" = i."id"
FROM inserted i
WHERE s."tenantBusinessId" = i."tenantBusinessId"
  AND coalesce(nullif(btrim(s."country"), ''), 'Unknown') = i."countryName";

-- AlterTable: every state row now has a country, so the legacy text can go.
ALTER TABLE "tenant_states" ALTER COLUMN "countryId" SET NOT NULL;
ALTER TABLE "tenant_states" DROP COLUMN "country";

-- AddForeignKey
ALTER TABLE "tenant_countries" ADD CONSTRAINT "tenant_countries_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_states" ADD CONSTRAINT "tenant_states_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "tenant_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
