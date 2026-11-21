-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PermissionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantBusinessStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TaxCalculationType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "TenantTaxTypeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantPaymentModeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantInExCategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TenantInExCategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantBusinessBranchStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantNetworkProviderType" AS ENUM ('CABLE_TV', 'ISP', 'IPTV', 'OTHERS');

-- CreateEnum
CREATE TYPE "TenantNetworkProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantMailDriver" AS ENUM ('SMTP');

-- CreateEnum
CREATE TYPE "TenantMailEncryption" AS ENUM ('NONE', 'SSL', 'TLS', 'SMTP', 'SMTPS');

-- CreateEnum
CREATE TYPE "TenantMappedBusinessStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "AppSettingDataType" AS ENUM ('STRING', 'TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON', 'DATE', 'DATETIME', 'TIME', 'FILE');

-- CreateEnum
CREATE TYPE "AppSettingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantPlaceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantStreetStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantCustomerGender" AS ENUM ('MALE', 'FEMALE', 'TRANSGENDER', 'NOT_TO_SAY', 'NONE');

-- CreateEnum
CREATE TYPE "TenantCustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "TenantCustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');

-- CreateTable
CREATE TABLE "permissions" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "moduleName" VARCHAR(50) NOT NULL,
    "permissionKey" VARCHAR(100) NOT NULL,
    "description" VARCHAR(50),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" "PermissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "roleKey" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "visibleToTenants" BOOLEAN NOT NULL DEFAULT false,
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" CHAR(36) NOT NULL,
    "permissionId" CHAR(36) NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "system_users" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "fName" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "roleId" CHAR(36) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "system_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "fName" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "phone" VARCHAR(20),
    "avatarPath" VARCHAR(255),
    "passwordHash" VARCHAR(255) NOT NULL,
    "roleId" CHAR(36) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_business" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "tagLine" VARCHAR(200),
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "countryCode" VARCHAR(10) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(20) NOT NULL,
    "addressLine1" VARCHAR(255) NOT NULL,
    "addressLine2" VARCHAR(255),
    "logoPath" VARCHAR(255),
    "taxNumber" VARCHAR(50),
    "isParentBusiness" BOOLEAN NOT NULL DEFAULT false,
    "status" "TenantBusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_tax_types" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "taxName" VARCHAR(100) NOT NULL,
    "calculationType" "TaxCalculationType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "description" VARCHAR(255),
    "status" "TenantTaxTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_tax_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_payment_modes" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "paymentName" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" "TenantPaymentModeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_payment_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_in_ex_categories" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "type" "TenantInExCategoryType" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "inExCode" VARCHAR(100) NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(255),
    "status" "TenantInExCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_in_ex_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_business_branches" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "branchName" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "addressLine1" VARCHAR(255) NOT NULL,
    "addressLine2" VARCHAR(255),
    "description" VARCHAR(255),
    "status" "TenantBusinessBranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_business_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_network_providers" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "type" "TenantNetworkProviderType" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150),
    "phone" VARCHAR(20),
    "addressLine1" VARCHAR(255),
    "addressLine2" VARCHAR(255),
    "description" VARCHAR(255),
    "status" "TenantNetworkProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_network_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_mail_config" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "mailDriver" "TenantMailDriver" NOT NULL DEFAULT 'SMTP',
    "mailHost" VARCHAR(255),
    "mailPort" INTEGER,
    "mailUsername" VARCHAR(150),
    "mailPassword" VARCHAR(255),
    "mailEncryption" "TenantMailEncryption" NOT NULL DEFAULT 'NONE',
    "fromMailAddress" VARCHAR(150),
    "fromMailName" VARCHAR(150),
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_mail_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_mapped_business" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantUserId" CHAR(36) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "status" "TenantMappedBusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_mapped_business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" CHAR(36) NOT NULL,
    "userId" CHAR(36) NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "deviceType" VARCHAR(30),
    "expiresAt" BIGINT NOT NULL,
    "revokedAt" BIGINT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_refresh_tokens" (
    "id" CHAR(36) NOT NULL,
    "tenantUserId" CHAR(36) NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "deviceType" VARCHAR(30),
    "expiresAt" BIGINT NOT NULL,
    "revokedAt" BIGINT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "tenant_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" CHAR(36) NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "dataType" "AppSettingDataType" NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(255),
    "status" "AppSettingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_places" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "placeName" VARCHAR(100) NOT NULL,
    "remark" VARCHAR(255),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "status" "TenantPlaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_streets" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "tenantPlaceId" CHAR(36) NOT NULL,
    "streetCode" CHAR(3) NOT NULL,
    "streetName" VARCHAR(100) NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "remark" VARCHAR(255),
    "status" "TenantStreetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_streets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_customers" (
    "id" CHAR(36) NOT NULL,
    "systemCode" VARCHAR(30) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "customerCode" VARCHAR(30) NOT NULL,
    "fName" VARCHAR(100) NOT NULL,
    "lName" VARCHAR(100),
    "fatherName" VARCHAR(150),
    "gender" "TenantCustomerGender" NOT NULL DEFAULT 'NONE',
    "dateOfBirth" DATE,
    "primaryMobile" VARCHAR(20) NOT NULL,
    "secondaryMobile" VARCHAR(20),
    "email" VARCHAR(255),
    "customerType" "TenantCustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "tenantPlaceId" CHAR(36),
    "tenantStreetId" CHAR(36),
    "addressLine1" VARCHAR(255) NOT NULL,
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "pincode" VARCHAR(15),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "customerPicture" VARCHAR(500),
    "idProofType" VARCHAR(50),
    "idProofNumber" VARCHAR(100),
    "idProofFile" VARCHAR(500),
    "taxType" VARCHAR(50),
    "taxNumber" VARCHAR(100),
    "notifyViaSMS" BOOLEAN NOT NULL DEFAULT true,
    "notifyViaWhatsApp" BOOLEAN NOT NULL DEFAULT true,
    "notifyViaRCS" BOOLEAN NOT NULL DEFAULT false,
    "allowPortalAccess" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "status" "TenantCustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,

    CONSTRAINT "tenant_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_systemCode_key" ON "permissions"("systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_permissionKey_key" ON "permissions"("permissionKey");

-- CreateIndex
CREATE INDEX "permissions_moduleName_idx" ON "permissions"("moduleName");

-- CreateIndex
CREATE INDEX "permissions_status_idx" ON "permissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_systemCode_key" ON "roles"("systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "roles_roleKey_key" ON "roles"("roleKey");

-- CreateIndex
CREATE INDEX "roles_status_idx" ON "roles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "system_users_systemCode_key" ON "system_users"("systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "system_users_username_key" ON "system_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "system_users_email_key" ON "system_users"("email");

-- CreateIndex
CREATE INDEX "system_users_status_idx" ON "system_users"("status");

-- CreateIndex
CREATE INDEX "system_users_roleId_idx" ON "system_users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_systemCode_key" ON "tenant_users"("systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_username_key" ON "tenant_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_email_key" ON "tenant_users"("email");

-- CreateIndex
CREATE INDEX "tenant_users_status_idx" ON "tenant_users"("status");

-- CreateIndex
CREATE INDEX "tenant_users_roleId_idx" ON "tenant_users"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_business_systemCode_key" ON "tenant_business"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_business_status_idx" ON "tenant_business"("status");

-- CreateIndex
CREATE INDEX "tenant_business_country_idx" ON "tenant_business"("country");

-- CreateIndex
CREATE INDEX "tenant_business_isParentBusiness_idx" ON "tenant_business"("isParentBusiness");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_tax_types_systemCode_key" ON "tenant_tax_types"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_tax_types_status_idx" ON "tenant_tax_types"("status");

-- CreateIndex
CREATE INDEX "tenant_tax_types_tenantBusinessId_idx" ON "tenant_tax_types"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_payment_modes_systemCode_key" ON "tenant_payment_modes"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_payment_modes_status_idx" ON "tenant_payment_modes"("status");

-- CreateIndex
CREATE INDEX "tenant_payment_modes_tenantBusinessId_idx" ON "tenant_payment_modes"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_in_ex_categories_systemCode_key" ON "tenant_in_ex_categories"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_in_ex_categories_status_idx" ON "tenant_in_ex_categories"("status");

-- CreateIndex
CREATE INDEX "tenant_in_ex_categories_tenantBusinessId_idx" ON "tenant_in_ex_categories"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_business_branches_systemCode_key" ON "tenant_business_branches"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_business_branches_status_idx" ON "tenant_business_branches"("status");

-- CreateIndex
CREATE INDEX "tenant_business_branches_tenantBusinessId_idx" ON "tenant_business_branches"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_network_providers_systemCode_key" ON "tenant_network_providers"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_network_providers_status_idx" ON "tenant_network_providers"("status");

-- CreateIndex
CREATE INDEX "tenant_network_providers_tenantBusinessId_idx" ON "tenant_network_providers"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_mail_config_systemCode_key" ON "tenant_mail_config"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_mail_config_tenantBusinessId_idx" ON "tenant_mail_config"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_mapped_business_systemCode_key" ON "tenant_mapped_business"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_mapped_business_status_idx" ON "tenant_mapped_business"("status");

-- CreateIndex
CREATE INDEX "tenant_mapped_business_tenantBusinessId_idx" ON "tenant_mapped_business"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_mapped_business_tenantUserId_key" ON "tenant_mapped_business"("tenantUserId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "tenant_refresh_tokens_tenantUserId_idx" ON "tenant_refresh_tokens"("tenantUserId");

-- CreateIndex
CREATE INDEX "tenant_refresh_tokens_tokenHash_idx" ON "tenant_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "app_settings_status_idx" ON "app_settings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_places_systemCode_key" ON "tenant_places"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_places_status_idx" ON "tenant_places"("status");

-- CreateIndex
CREATE INDEX "tenant_places_tenantBusinessId_idx" ON "tenant_places"("tenantBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_streets_systemCode_key" ON "tenant_streets"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_streets_status_idx" ON "tenant_streets"("status");

-- CreateIndex
CREATE INDEX "tenant_streets_tenantBusinessId_idx" ON "tenant_streets"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_streets_tenantPlaceId_idx" ON "tenant_streets"("tenantPlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_streets_tenantBusinessId_streetCode_key" ON "tenant_streets"("tenantBusinessId", "streetCode");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_customers_systemCode_key" ON "tenant_customers"("systemCode");

-- CreateIndex
CREATE INDEX "tenant_customers_status_idx" ON "tenant_customers"("status");

-- CreateIndex
CREATE INDEX "tenant_customers_tenantBusinessId_idx" ON "tenant_customers"("tenantBusinessId");

-- CreateIndex
CREATE INDEX "tenant_customers_tenantPlaceId_idx" ON "tenant_customers"("tenantPlaceId");

-- CreateIndex
CREATE INDEX "tenant_customers_tenantStreetId_idx" ON "tenant_customers"("tenantStreetId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_customers_tenantBusinessId_customerCode_key" ON "tenant_customers"("tenantBusinessId", "customerCode");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_users" ADD CONSTRAINT "system_users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_tax_types" ADD CONSTRAINT "tenant_tax_types_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_payment_modes" ADD CONSTRAINT "tenant_payment_modes_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_in_ex_categories" ADD CONSTRAINT "tenant_in_ex_categories_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_business_branches" ADD CONSTRAINT "tenant_business_branches_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_network_providers" ADD CONSTRAINT "tenant_network_providers_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_mail_config" ADD CONSTRAINT "tenant_mail_config_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_mapped_business" ADD CONSTRAINT "tenant_mapped_business_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_mapped_business" ADD CONSTRAINT "tenant_mapped_business_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "system_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_refresh_tokens" ADD CONSTRAINT "tenant_refresh_tokens_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_places" ADD CONSTRAINT "tenant_places_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_streets" ADD CONSTRAINT "tenant_streets_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_streets" ADD CONSTRAINT "tenant_streets_tenantPlaceId_fkey" FOREIGN KEY ("tenantPlaceId") REFERENCES "tenant_places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_customers" ADD CONSTRAINT "tenant_customers_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_customers" ADD CONSTRAINT "tenant_customers_tenantPlaceId_fkey" FOREIGN KEY ("tenantPlaceId") REFERENCES "tenant_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_customers" ADD CONSTRAINT "tenant_customers_tenantStreetId_fkey" FOREIGN KEY ("tenantStreetId") REFERENCES "tenant_streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

