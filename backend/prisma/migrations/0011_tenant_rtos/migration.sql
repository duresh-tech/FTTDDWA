-- Adds tenant_rtos, and a REQUIRED rtoId on tenant_members.
--
-- The ADD COLUMN below is NOT NULL with no default, which Postgres accepts
-- only because tenant_members held no rows when this was written. Replaying it
-- against a populated table will fail - a restore of an older dump has to
-- backfill rtoId first, or add the column nullable, fill it, then set NOT NULL.

-- CreateEnum
CREATE TYPE "TenantRtoStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- AlterTable
ALTER TABLE "tenant_members" ADD COLUMN     "rtoId" CHAR(36) NOT NULL;

-- CreateTable
CREATE TABLE "tenant_rtos" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "tenantDistrictId" CHAR(36) NOT NULL,
    "rtoName" VARCHAR(100) NOT NULL,
    "rtoNameTamil" VARCHAR(100),
    "rtoCode" VARCHAR(10) NOT NULL,
    "status" "TenantRtoStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_rtos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_rtos_systemCode_key" ON "tenant_rtos"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_rtos_status_idx" ON "tenant_rtos"("status");

-- CreateIndex
CREATE INDEX "tenant_rtos_tenantBusinessId_idx" ON "tenant_rtos"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_rtos_tenantDistrictId_idx" ON "tenant_rtos"("tenantDistrictId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_rtos_tenantBusinessId_rtoCode_key" ON "tenant_rtos"("tenantBusinessId", "rtoCode");

-- CreateIndex
CREATE INDEX "tenant_members_rtoId_idx" ON "tenant_members"("rtoId");

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_rtoId_fkey" FOREIGN KEY ("rtoId") REFERENCES "tenant_rtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_rtos" ADD CONSTRAINT "tenant_rtos_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_rtos" ADD CONSTRAINT "tenant_rtos_tenantDistrictId_fkey" FOREIGN KEY ("tenantDistrictId") REFERENCES "tenant_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

