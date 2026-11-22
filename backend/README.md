# Backend — System API

[![Version](https://img.shields.io/badge/version-1.7.0-blue)](./CHANGELOG.md)

NestJS + Prisma REST API for the system console. See [`CHANGELOG.md`](./CHANGELOG.md)
for release history and [`../README.md`](../README.md) for the project overview.

| | |
| --- | --- |
| Framework | NestJS 10 (TypeScript) |
| ORM | Prisma 6 |
| Database | PostgreSQL 17 (Prisma migrations) |
| Auth | Passport.js — JWT access + rotating refresh token |
| Validation | Zod (`nestjs-zod`) |
| Docs | Swagger/OpenAPI at `/docs` |
| Runtime | Docker (`node:22-bookworm-slim`, non-root) |

## Setup

The supported path is Docker, from the repository root -- it starts Postgres,
applies migrations and serves the API:

```bash
cp backend/.env.example backend/.env   # then fill in the secrets
docker compose up -d --build
```

Host-native development, against your own Postgres:

```bash
npm install
cp .env.example .env            # set DATABASE_URL and the JWT secrets
npx prisma migrate deploy       # apply the committed migrations
npm run dev                     # http://localhost:4000  (alias of start:dev)
```

**There are no default credentials.** A fresh database is initialized through
the console's first-run wizard at `/setup`, which creates the administrator
account and the `SYSTEM_SUPER_ADMIN` role. For a scripted, non-interactive
instance, `npm run seed` does the same thing through the same shared code
(defaulting to `admin` / `Admin@12345`, overridable with the `SEED_ADMIN_*`
variables -- development only).

Environment variables are validated at boot by
`src/config/env.validation.ts`: a missing or short JWT secret, a non-Postgres
`DATABASE_URL`, or an empty `CORS_ORIGINS` aborts startup with a readable
message rather than failing mysteriously later.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `start:dev` | Watch-mode dev server |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled build |
| `npm run start:docker` | Watch mode with no `pre*` hook (used by the dev container) |
| `npm run prisma:migrate` | Create a new versioned migration (development) |
| `npm run migrate:deploy` | Apply committed migrations (what the container entrypoint runs) |
| `npm run prisma:studio` | Prisma Studio GUI |
| `npm run seed` | Initialize an instance non-interactively (same code as the wizard) |

Avoid `npm run prisma:push`: Postgres enum changes need a real migration, and
the container entrypoint applies migration history rather than pushing a
schema.

## API surface

All routes are versioned under `/api/v{API_VERSION}` (defaults to `/api/v1`
via the `API_VERSION` env var — see below). Every request must send an
`x-device-type` header (`website | androidApp | iosApp | desktopApp`).

System-admin routes live under `/api/v1/system/...`. Every business-scoped
resource also has a **tenant self-service** twin under `/api/v1/tenant/...`,
authenticated with a separate tenant JWT and scoped to the caller's own
mapped business — same permission keys, same shared service, two
controllers (see `CHANGELOG.md` for the full per-resource list).

| Area | Routes |
| --- | --- |
| System auth | `POST /system/login`, `/system/refresh`, `/system/logout`, `GET /system/me` |
| First-run setup | `GET /system/setup/status`, `POST /system/setup/logo`, `POST /system/setup/initialize` -- public, and permanently `409` once a system user exists |
| Health | `GET /system/health` -- returns `{ status, db }`, backs the Docker healthcheck |
| Tenant auth | `POST /tenant/login`, `/tenant/refresh`, `/tenant/logout`, `GET /tenant/me`, `GET /tenant/dashboard` |
| Permissions | `GET/POST /system/permissions`, `GET/PATCH/DELETE /system/permissions/:id` |
| Roles | `GET/POST /system/roles`, `GET/PATCH/DELETE /system/roles/:id` |
| System users | `GET/POST /system/users`, `GET/PATCH/DELETE /system/users/:id` |
| Tenant users | `GET/POST /system/tenant-users`, `GET/PATCH/DELETE /system/tenant-users/:id`, `POST /system/tenant-users/:id/login-as`; tenant self-service twin at `/tenant/users` (+ `GET /tenant/users/roles`) |
| Tenant business | `GET/POST /system/tenant-business`, `GET/PATCH/DELETE /system/tenant-business/:id`, `PATCH .../restore`; tenant self-service twin at `/tenant/business` (own profile only) |
| Tenant mapped business | `GET/POST /system/tenant-mapped-business`, `GET/PUT/PATCH/DELETE /system/tenant-mapped-business/:id`, `PATCH .../restore` |
| Tenant account | `GET/PATCH /tenant/account`, `POST /tenant/account/avatar` |
| Tenant business settings | `GET /system/tenant-business-settings?tenantBusinessId=…`, `GET/PATCH /system/tenant-business-settings/:id` (value, or the per-business `isReadonly` lock); tenant self-service `GET /tenant/business-settings` and batch `PATCH /tenant/business-settings`. |
| Setting definitions | `GET/POST /system/setting-definitions`, `GET/PATCH /system/setting-definitions/:id`. No delete - a definition is retired with `status=INACTIVE`, because businesses hold copies. |
| Settings sync | `POST /system/settings-sync` backfills definitions to businesses that already exist; `GET /system/settings-sync/logs` says what each run did. |
| Tenant members | `GET/POST /system/tenant-members`, `GET/PATCH/DELETE /system/tenant-members/:id`, `PATCH .../:id/status`, `PATCH .../:id/restore`; tenant twin at `/tenant/members`. The Aadhaar number is stored encrypted and never returned - only `aadhaarLast4`. |
| Tenant states, districts, taluks, industries, association positions, mail config, places, streets | Each: `GET/POST /system/tenant-<resource>`, `GET/PATCH/DELETE /system/tenant-<resource>/:id` (+ `restore` where applicable); tenant self-service twin at `/tenant/<resource>` scoped to the caller's mapped business. Mail config additionally has `POST .../:id/test-email`, and tenant self-service create is capped at one config per account (system-admin create is not). |
| App settings | `GET /system/app-settings/public/branding` (public), `GET/POST /system/app-settings`, `GET/PATCH/DELETE /system/app-settings/:id`, `PATCH .../restore`, `GET .../key/:key`, `POST .../logo` |
| Dashboard | `GET /system/dashboard` |
| Uploads | `POST /system/uploads`; tenant self-service twin at `POST /tenant/uploads` |

Full request/response schemas — including a concrete JSON example for
every success response — are at `http://localhost:4000/docs`.

## RBAC

Every protected system-admin route declares its required permission key
with `@RequirePermissions('module:action')` (e.g. `roles:delete`); tenant
self-service routes use the parallel `@RequireTenantPermissions()` /
`TenantPermissionsGuard`, evaluated independently of the system guard so
the two audiences never cross-check each other's routes. A global guard
resolves the caller's role → permissions on each request. `isSystem` roles
and permissions cannot be deleted, and a role's `roleKey` (or a system
permission's `permissionKey`/`moduleName`) is immutable once created.

Seeded permission keys (module: actions):

| Module | Actions |
| --- | --- |
| `dashboard` | `view` |
| `tenant-dashboard` | `view` |
| `tenant-account` | `view`, `update` |
| `permissions` | `create`, `read`, `update`, `delete`, `delete_system` |
| `roles` | `create`, `read`, `update`, `delete`, `delete_system` |
| `system-users` | `create`, `read`, `update`, `delete` |
| `tenant-users` | `create`, `read`, `view`, `update`, `delete`, `login-as` |
| `tenant-business` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-mapped-business` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-association-positions` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-states` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-districts` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-taluks` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-industries` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-members` | `create`, `view`, `update`, `delete`, `list`, `restore`, `change_status` |
| `tenant-places` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-streets` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `tenant-mail-config` | `create`, `view`, `update`, `delete`, `list`, `test` |
| `app-settings` | `create`, `view`, `update`, `delete`, `list`, `restore` |
| `setting-definitions` | `create`, `view`, `update`, `list` |
| `tenant-business-settings` | `view`, `update`, `list` |
| `settings-sync` | `run` |
| `uploads` | `create` |

`TENANT_ADMIN` (the default `visibleToTenants` role) is granted the
non-`restore` actions of every tenant-scoped module, plus `tenant-users:*`
minus `login-as`. `app-settings` is system-admin-only and not granted to
`TENANT_ADMIN` at all, and neither is `tenant-business-settings:list` — that
key is the cross-tenant support view, and a tenant has only its own business
to read.

Rows flagged `isSystem` are seeded defaults and are refused by the normal
`delete` action. The two modules that have such rows — `permissions` and
`roles` — each carry a
second `delete_system` action that lifts that refusal; the delete endpoint
reads it off the caller and returns 403 when a system row is targeted
without it. Only `SYSTEM_SUPER_ADMIN` holds these (it is granted every
permission); the optional `TENANT_ADMIN` deliberately does not, so defaults
shared across businesses cannot be removed from the tenant portal.

### Where the catalogue lives

`src/common/constants/permissions.ts` holds all 122 permission keys across 20
modules, and `src/common/bootstrap/bootstrap.ts` holds the bootstrap itself.
Both the setup wizard and `prisma/seed.ts` import them, so the two paths
cannot drift.

Bootstrap creates exactly one role, `SYSTEM_SUPER_ADMIN`, with every
permission granted. That is not a shortcut: neither `PermissionsGuard` nor
`TenantPermissionsGuard` has a super-admin bypass, and `jwt.strategy.ts`
re-resolves permissions from `role_permissions` on every request, so the
grants have to exist as rows.

## Security

- Argon2id password hashing.
- Helmet security headers; `x-powered-by` disabled.
- CORS restricted to `CORS_ORIGINS`.
- Rate limiting: global (`THROTTLE_LIMIT`/`THROTTLE_TTL_MS`) + a stricter
  5/min throttle on login and on the setup endpoints.
- No public registration. The setup wizard creates the first administrator
  and then closes permanently; any further account needs
  `system-users:create`.
- Boot-time environment validation, including production-only checks that
  reject placeholder JWT secrets and require `COOKIE_SECURE=true`.
- Containers run as the non-root `node` user.
- CSRF double-submit protection (`csrf_token` cookie + `x-csrf-token`
  header) on the cookie-based refresh/logout endpoints.
- Prisma parameterized queries (no raw SQL) prevent injection.
- Zod validation on every request body via a global pipe.

## Storage

`STORAGE_DRIVER=local|s3` in `.env`. Local files are written under
`LOCAL_STORAGE_DIR` and served at `/uploads`; S3 uses `@aws-sdk/client-s3`.
Only the relative **path** is ever stored in the database — never a full URL.

## Database

PostgreSQL 17. IDs are UUIDv7 (`CHAR(36)`) generated in application code,
timestamps are UNIX seconds (`BIGINT`), enums are native, and soft deletes use
a `status` enum plus `deletedAt` rather than removing rows. There is no raw
SQL anywhere except the health check's `SELECT 1`.

Schema changes go through migrations, which the container entrypoint applies
with `prisma migrate deploy` on boot. To author one:

```bash
docker compose up -d postgres
DATABASE_URL="postgresql://fttddwa:PASSWORD@localhost:5433/fttddwa_db?schema=public" \
  npx prisma migrate dev --name describe_your_change
```

The containers apply migrations on boot (`docker/entrypoint.sh`). To run them
deliberately instead, use the one-off job in the `setup` profile:

```bash
docker compose --profile setup run --rm migrate
```

Note that `up -d --build` does not rebuild a profile service -- after changing
this image run `docker compose --profile setup build migrate` first.

Commit the resulting `prisma/migrations/` directory -- the containers depend
on it.

### Case sensitivity

Postgres compares text case-sensitively where MySQL's default collation did
not. Every list-search filter passes `mode: 'insensitive'`, and the login and
uniqueness lookups compare case-insensitively, so `Admin` and `admin` cannot
become two separate accounts. Bootstrap also lowercases the stored username
and email.

Those searches use `ILIKE` and therefore cannot use the plain btree indexes.
These are admin list screens over small tables, so that is fine for now; if
they grow large, `pg_trgm` indexes are the next step.

## Environment variables

Two files, depending on how the API is run:

There is one file, `backend/.env` (copy [`.env.example`](./.env.example)).
Every Docker stack reads it for its `${...}` values, and the containers load
the same file, so the configuration lives in exactly one place.

It covers `API_VERSION` (URI versioning, defaults to `1`), the database
connection, JWT secrets and expiry, cookie settings, CORS origins,
throttling, the storage driver and S3 credentials, and the Swagger toggles.
Every variable is validated at boot -- see `src/config/env.validation.ts`.

**The database name lives in exactly one place.** Under Docker,
`docker/entrypoint.sh` composes `DATABASE_URL` from `POSTGRES_USER`,
`POSTGRES_PASSWORD` and `POSTGRES_DB`, which the `postgres` service reads from
the same file -- so the name cannot drift between the two. Setting
`DATABASE_URL` explicitly overrides that composition, which is how
host-native development keeps working.

`CORS_ORIGINS` must be the console origin **as the browser sees it**, never a
compose service name such as `http://console:3000` (those resolve only
container-to-container). An empty value would silently reject every
cross-origin browser request, so validation rejects it outright.
