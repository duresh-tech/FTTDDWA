-- The membership register.
--
-- aadhaarNumber holds AES-256-GCM ciphertext, not twelve digits - hence
-- VARCHAR(255) rather than VARCHAR(12), which would truncate on write and
-- fail to decrypt on read.
--
-- aadhaarHash is a deterministic HMAC-SHA256 blind index. GCM uses a random
-- IV, so the same number encrypts differently every time and the ciphertext
-- cannot be unique-constrained; the hash is what makes
-- (tenantBusinessId, aadhaarHash) able to catch the same person enrolled
-- twice, while revealing nothing but equality.
--
-- dateOfBirth and weddingDate are YYYY-MM-DD strings, not epochs: a birth
-- date is not a moment, and with a per-business timeZone setting an epoch
-- CreateEnum
CREATE TYPE "TenantMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'EXPIRED', 'DELETED');

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
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
    "addressLine1" VARCHAR(255) NOT NULL,
    "addressLine2" VARCHAR(255),
    "dateOfBirth" VARCHAR(10) NOT NULL,
    "isMarried" BOOLEAN NOT NULL DEFAULT false,
    "weddingDate" VARCHAR(10),
    "passportPhotoPath" VARCHAR(255),
    "remark" VARCHAR(255),
    "status" "TenantMemberStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_systemCode_key" ON "tenant_members"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_members_status_idx" ON "tenant_members"("status");

-- CreateIndex
CREATE INDEX "tenant_members_tenantBusinessId_idx" ON "tenant_members"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_members_associationPositionId_idx" ON "tenant_members"("associationPositionId");

-- CreateIndex
CREATE INDEX "tenant_members_industryId_idx" ON "tenant_members"("industryId");

-- CreateIndex
CREATE INDEX "tenant_members_stateId_idx" ON "tenant_members"("stateId");

-- CreateIndex
CREATE INDEX "tenant_members_districtId_idx" ON "tenant_members"("districtId");

-- CreateIndex
CREATE INDEX "tenant_members_talukId_idx" ON "tenant_members"("talukId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenantBusinessId_aadhaarHash_key" ON "tenant_members"("tenantBusinessId", "aadhaarHash");

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_associationPositionId_fkey" FOREIGN KEY ("associationPositionId") REFERENCES "tenant_association_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "tenant_industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "tenant_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "tenant_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_talukId_fkey" FOREIGN KEY ("talukId") REFERENCES "tenant_taluks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

