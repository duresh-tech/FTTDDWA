# FTTDDWA — System Console

**Federation of Tamilnadu Tent Dealers & Decorators Welfare Association.**

[![Backend](https://img.shields.io/badge/backend-v2.1.0-blue)](./backend/CHANGELOG.md)
[![Console](https://img.shields.io/badge/console-v2.1.0-blue)](./console/CHANGELOG.md)

`FTTDDWA` is the short form used everywhere it has to fit: the `APP_NAME`
default, the browser tab title, the Swagger title and the console sidebar.

Full-stack system administration console with RBAC-driven CRUD for system
users, roles, and permissions, plus a parallel **tenant portal**: tenant
users log in separately and manage their own business — team members,
customers, mail config, places, and streets — mirroring the
system-admin CRUD for each resource, scoped to their own mapped business.
A generic typed key-value **App Settings** store backs app-wide config
(branding and beyond).

| Layer    | Stack                                                             |
| -------- | ----------------------------------------------------------------- |
| Console  | Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui  |
| Backend  | NestJS 10 · TypeScript · Prisma ORM · Passport JWT · Zod          |
| Database | PostgreSQL 17                                                     |
| Runtime  | Docker Compose (postgres + backend + console)                     |
| Storage  | Driver-based: local volume or cloud S3 (paths only in DB)         |

```
fttddwa/
├── backend/              NestJS REST API  → http://localhost:4000/api/v1  (Swagger: /docs)
│   ├── docker/data/        postgres stack
│   ├── docker/services/    api stack (+ the migrate job)
│   └── README.md · CHANGELOG.md · Dockerfile
├── console/              Next.js app      → http://localhost:3000
│   ├── docker-compose.yml  console stack
│   └── README.md · CHANGELOG.md · Dockerfile
├── docs/                 VitePress documentation site
└── docker-compose.yml    thin aggregator: `include:` of the three stacks
```

Compose is split by lifecycle, so rebuilding the API never stops or
recreates the database. Each stack also runs on its own, which is what makes
a split deployment possible. See [`docs/guide/docker.md`](./docs/guide/docker.md).

Each app is versioned and documented independently — see
[`backend/README.md`](./backend/README.md) /
[`backend/CHANGELOG.md`](./backend/CHANGELOG.md) and
[`console/README.md`](./console/README.md) /
[`console/CHANGELOG.md`](./console/CHANGELOG.md) for details specific
to each. This file covers the project as a whole.

## Quick start

Prerequisites: Docker with Compose v2. Nothing else — no Node, no database
install.

```bash
# 1. Per-app config. Each app owns its own env file.
cp backend/.env.example backend/.env
cp console/.env.example console/.env

# 2. Generate the two JWT secrets and set a database password in
#    backend/.env  (min 32 chars each, and they must differ):
openssl rand -hex 32    # -> JWT_ACCESS_SECRET
openssl rand -hex 32    # -> JWT_REFRESH_SECRET

# 3. Bring it up.
docker compose up -d --build
```

Then open <http://localhost:3000>. A fresh instance redirects to **`/setup`**,
a first-run wizard that creates the administrator account, sets the
application name and logo, and prepares the permission set. There are no
default credentials — you choose them in the wizard, which permanently closes
itself once an account exists.

```bash
docker compose ps                    # health of each service
docker compose logs -f api console
docker compose down                  # stop; every volume survives
```

> **`down -v` at the repository root deletes everything**, the database and
> uploaded files included. On a single stack it only removes that stack's
> volumes.

### Development

Run only the database in Docker and the apps on the host, for hot reload:

```bash
docker compose up -d postgres

cd backend && npm install && npx prisma migrate deploy && npm run dev
cd console && npm install && npm run dev
```

`backend/.env` already points `DATABASE_URL` at `localhost:5433`, the port the
data stack publishes, so one file serves both. For the console, copy the
commented `NEXT_PUBLIC_*` block from `console/.env.example` into
`console/.env.local`.

Both Dockerfiles also carry a `dev` target with watch mode, if you would
rather work inside containers — see
[`docs/guide/docker.md`](./docs/guide/docker.md#development).

### Database migrations

Schema changes go through Prisma migrations; containers apply them
automatically on boot (`prisma migrate deploy` in the backend entrypoint).
To author a new one:

```bash
docker compose up -d postgres
cd backend
DATABASE_URL="postgresql://fttddwa:<password>@localhost:5433/fttddwa_db?schema=public" \
  npx prisma migrate dev --name describe_your_change
```

Or apply them deliberately through the one-off job, which lives in the
`setup` profile so it never starts with `up`:

```bash
docker compose --profile setup run --rm migrate
```

Commit the generated `backend/prisma/migrations/` directory — the containers
depend on it. Avoid `prisma db push`: Postgres enum changes need a real
migration.

## Configuration

Two env files, one per app, both gitignored with committed `.example`
templates. Full variable lists live in those templates.

| File | Owns |
| --- | --- |
| `backend/.env` | Database credentials, JWT secrets, CORS, throttling, storage, Swagger, Docker host ports and resource limits. Read by every backend stack. |
| `console/.env` | The browser-facing API URL, app name, map tile server. |
| `console/.env.local` | Host-native `npm run dev` only, using the `NEXT_PUBLIC_*` names. |

**The database name comes from `POSTGRES_DB`, in one place.** The backend
entrypoint composes `DATABASE_URL` from `POSTGRES_USER` / `POSTGRES_PASSWORD`
/ `POSTGRES_DB`, which the `postgres` service reads from the same file, so the
name cannot drift between the two. Setting `DATABASE_URL` explicitly overrides
that.

**Env vars are validated at boot** (`backend/src/config/env.validation.ts`).
A missing or short JWT secret, a non-Postgres `DATABASE_URL`, or an empty
`CORS_ORIGINS` aborts startup with a readable message instead of failing
mysteriously later. `APP_ENV=production` additionally requires
`COOKIE_SECURE=true` and non-placeholder secrets.

### URLs must be browser-facing

```
browser ──► localhost:3000 ──► console    (HTML + /runtime-config.js)
        └─► localhost:4000 ──► backend    (all data, auth, /uploads)
backend ──► postgres:5432               (internal network, unpublished in prod)
```

`APP_API_URL` and `CORS_ORIGINS` must both be addresses **the browser** can
reach. A compose service name such as `http://backend:4000` resolves only
between containers and fails in the browser.

The console resolves its API URL at **run time**, from `/runtime-config.js`,
rather than having it inlined at build time by `next build`. So one image runs
in any environment and changing the URL is a restart, not a rebuild.

### Cookies and deployment domains

Auth cookies are `sameSite=strict` with no explicit domain. SameSite is
computed per *site* and ignores ports, so `localhost:3000` → `localhost:4000`
works in development.

**In production both services must share one registrable domain** — e.g.
`app.example.com` plus `api.example.com`, with `COOKIE_SECURE=true`. Split
domains (`app.vercel.app` + `api.fly.dev`) would silently break token refresh.
If you ever need genuinely separate domains, add a Next `rewrites` proxy so
the API is same-origin.

## Backend

- **API versioning**: URI-based, driven by the `API_VERSION` env var (defaults to `1` → `/api/v1`). System-user routes live under `/api/v1/system/...`.
- **Swagger / OpenAPI**: `http://localhost:4000/docs` — every endpoint documented (operations, params, responses with JSON examples, bearer auth, global `x-device-type` header). Disabled by default in production. Keep decorators updated on every endpoint change.
- **Health**: `GET /api/v1/system/health` returns `{ status, db }` and backs the Docker healthcheck. Note that the global `DeviceHeaderGuard` has no bypass, so any probe must send `x-device-type: website`.
- **First-run setup**: `GET /system/setup/status`, `POST /system/setup/logo`, `POST /system/setup/initialize`. All public, all permanently `409` once a system user exists. `initialize` runs in one transaction, so a failure cannot leave a half-initialized instance.
- **Auth (Passport.js)**: JWT access token (Bearer, 15 min) + rotating refresh token (httpOnly cookie, 7 days, SHA-256 hash stored in `refresh_tokens`). `POST /system/login`, `/system/refresh`, `/system/logout`, `GET /system/me`. There is no public registration endpoint — the wizard creates the first admin, and further accounts come from `POST /system/users` (`system-users:create`).
- **Tenant portal & auth**: a fully parallel, namespaced auth audience (own JWT strategy, refresh-token table, and cookie names) so a tenant session and a system-admin session coexist in the same browser. `POST /tenant/login`, `GET /tenant/me`, `GET /tenant/dashboard`. System admins can also "Login as" any tenant user.
- **RBAC**: `permissions` ⇄ `role_permissions` ⇄ `roles` ⇄ `system_users`/`tenant_users`. System routes declare `@RequirePermissions('roles:delete')`; tenant routes use the parallel `@RequireTenantPermissions()`, evaluated by an independent guard. The catalogue of 94 permissions across 21 modules lives in `src/common/constants/permissions.ts`, shared by the wizard and the seed.
- **One bootstrap role**: `SYSTEM_SUPER_ADMIN`, holding every permission. Neither guard has a super-admin bypass — permissions are resolved from `role_permissions` on every request — so the role genuinely holds all 94 grants. Any further roles are created through the Roles UI.
- **App Settings**: a generic typed key-value config store (`app_settings` — `key`, `dataType`, `value`, `description`, soft-delete `status`). The public `GET /system/app-settings/public/branding` endpoint returns the app name and logo, preferring the DB `app.name` row and falling back to the `APP_NAME` env var.
- **Dual-surface CRUD pattern**: each tenant-scoped resource is one Prisma model + one shared service, exposed through a system-admin controller (unrestricted) and a tenant self-service controller (scoped to the caller's own mapped business via `tenant_mapped_business`), sharing one permission-key namespace.
- **Validation**: Zod schemas via `nestjs-zod` (global pipe), surfaced in Swagger.
- **API keys**: every request needs one — `ApiKeyGuard` is global and **fails closed**, with four exemptions for callers that cannot present a key (`@SkipApiKey()`). The setup wizard issues the console's own key and stores it encrypted; the console reads it from `GET /system/setup/status` at run time, so there is no env var to configure. `@Public()` skips the JWT, `@SkipApiKey()` skips the key — different axes. See [API keys](./docs/guide/api-keys.md).
- **Security**: Argon2id password hashing · helmet security headers · CORS restricted to `CORS_ORIGINS` · rate limiting (global 100/min, login 5/min, setup 5/min) · CSRF double-submit (cookie `csrf_token` + header `x-csrf-token` on cookie-based endpoints) · SQL injection prevented by Prisma parameterized queries · mandatory `x-device-type` header (`website | androidApp | iosApp | desktopApp`) · non-root containers.
- **Storage**: `STORAGE_DRIVER=local|s3`. Local files go to `public/uploads` (served at `/uploads`, backed by the `uploads` volume); S3 uses `@aws-sdk/client-s3`. Only the **path** is stored, never a URL. Upload endpoint: `POST /system/uploads`.
- **IDs & timestamps**: UUIDv7 primary keys, unique human-readable `systemCode` per record, UNIX-timestamp `createdAt/updatedAt/deletedAt` columns, soft deletes via `status=DELETED`.
- **Case sensitivity**: Postgres is case-sensitive where MySQL's collation was not, so all list searches use `mode: 'insensitive'` and login/uniqueness lookups compare case-insensitively.

## Console

- Two shells: the system dashboard (top navbar + sidebar) and a parallel tenant portal (`/tenant/login`, `/tenant/dashboard`, its own sidebar/topbar), both with a Sheet drawer on mobile.
- **First-run wizard** at `/setup`, outside both shells. Every entry point (`/`, both login pages, both session providers) redirects there until the instance is initialized, and `/setup` redirects back to sign-in once it is.
- Theme: light / dark / system via `next-themes` toggle.
- System dashboard pages: `/system/login`, `/system/dashboard`, plus full create/edit/delete management screens for System Users, Tenant Users, Roles, Permissions, and every tenant-scoped resource (Tenant Business, Business Domains, Mapped Business, Mail Config, Places, Streets, Customers), plus API Keys, API Key Scope Templates and a generic App Settings admin page. The sidebar groups these under Main, Access Control, Tenants, Locations, Integrations and Settings.
- Tenant portal pages: `/tenant/dashboard`, `/tenant/users` (team management), `/tenant/customers`, and `/tenant/settings/*` — a self-service twin of each admin resource page, scoped to the caller's own business.
- **Permission-gated UI**: create/edit/delete/view actions and sidebar sections only render if the signed-in user's resolved permissions allow them (mirrors, but does not replace, backend RBAC enforcement).
- **Map-based location picker**: an OpenStreetMap/Leaflet picker (address search, draggable marker, live radius circle) embedded in the create/edit dialog for Places and Streets.
- **Animated + mobile-responsive**: page transitions, a sliding nav indicator, staggered stat cards, skeleton loading states, and animated table rows via `motion` (Framer Motion, respects `prefers-reduced-motion`); every admin table renders as stacked cards on mobile instead of a horizontally-scrolling table.
- API clients (`src/lib/api.ts` for system, `src/lib/tenant-api.ts` for tenant) send `x-device-type: website` and the console's `x-api-key` (from `src/lib/console-key.ts`), attach the Bearer token, and auto-refresh it once on 401 using the CSRF-protected refresh endpoint.
- **Runtime config** (`src/lib/runtime-config.ts`): the API URL, app name and tile server are read from `window.__RUNTIME_CONFIG__`, published per request by `src/app/runtime-config.js/route.ts`. Host-native `npm run dev` still falls back to the `NEXT_PUBLIC_*` values in `.env.local`.

## Documentation

A VitePress site in [`docs/`](./docs) carries the detail this file only
summarizes:

```bash
cd docs && npm install && npm run docs:dev
```

| Page | Covers |
| --- | --- |
| [Getting started](./docs/guide/getting-started.md) | Running it, and checking it worked |
| [Setup wizard](./docs/guide/setup-wizard.md) | What first-run creates, and how it locks itself |
| [Configuration](./docs/guide/configuration.md) | Every env key, and the two that are easy to get wrong |
| [Docker](./docs/guide/docker.md) | Stacks, images, volumes, networks, hardening |
| [Database & migrations](./docs/guide/database.md) | Authoring and applying schema changes |
| [Architecture](./docs/guide/architecture.md) | Layout, the guard chain, the dual-surface pattern |
| [Security](./docs/guide/security.md) | What is enforced, and what is not implemented |
| [How it works](./docs/logic/auth.md) | Auth, RBAC, tenancy and app settings — the decisions, not the API surface |

`npm run docs:build` fails on dead links, so run it after editing. Keep the
docs in the same change as the code — see
[Maintaining these docs](./docs/guide/docs.md).

## Versioning

Each app follows [Semantic Versioning](https://semver.org/) independently,
tracked in its own `package.json` and `CHANGELOG.md`. Bump whichever app
changed; they don't need to move in lockstep.
