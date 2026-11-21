-- Remove five tenant resources that a tent dealers' and decorators'
-- association has no use for: tax types, payment modes, income & expense
-- categories, business branches and network providers.
--
-- Nothing referenced them. The only schema coupling was five back-relation
-- arrays on tenant_business, which carry no columns, so the five FK drops
-- below are the whole of it.
--
-- The matching permission rows are NOT deleted here. They are drained at
-- bootstrap through REMOVED_PERMISSION_MODULES in
-- src/common/constants/permissions.ts, which also clears their
-- role_permissions grants - so every install self-heals on `npm run seed`,
-- not just this one database.

-- DropForeignKey
ALTER TABLE "tenant_business_branches" DROP CONSTRAINT "tenant_business_branches_tenantBusinessId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_in_ex_categories" DROP CONSTRAINT "tenant_in_ex_categories_tenantBusinessId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_network_providers" DROP CONSTRAINT "tenant_network_providers_tenantBusinessId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_payment_modes" DROP CONSTRAINT "tenant_payment_modes_tenantBusinessId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_tax_types" DROP CONSTRAINT "tenant_tax_types_tenantBusinessId_fkey";

-- DropTable
DROP TABLE "tenant_business_branches";

-- DropTable
DROP TABLE "tenant_in_ex_categories";

-- DropTable
DROP TABLE "tenant_network_providers";

-- DropTable
DROP TABLE "tenant_payment_modes";

-- DropTable
DROP TABLE "tenant_tax_types";

-- DropEnum
DROP TYPE "TaxCalculationType";

-- DropEnum
DROP TYPE "TenantBusinessBranchStatus";

-- DropEnum
DROP TYPE "TenantInExCategoryStatus";

-- DropEnum
DROP TYPE "TenantInExCategoryType";

-- DropEnum
DROP TYPE "TenantNetworkProviderStatus";

-- DropEnum
DROP TYPE "TenantNetworkProviderType";

-- DropEnum
DROP TYPE "TenantPaymentModeStatus";

-- DropEnum
DROP TYPE "TenantTaxTypeStatus";

