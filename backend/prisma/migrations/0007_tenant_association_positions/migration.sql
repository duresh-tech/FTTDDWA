-- Association positions, plus Tamil names for places and streets.
--
-- tenant_association_positions is a per-business lookup of the positions
-- members hold. Nothing references it yet - it is the list an assignment will
-- point at once we decide where that assignment lives - so it has one FK out
-- to tenant_business and none in.
--
-- The two ADD COLUMNs are the first localised fields in this schema. Both are
-- nullable, so existing rows need no backfill, and both are VARCHAR(100) to
-- match their English sibling: Postgres counts CHARACTERS, not bytes, so 100
-- Tamil characters fit exactly as 100 Latin ones do.

-- CreateEnum
CREATE TYPE "TenantAssociationPositionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- AlterTable
ALTER TABLE "tenant_places" ADD COLUMN     "placeNameTamil" VARCHAR(100);

-- AlterTable
ALTER TABLE "tenant_streets" ADD COLUMN     "streetNameTamil" VARCHAR(100);

-- CreateTable
CREATE TABLE "tenant_association_positions" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "positionName" VARCHAR(100) NOT NULL,
    "positionNameTamil" VARCHAR(100),
    "remark" VARCHAR(255),
    "status" "TenantAssociationPositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_association_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_association_positions_systemCode_key" ON "tenant_association_positions"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_association_positions_status_idx" ON "tenant_association_positions"("status");

-- CreateIndex
CREATE INDEX "tenant_association_positions_tenantBusinessId_idx" ON "tenant_association_positions"("tenantBusinessId");

-- AddForeignKey
ALTER TABLE "tenant_association_positions" ADD CONSTRAINT "tenant_association_positions_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

