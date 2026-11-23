-- CreateEnum
CREATE TYPE "TenantIdCardTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantMemberIdCardStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "tenant_id_card_templates" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "widthMm" DECIMAL(6,2) NOT NULL,
    "heightMm" DECIMAL(6,2) NOT NULL,
    "layout" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "TenantIdCardTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_id_card_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_member_id_cards" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "tenantMemberId" CHAR(36) NOT NULL,
    "templateId" CHAR(36) NOT NULL,
    "filePath" VARCHAR(255) NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "generatedBy" CHAR(36),
    "generatedAt" BIGINT NOT NULL,
    "status" "TenantMemberIdCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_member_id_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_id_card_templates_systemCode_key" ON "tenant_id_card_templates"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_id_card_templates_status_idx" ON "tenant_id_card_templates"("status");

-- CreateIndex
CREATE INDEX "tenant_id_card_templates_tenantBusinessId_idx" ON "tenant_id_card_templates"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_id_card_templates_tenantBusinessId_name_key" ON "tenant_id_card_templates"("tenantBusinessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_member_id_cards_systemCode_key" ON "tenant_member_id_cards"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_member_id_cards_status_idx" ON "tenant_member_id_cards"("status");

-- CreateIndex
CREATE INDEX "tenant_member_id_cards_tenantBusinessId_idx" ON "tenant_member_id_cards"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_member_id_cards_templateId_idx" ON "tenant_member_id_cards"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_member_id_cards_tenantMemberId_key" ON "tenant_member_id_cards"("tenantMemberId");

-- AddForeignKey
ALTER TABLE "tenant_id_card_templates" ADD CONSTRAINT "tenant_id_card_templates_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_id_cards" ADD CONSTRAINT "tenant_member_id_cards_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_id_cards" ADD CONSTRAINT "tenant_member_id_cards_tenantMemberId_fkey" FOREIGN KEY ("tenantMemberId") REFERENCES "tenant_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member_id_cards" ADD CONSTRAINT "tenant_member_id_cards_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "tenant_id_card_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

