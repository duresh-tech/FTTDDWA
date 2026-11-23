-- Membership applications: the public registration form writes here, never
-- to tenant_members.
--
-- Purely additive - one new table and its enum. Nothing existing changes, so
-- this is safe to replay against a populated database.

-- CreateEnum
CREATE TYPE "TenantMemberApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELETED');

-- CreateTable
CREATE TABLE "tenant_member_applications" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "applicationNumber" VARCHAR(20) NOT NULL,
    "passwordHash" VARCHAR(255),
    "memberName" VARCHAR(100) NOT NULL,
    "memberNameTamil" VARCHAR(100),
    "businessName" VARCHAR(100) NOT NULL,
    "businessNameTamil" VARCHAR(100),
    "associationPositionId" CHAR(36) NOT NULL,
    "industryId" CHAR(36) NOT NULL,
    "aadhaarNumber" VARCHAR(255) NOT NULL,
    "aadhaarHash" CHAR(64) NOT NULL,
    "aadhaarLast4" VARCHAR(4) NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "whatsappNumber" VARCHAR(20),
    "email" VARCHAR(191) NOT NULL,
    "stateId" CHAR(36) NOT NULL,
    "districtId" CHAR(36) NOT NULL,
    "talukId" CHAR(36) NOT NULL,
    "rtoId" CHAR(36) NOT NULL,
    "addressLine1" VARCHAR(255) NOT NULL,
    "addressLine2" VARCHAR(255),
    "dateOfBirth" VARCHAR(10) NOT NULL,
    "isMarried" BOOLEAN NOT NULL DEFAULT false,
    "weddingDate" VARCHAR(10),
    "passportPhotoPath" VARCHAR(255),
    "remark" VARCHAR(255),
    "reviewedBy" CHAR(36),
    "reviewedAt" BIGINT,
    "rejectionReason" VARCHAR(255),
    "convertedMemberId" CHAR(36),
    "status" "TenantMemberApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_member_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_member_applications_systemCode_key" ON "tenant_member_applications"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_member_applications_status_idx" ON "tenant_member_applications"("status");

-- CreateIndex
CREATE INDEX "tenant_member_applications_tenantBusinessId_idx" ON "tenant_member_applications"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_member_applications_tenantBusinessId_applicationNumb_key" ON "tenant_member_applications"("tenantBusinessId", "applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_member_applications_tenantBusinessId_aadhaarHash_key" ON "tenant_member_applications"("tenantBusinessId", "aadhaarHash");

-- AddForeignKey
ALTER TABLE "tenant_member_applications" ADD CONSTRAINT "tenant_member_applications_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_applications" ADD CONSTRAINT "tenant_member_applications_associationPositionId_fkey" FOREIGN KEY ("associationPositionId") REFERENCES "tenant_association_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_applications" ADD CONSTRAINT "tenant_member_applications_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "tenant_industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_applications" ADD CONSTRAINT "tenant_member_applications_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "tenant_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_applications" ADD CONSTRAINT "tenant_member_applications_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "tenant_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_applications" ADD CONSTRAINT "tenant_member_applications_talukId_fkey" FOREIGN KEY ("talukId") REFERENCES "tenant_taluks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_applications" ADD CONSTRAINT "tenant_member_applications_rtoId_fkey" FOREIGN KEY ("rtoId") REFERENCES "tenant_rtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

