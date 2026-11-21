-- Per-business settings: a catalogue of definitions, one value row per
-- business per definition, and an audit trail of what the backfill did.
--
-- `app_settings` (platform-wide, one row per key) is untouched. These three
-- tables are the per-business layer sitting beside it.
--
-- The value rows copy settingLabel / valueType / validationRules from their
-- definition instead of joining, so re-wording or retiring a definition
-- cannot change how an already-configured business renders or validates.

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON', 'ARRAY', 'OBJECT', 'DATE', 'DATETIME', 'TIME', 'COLOR', 'FILE', 'URL', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "SettingDefinitionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TenantBusinessSettingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "SettingSyncAction" AS ENUM ('INSERTED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "setting_definitions" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "subCategory" VARCHAR(50),
    "settingKey" VARCHAR(150) NOT NULL,
    "settingLabel" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "valueType" "SettingValueType" NOT NULL,
    "defaultValue" TEXT,
    "validationRules" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "isReadonly" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "autoSyncToExistingTenants" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SettingDefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "setting_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_business_settings" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "settingDefinitionId" CHAR(36) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "subCategory" VARCHAR(50),
    "settingKey" VARCHAR(150) NOT NULL,
    "settingLabel" VARCHAR(150) NOT NULL,
    "valueType" "SettingValueType" NOT NULL,
    "description" VARCHAR(255),
    "validationRules" TEXT,
    "settingValue" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "isReadonly" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "TenantBusinessSettingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" CHAR(36),
    "updatedBy" CHAR(36),
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_business_setting_sync_logs" (
    "id" CHAR(36) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "settingDefinitionId" CHAR(36) NOT NULL,
    "action" "SettingSyncAction" NOT NULL,
    "remarks" VARCHAR(255),
    "syncedBy" CHAR(36),
    "syncedAt" BIGINT NOT NULL,

    CONSTRAINT "tenant_business_setting_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "setting_definitions_systemCode_key" ON "setting_definitions"("systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "setting_definitions_settingKey_key" ON "setting_definitions"("settingKey");

-- CreateIndex
CREATE INDEX "setting_definitions_status_idx" ON "setting_definitions"("status");

-- CreateIndex
CREATE INDEX "setting_definitions_category_idx" ON "setting_definitions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_business_settings_systemCode_key" ON "tenant_business_settings"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_business_settings_status_idx" ON "tenant_business_settings"("status");

-- CreateIndex
CREATE INDEX "tenant_business_settings_tenantBusinessId_idx" ON "tenant_business_settings"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_business_settings_settingDefinitionId_idx" ON "tenant_business_settings"("settingDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_business_settings_tenantBusinessId_settingKey_key" ON "tenant_business_settings"("tenantBusinessId", "settingKey");

-- CreateIndex
CREATE INDEX "tenant_business_setting_sync_logs_tenantBusinessId_idx" ON "tenant_business_setting_sync_logs"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_business_setting_sync_logs_settingDefinitionId_idx" ON "tenant_business_setting_sync_logs"("settingDefinitionId");

-- AddForeignKey
ALTER TABLE "tenant_business_settings" ADD CONSTRAINT "tenant_business_settings_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_business_settings" ADD CONSTRAINT "tenant_business_settings_settingDefinitionId_fkey" FOREIGN KEY ("settingDefinitionId") REFERENCES "setting_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_business_setting_sync_logs" ADD CONSTRAINT "tenant_business_setting_sync_logs_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_business_setting_sync_logs" ADD CONSTRAINT "tenant_business_setting_sync_logs_settingDefinitionId_fkey" FOREIGN KEY ("settingDefinitionId") REFERENCES "setting_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

