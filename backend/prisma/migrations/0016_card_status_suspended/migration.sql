-- SUPERSEDED becomes SUSPENDED, in name only.
--
-- The state already meant "replaced by a newer issue"; the business calls that
-- a suspended card, so the word changes and nothing else does. The issuing
-- transaction, the kept PDF and the issue numbering are untouched.
--
-- Both statements are METADATA-ONLY. Neither rewrites the table, so this is
-- safe against a populated tenant_member_id_cards - unlike 0014, which renamed
-- generatedAt/generatedBy by drop-and-add and could only do that because the
-- table was empty at the time.
--
-- RENAME VALUE needs PostgreSQL 10 or later. This project is Postgres-only and
-- the compose stack runs well past that, so there is no fallback path here.

-- AlterEnum
ALTER TYPE "TenantMemberIdCardStatus" RENAME VALUE 'SUPERSEDED' TO 'SUSPENDED';

-- AlterTable
--
-- Renamed with the status it records. A column called supersededAt sitting
-- beside a SUSPENDED status is the kind of half-rename that someone later has
-- to decode, and the rename costs nothing here.
ALTER TABLE "tenant_member_id_cards" RENAME COLUMN "supersededAt" TO "suspendedAt";

-- NOT TOUCHED, deliberately:
--
--   tenant_member_id_cards_one_active_per_member
--
-- The partial unique index is predicated on status = 'ACTIVE', which this
-- migration does not rename, so the index survives unchanged. It is what makes
-- "exactly one current card per member" a fact rather than a convention, and
-- dropping and recreating it here would be a window in which that stopped
-- being true.
