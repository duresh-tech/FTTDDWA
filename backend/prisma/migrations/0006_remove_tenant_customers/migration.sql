-- Remove the tenant customers feature.
--
-- Places and streets deliberately SURVIVE: a street still belongs to a place,
-- both keep their own CRUD, permissions and screens. Only their customer
-- consumer goes away, which is why the two FKs below drop from the customer
-- side and nothing on the place or street side changes.
--
-- The matching permission rows and the three customer.* setting definitions
-- are NOT deleted here. They drain at bootstrap through
-- REMOVED_PERMISSION_MODULES and REMOVED_SETTING_DEFINITIONS, so every install
-- self-heals on `npm run seed` rather than just this one database.

-- DropForeignKey
ALTER TABLE "tenant_customers" DROP CONSTRAINT "tenant_customers_tenantBusinessId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_customers" DROP CONSTRAINT "tenant_customers_tenantPlaceId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_customers" DROP CONSTRAINT "tenant_customers_tenantStreetId_fkey";

-- DropTable
DROP TABLE "tenant_customers";

-- DropEnum
DROP TYPE "TenantCustomerGender";

-- DropEnum
DROP TYPE "TenantCustomerStatus";

-- DropEnum
DROP TYPE "TenantCustomerType";

