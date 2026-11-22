-- Geography and trade lookups: states, districts, taluks and industries.
--
-- State -> District -> Taluk is a chain, and a taluk carries BOTH stateId and
-- districtId. The redundancy lets a taluk be filtered by state without a join;
-- the services check the district really belongs to the state, because the
-- database cannot express that constraint.
--
-- The two scoped unique indexes apply to every row regardless of soft-delete
-- state, so a code held by a deleted-but-restorable row cannot be reissued.

-- CreateEnum
CREATE TYPE "TenantStateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantDistrictStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantTalukStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantIndustryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "tenant_states" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "stateName" VARCHAR(100) NOT NULL,
    "stateNameTamil" VARCHAR(100),
    "stateCode" VARCHAR(10) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "status" "TenantStateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_districts" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "stateId" CHAR(36) NOT NULL,
    "districtName" VARCHAR(100) NOT NULL,
    "districtNameTamil" VARCHAR(100),
    "districtCode" VARCHAR(10) NOT NULL,
    "status" "TenantDistrictStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_taluks" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "stateId" CHAR(36) NOT NULL,
    "districtId" CHAR(36) NOT NULL,
    "talukName" VARCHAR(100) NOT NULL,
    "talukNameTamil" VARCHAR(100),
    "status" "TenantTalukStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_taluks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_industries" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "industryName" VARCHAR(100) NOT NULL,
    "industryNameTamil" VARCHAR(100),
    "status" "TenantIndustryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_industries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_states_systemCode_key" ON "tenant_states"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_states_status_idx" ON "tenant_states"("status");

-- CreateIndex
CREATE INDEX "tenant_states_tenantBusinessId_idx" ON "tenant_states"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_states_tenantBusinessId_stateCode_key" ON "tenant_states"("tenantBusinessId", "stateCode");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_districts_systemCode_key" ON "tenant_districts"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_districts_status_idx" ON "tenant_districts"("status");

-- CreateIndex
CREATE INDEX "tenant_districts_tenantBusinessId_idx" ON "tenant_districts"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_districts_stateId_idx" ON "tenant_districts"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_districts_tenantBusinessId_districtCode_key" ON "tenant_districts"("tenantBusinessId", "districtCode");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_taluks_systemCode_key" ON "tenant_taluks"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_taluks_status_idx" ON "tenant_taluks"("status");

-- CreateIndex
CREATE INDEX "tenant_taluks_tenantBusinessId_idx" ON "tenant_taluks"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_taluks_stateId_idx" ON "tenant_taluks"("stateId");

-- CreateIndex
CREATE INDEX "tenant_taluks_districtId_idx" ON "tenant_taluks"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_industries_systemCode_key" ON "tenant_industries"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_industries_status_idx" ON "tenant_industries"("status");

-- CreateIndex
CREATE INDEX "tenant_industries_tenantBusinessId_idx" ON "tenant_industries"("tenantBusinessId");

-- AddForeignKey
ALTER TABLE "tenant_states" ADD CONSTRAINT "tenant_states_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_districts" ADD CONSTRAINT "tenant_districts_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_districts" ADD CONSTRAINT "tenant_districts_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "tenant_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_taluks" ADD CONSTRAINT "tenant_taluks_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_taluks" ADD CONSTRAINT "tenant_taluks_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "tenant_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_taluks" ADD CONSTRAINT "tenant_taluks_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "tenant_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_industries" ADD CONSTRAINT "tenant_industries_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

