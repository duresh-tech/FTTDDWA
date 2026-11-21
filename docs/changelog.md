# Changelog

Each app is versioned independently. Full histories:

- [Backend](https://github.com) — `backend/CHANGELOG.md`
- [Console](https://github.com) — `console/CHANGELOG.md`

## Backend 1.7.0 · Console 1.6.0

### PostgreSQL only

The schema declares `provider = "postgresql"`, and `AppSetting.value` moved
from the MySQL-only `@db.LongText` to `@db.Text` — the single type that
blocked the switch. The documentation-only `DATABASE_PROVIDER` key, which
nothing read, is gone.

Case-insensitive matching was restored by hand, since MySQL's collation had
been providing it: all 68 `contains:` filters across 16 services, both login
lookups, and the username/email uniqueness checks. See
[Database](/guide/database#case-sensitivity).

Real migrations now exist. The project previously ran on `prisma db push`
with no history, so containers had nothing to apply.

### Docker

Per-service compose stacks under `backend/docker/data/` and
`backend/docker/services/`, plus `console/docker-compose.yml`, aggregated by
the repository-root `docker-compose.yml` via `include:`. Data and services are
separate stacks so rebuilding the API never touches the database. See
[Docker](/guide/docker).

The console's configuration moved from build-time `NEXT_PUBLIC_*` inlining to
runtime `/runtime-config.js`, so one image runs in any environment. See
[Configuration](/guide/configuration#why-these-are-not-next-public).

### First-run setup wizard

`/setup` replaces the seed script and the open register endpoint. It creates
the `SYSTEM_SUPER_ADMIN` role with all 118 permissions, the first
administrator and the branding, in one transaction, then closes itself
permanently. There are no default credentials. See
[Setup wizard](/guide/setup-wizard).

### One role

Bootstrap creates exactly `SYSTEM_SUPER_ADMIN`, replacing the former
`SUPER_ADMIN` / `SYSTEM_USER` / `TENANT_ADMIN` trio. A tenant-visible
`TENANT_ADMIN` is optional. See
[RBAC & permissions](/logic/rbac-permissions).

### Removed

- `POST /system/register` and its console page. It was public, granted
  `SUPER_ADMIN` to whoever registered first, and never closed.
- The seeded `app.logo_path` pointing at a gitignored file.
- `src/lib/app-name.ts`, `UPLOADS_ORIGIN`, `DATABASE_PROVIDER`,
  `COOKIE_DOMAIN`.

### Fixed

- `getBrandingPublic()` now prefers the DB `app.name` row over the `APP_NAME`
  env var. It previously ignored the row, making the setting write-only. See
  [App settings](/logic/app-settings#public-branding).
- Boot-time env validation (`src/config/env.validation.ts`). `ConfigModule`
  validated nothing, so an empty `CORS_ORIGINS` silently disabled CORS.
- `main.ts` binds `0.0.0.0` explicitly and registers `enableShutdownHooks()`,
  so `docker stop` closes Prisma connections cleanly.
- `GET /system/health` added, backing the container healthchecks.
