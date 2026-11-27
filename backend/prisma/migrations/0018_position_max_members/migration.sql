-- How many members may hold a position. 0 means unlimited.
--
-- An association has one President and one Treasurer, and as many ordinary
-- Members as it can recruit. Which positions are scarce is the association's
-- decision, so the number is data rather than code.
--
-- DEFAULT 0 is what makes this safe to apply to a populated table: every
-- existing position stays unlimited, which is exactly the behaviour before
-- this column existed. The opposite default would retroactively cap every
-- position in every association at the moment of upgrade.
--
-- Postgres 11+ stores a non-volatile DEFAULT in the catalogue rather than
-- rewriting every row, so this is a metadata-only change however large the
-- table is.
--
-- There is deliberately NO check constraint beyond non-negativity, and no
-- attempt to enforce the cap in the database: "at most N rows" is not
-- expressible as a unique constraint, and a trigger would put a business rule
-- somewhere nobody reading the service would find it. The rule is enforced in
-- TenantMembersService.assertPositionHasRoom(), which takes
-- `SELECT ... FOR UPDATE` on the position row first - the same lock-the-parent
-- pattern allocateMemberIdNumber() already uses for membership numbers.
ALTER TABLE "tenant_association_positions"
  ADD COLUMN "maxMembers" INTEGER NOT NULL DEFAULT 0;

-- Negative is meaningless and would read as "unlimited" to a `<= 0` test
-- somebody writes later. Rejecting it at the boundary keeps that reading from
-- ever being possible.
ALTER TABLE "tenant_association_positions"
  ADD CONSTRAINT "tenant_association_positions_maxMembers_nonneg"
  CHECK ("maxMembers" >= 0);
