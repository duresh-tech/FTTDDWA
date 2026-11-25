-- Two unrelated changes that both had to wait for a migration.
--
-- 1. Positions gain a flag deciding whether an APPLICANT may claim them.
-- 2. Places and streets are removed entirely.

-- ---------------------------------------------------------------------------
-- 1. Which positions a public applicant may choose
-- ---------------------------------------------------------------------------
--
-- Defaults TRUE so this changes nothing for an existing business: every
-- position stays offered until somebody decides otherwise. The opposite
-- default would empty the public form's picker at the moment of upgrade, for
-- every association at once.
--
-- It governs the PUBLIC form only. Staff enrolling a member directly still
-- choose from every position - an association has to be able to record a
-- Treasurer, and this flag is about what a stranger may claim about
-- themselves.
ALTER TABLE "tenant_association_positions"
  ADD COLUMN "showOnApplicationForm" BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2. Drop places and streets
-- ---------------------------------------------------------------------------
--
-- DESTRUCTIVE, and verified safe before writing: both tables were empty, the
-- only foreign key into either was tenant_streets -> tenant_places (dropped
-- together below), and no member, address or card column ever referenced
-- them. The two settings that pointed at them - association.placeId and
-- association.streetId - were unset everywhere and are retired through
-- REMOVED_SETTING_DEFINITIONS in the same change.
--
-- CHECK BEFORE APPLYING THIS TO REAL DATA:
--
--   SELECT count(*) FROM tenant_places;
--   SELECT count(*) FROM tenant_streets;
--
-- If either returns rows, that data is about to be lost. Unlike every other
-- delete in this schema - which are soft, via a status enum and deletedAt -
-- there is no recovering from a DROP TABLE.
--
-- Streets first: it holds the foreign key.
DROP TABLE IF EXISTS "tenant_streets";
DROP TABLE IF EXISTS "tenant_places";

DROP TYPE IF EXISTS "TenantStreetStatus";
DROP TYPE IF EXISTS "TenantPlaceStatus";

-- The permission rows go too. `npm run seed` removes keys the catalogue no
-- longer declares, so this is belt and braces for an instance that is
-- migrated but not re-seeded - without it those rows would linger as grantable
-- permissions over routes that no longer exist.
DELETE FROM "role_permissions"
  WHERE "permissionId" IN (
    SELECT "id" FROM "permissions"
    WHERE "permissionKey" LIKE 'tenant-places:%'
       OR "permissionKey" LIKE 'tenant-streets:%'
  );
DELETE FROM "permissions"
  WHERE "permissionKey" LIKE 'tenant-places:%'
     OR "permissionKey" LIKE 'tenant-streets:%';

-- ---------------------------------------------------------------------------
-- 3. Aadhaar becomes optional
-- ---------------------------------------------------------------------------
--
-- Widening only: NOT NULL -> NULL on six columns, which can never fail and
-- never rewrites a row.
--
-- The @@unique([tenantBusinessId, aadhaarHash]) on both tables SURVIVES and
-- still does its job. Postgres treats NULLs as distinct in a unique index, so
-- any number of members may have no Aadhaar while two members still cannot
-- share one. That is exactly the semantics wanted: the blind index catches
-- duplicates among people who gave a number, and says nothing about those who
-- did not.
ALTER TABLE "tenant_members"
  ALTER COLUMN "aadhaarNumber" DROP NOT NULL,
  ALTER COLUMN "aadhaarHash"   DROP NOT NULL,
  ALTER COLUMN "aadhaarLast4"  DROP NOT NULL;

ALTER TABLE "tenant_member_applications"
  ALTER COLUMN "aadhaarNumber" DROP NOT NULL,
  ALTER COLUMN "aadhaarHash"   DROP NOT NULL,
  ALTER COLUMN "aadhaarLast4"  DROP NOT NULL;
