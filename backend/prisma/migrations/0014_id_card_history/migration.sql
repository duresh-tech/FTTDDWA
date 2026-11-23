-- ID cards become a HISTORY, and members gain a portal password.
--
-- generatedAt/generatedBy are renamed to issuedAt/issuedBy by drop-and-add,
-- which LOSES their values. That is acceptable only because
-- tenant_member_id_cards held no rows when this was written; against a
-- populated table this has to be rewritten as two RENAME COLUMN statements.
-- issuedAt is likewise NOT NULL with no default for the same reason.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TenantMemberIdCardStatus" ADD VALUE 'SUPERSEDED';
ALTER TYPE "TenantMemberIdCardStatus" ADD VALUE 'REVOKED';

-- DropIndex
DROP INDEX "tenant_member_id_cards_tenantMemberId_key";

-- AlterTable
ALTER TABLE "tenant_member_id_cards" DROP COLUMN "generatedAt",
DROP COLUMN "generatedBy",
ADD COLUMN     "expiryAt" BIGINT,
ADD COLUMN     "issueNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "issuedAt" BIGINT NOT NULL,
ADD COLUMN     "issuedBy" CHAR(36),
ADD COLUMN     "revokeReason" VARCHAR(255),
ADD COLUMN     "revokedAt" BIGINT,
ADD COLUMN     "revokedBy" CHAR(36),
ADD COLUMN     "supersededAt" BIGINT;

-- AlterTable
ALTER TABLE "tenant_members" ADD COLUMN     "passwordHash" VARCHAR(255);

-- CreateTable
CREATE TABLE "tenant_member_refresh_tokens" (
    "id" CHAR(36) NOT NULL,
    "tenantMemberId" CHAR(36) NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "deviceType" VARCHAR(30),
    "expiresAt" BIGINT NOT NULL,
    "revokedAt" BIGINT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "tenant_member_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_member_refresh_tokens_tenantMemberId_idx" ON "tenant_member_refresh_tokens"("tenantMemberId");

-- CreateIndex
CREATE INDEX "tenant_member_refresh_tokens_tokenHash_idx" ON "tenant_member_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "tenant_member_id_cards_tenantMemberId_status_idx" ON "tenant_member_id_cards"("tenantMemberId", "status");

-- AddForeignKey
ALTER TABLE "tenant_member_refresh_tokens" ADD CONSTRAINT "tenant_member_refresh_tokens_tenantMemberId_fkey" FOREIGN KEY ("tenantMemberId") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one CURRENT card per member, enforced by the database.
--
-- Prisma cannot express a partial unique index, so it is added by hand here
-- and will not appear in schema.prisma. Dropping the old
-- tenant_member_id_cards_tenantMemberId_key above is what allows a history of
-- issues; this replaces it with the weaker, correct invariant: a member may
-- have many cards, but only one of them ACTIVE.
--
-- It is the backstop for the issuing transaction, which supersedes the
-- previous card before inserting the new one. Without it, a bug there would
-- leave two cards both claiming to be current and nothing would notice.
CREATE UNIQUE INDEX "tenant_member_id_cards_one_active_per_member"
  ON "tenant_member_id_cards" ("tenantMemberId")
  WHERE "status" = 'ACTIVE';
