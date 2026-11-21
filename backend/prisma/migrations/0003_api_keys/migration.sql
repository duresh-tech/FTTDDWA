-- CreateEnum
CREATE TYPE "ApiKeyType" AS ENUM ('LIVE', 'TEST');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ApiKeyScopeTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "api_keys" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36),
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "keyType" "ApiKeyType" NOT NULL DEFAULT 'TEST',
    "keyPrefix" VARCHAR(64) NOT NULL,
    "secretHash" VARCHAR(64) NOT NULL,
    "secretLast4" VARCHAR(8) NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" BIGINT,
    "lastUsedAt" BIGINT,
    "lastUsedIp" VARCHAR(45),
    "usageCount" BIGINT NOT NULL DEFAULT 0,
    "rotatedAt" BIGINT,
    "revokedAt" BIGINT,
    "revokedReason" VARCHAR(255),
    "createdBySystemUserId" CHAR(36),
    "createdByTenantUserId" CHAR(36),
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_scopes" (
    "apiKeyId" CHAR(36) NOT NULL,
    "permissionKey" VARCHAR(100) NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "api_key_scopes_pkey" PRIMARY KEY ("apiKeyId","permissionKey")
);

-- CreateTable
CREATE TABLE "api_key_scope_templates" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "isTenant" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ApiKeyScopeTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "api_key_scope_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_scope_template_items" (
    "templateId" CHAR(36) NOT NULL,
    "permissionKey" VARCHAR(100) NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "api_key_scope_template_items_pkey" PRIMARY KEY ("templateId","permissionKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_systemCode_key" ON "api_keys"("systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyPrefix_key" ON "api_keys"("keyPrefix");

-- CreateIndex
CREATE INDEX "api_keys_status_idx" ON "api_keys"("status");

-- CreateIndex
CREATE INDEX "api_keys_tenantBusinessId_idx" ON "api_keys"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "api_keys_expiresAt_idx" ON "api_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "api_key_scopes_permissionKey_idx" ON "api_key_scopes"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_scope_templates_systemCode_key" ON "api_key_scope_templates"("systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_scope_templates_name_key" ON "api_key_scope_templates"("name");

-- CreateIndex
CREATE INDEX "api_key_scope_templates_status_idx" ON "api_key_scope_templates"("status");

-- CreateIndex
CREATE INDEX "api_key_scope_templates_isTenant_idx" ON "api_key_scope_templates"("isTenant");

-- CreateIndex
CREATE INDEX "api_key_scope_template_items_permissionKey_idx" ON "api_key_scope_template_items"("permissionKey");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_scopes" ADD CONSTRAINT "api_key_scopes_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_scope_template_items" ADD CONSTRAINT "api_key_scope_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "api_key_scope_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

