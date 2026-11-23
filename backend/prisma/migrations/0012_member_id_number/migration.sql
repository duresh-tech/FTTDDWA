-- Adds the membership number, <rtoCode><sequence> (TN72001).
--
-- The ADD COLUMN is NOT NULL with no default, which Postgres accepts only
-- because tenant_members held no rows when this was written. Replaying it
-- against a populated table will fail - a restore of an older dump has to add
-- the column nullable, backfill a number per member in rtoCode order, then set
-- NOT NULL and create the unique index.

-- AlterTable
ALTER TABLE "tenant_members" ADD COLUMN     "memberIdNumber" VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenantBusinessId_memberIdNumber_key" ON "tenant_members"("tenantBusinessId", "memberIdNumber");

