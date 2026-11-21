# Database & migrations

PostgreSQL 17, through Prisma. MySQL is no longer supported.

## Conventions

- **Primary keys** are UUIDv7 `CHAR(36)` strings generated in application code
  (`src/common/utils/id.util.ts`), not database defaults. Time-ordered, so
  they keep btree indexes compact.
- **Timestamps** are UNIX epoch seconds in `BIGINT` columns. `main.ts` patches
  `BigInt.prototype.toJSON` so they serialize as numbers.
- **Soft deletes** use a `status` enum plus `deletedAt`, never row removal.
- Every record also carries a short human-readable `systemCode`
  (`USR-MBX2K1-4F7A`).
- **No raw SQL** anywhere except the health check's `SELECT 1`.

19 models, 22 native enums.

::: tip CHAR(36) in Postgres
`char(n)` is blank-padded in Postgres. That is harmless here because every
value is exactly 36 characters. `varchar(36)` would be tidier if the column
types are ever revisited.
:::

## Authoring a migration

The project had **no migration history** at all — it ran on `prisma db push` —
so the Postgres baseline is the first real migration.

```bash
docker compose up -d postgres
cd backend
DATABASE_URL="postgresql://fttddwa:PASSWORD@localhost:5433/fttddwa_db?schema=public" \
  npx prisma migrate dev --name describe_your_change
```

Commit the resulting `backend/prisma/migrations/` directory. The containers
depend on it: the entrypoint runs `prisma migrate deploy`, which applies
committed history and nothing else. Without the directory in git, a
production container applies zero migrations and every query fails on missing
tables.

::: warning Avoid prisma db push
Postgres enum changes need a real migration, and `db push` keeps no history
for `migrate deploy` to apply. MySQL's `db push` was laxer about both.

The old seed carried a comment about `db push` not reliably re-applying
`ON DELETE CASCADE` to an existing foreign key — which is why
`cleanupRemovedPermissions` still deletes `role_permissions` rows explicitly
rather than trusting the cascade.
:::

## Applying migrations

On boot, automatically, by `backend/docker/entrypoint.sh`. Or deliberately:

```bash
docker compose --profile setup run --rm migrate
```

Remember that `up -d --build` does not rebuild a profile service — after
changing the backend image, run
`docker compose --profile setup build migrate` first.

## Case sensitivity

This is the one behavioural difference from MySQL that is easy to miss.

MySQL's default collation made both `LIKE` and unique lookups
case-insensitive. Postgres does neither. Left alone, the switch would have:

- made every search box stricter — searching `JOHN` would stop matching `john`
- allowed `Admin` and `admin` to exist as two separate accounts, because the
  duplicate check would not see a clash
- broken sign-in for anyone typing their username with different capitalization

So:

- All **68** `contains:` filters across 16 services pass
  `mode: 'insensitive' as const`.
- The login lookups in `auth.service.ts` and `tenant-auth.service.ts` use
  insensitive `equals` on both username and email.
- The uniqueness checks in `system-users.service.ts` and
  `tenant-users.service.ts` do the same.
- Bootstrap lowercases the stored username and email for the first
  administrator.

The `as const` matters: `mode` widens to `string` in a `where` object built as
a standalone variable, which Prisma's types then reject. `tsc --noEmit` is a
complete guard here, since `mode` is only valid on `String` filters.

```bash
cd backend
# both must report 67 lines / 68 occurrences
grep -rc "contains:" src --include=*.service.ts | awk -F: '{s+=$2} END {print s}'
```

These searches use `ILIKE` and so cannot use the plain btree indexes. They are
admin list screens over small tables, so that is fine; `pg_trgm` indexes are
the next step if the tables grow.

## Inspecting the database

```bash
docker compose exec postgres psql -U fttddwa -d fttddwa_db -c '\dt'
docker compose exec postgres psql -U fttddwa -d fttddwa_db \
  -c "select role_key, count(*) from roles r
      join role_permissions rp on rp.role_id = r.id group by 1"
```

Or Prisma Studio against the published port:

```bash
cd backend && npx prisma studio
```

## Resetting

```bash
docker compose down -v        # deletes the database AND the uploads
docker compose up -d --build  # fresh schema, then /setup again
```

There is no data migration path from the old MySQL database; this is a fresh
start by design.
