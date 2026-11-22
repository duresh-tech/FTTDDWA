# Architecture

Two applications and one database.

```
console/   Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui
backend/   NestJS 10, Prisma 6, Passport JWT, Zod
postgres   PostgreSQL 17
```

The browser talks to both directly: the console serves HTML and its runtime
config, the API serves everything else including `/uploads`. There is no
reverse proxy and **no server-side data fetching at all** — only six files in
the console are server components, and none of them call the API.

That last fact drives several decisions: it is why the setup gate is
client-side rather than middleware, and why the console can still render when
the backend is down.

## Backend layout

| Path | Holds |
| --- | --- |
| `src/main.ts` | Bootstrap: helmet, cookies, CORS, URI versioning, static `/uploads`, Swagger |
| `src/app.module.ts` | Module registry and the global guard chain |
| `src/common/constants/permissions.ts` | The permission catalogue — 115 keys, 25 modules |
| `src/common/bootstrap/bootstrap.ts` | First-run bootstrap, shared by the wizard and the seed |
| `src/common/guards/` | Throttle, device header, JWT, RBAC |
| `src/config/env.validation.ts` | Boot-time env schema |
| `src/setup/` | The first-run installer API |
| `src/health/` | `GET /system/health` |
| `src/auth/` · `src/tenant-auth/` | The two parallel auth audiences |
| `src/<resource>/` | One module per resource, controller + service + DTOs |
| `prisma/schema.prisma` | 19 models |
| `prisma/migrations/` | Committed migration history |
| `docker/` | Compose stacks and the entrypoint |

### The guard chain

Five global guards, registered in `app.module.ts`, and the order is
load-bearing:

```
DeviceAwareThrottlerGuard → DeviceHeaderGuard → ApiKeyGuard → JwtAuthGuard → PermissionsGuard
```

Plus a global `ZodValidationPipe`.

`DeviceHeaderGuard` requires `x-device-type: website | androidApp | iosApp |
desktopApp` on **every** request — native mobile apps included. It has exactly
one exemption, `@SkipDeviceHeader()`, for Caddy's on-demand TLS check, which
issues a bare GET and cannot set headers. That is why health probes have to
send it — see [Docker](./docker#health-checks).

`ApiKeyGuard` requires an API key on every request and sits **before** the
session guards, so an unknown client is rejected without the cost of resolving
a user and its role permissions. It fails closed, with four exemptions via
`@SkipApiKey()` — see [API keys](./api-keys#exemptions).

`@Public()` skips `JwtAuthGuard` only, and `@SkipApiKey()` skips `ApiKeyGuard`
only. They are **different axes**: a console route needs both a key and a
session, and confusing the two either locks out the console or opens every
route.

### API versioning

`setGlobalPrefix('api')` plus URI versioning from `API_VERSION`, giving
`/api/v1/...`. Swagger sits at `/docs`, **outside** the prefix.

## The dual-surface CRUD pattern

Every tenant-scoped resource is one Prisma model and one shared service,
exposed through two controllers:

- a **system-admin** controller — unrestricted, guarded by
  `@RequirePermissions()`
- a **tenant self-service** controller — scoped to the caller's own mapped
  business via `tenant_mapped_business`, guarded by
  `@RequireTenantPermissions()`

Both share one permission-key namespace. So `tenant-places:create` means the
same thing on either surface, and the service holds the business logic once.

Resources following this pattern: business, mapped business, network
providers, association positions, states, districts, taluks, industries, mail
config, places, streets, and tenant users.

## Console layout

| Path | Holds |
| --- | --- |
| `src/app/setup/` | The first-run wizard |
| `src/app/system/` | Login and the admin dashboard (16 CRUD pages) |
| `src/app/tenant/` | The tenant portal and its settings twins |
| `src/app/runtime-config.js/route.ts` | Publishes runtime config to the browser |
| `src/lib/api.ts` · `tenant-api.ts` | The two namespaced API clients |
| `src/lib/runtime-config.ts` | Lazy config getters |
| `src/hooks/use-session.tsx` · `use-tenant-session.tsx` | The two session providers |
| `src/hooks/use-setup-status.ts` | Drives the setup gate |
| `src/components/resource-table.tsx` | The shared table, pagination and toolbar |
| `src/components/ui/` | 20 shadcn components |

Nearly everything is a client component. There is no form library — the house
pattern is `Dialog` + a plain `<form onSubmit>` + one `useState` object + a
`saving` boolean + a `sonner` toast. The setup wizard follows it exactly, and
adds no dependency.

### Why the API clients are near-duplicates

`api.ts` and `tenant-api.ts` are deliberate clones with their own token key,
CSRF cookie name and refresh path, so a system session and a tenant session
can coexist in one browser without either clobbering the other. See
[Authentication](/logic/auth).

## Request lifecycle

A typical authenticated call:

1. Browser sends `Authorization: Bearer <token>` and `x-device-type: website`
   to `http://localhost:4000/api/v1/...`.
2. `DeviceAwareThrottlerGuard` checks the budget, `DeviceHeaderGuard` the
   header.
3. `ApiKeyGuard` resolves the `x-api-key` header to a key row — one indexed
   lookup on its public prefix, then a constant-time hash comparison. In the
   browser's case the console gateway added that header; the page never had it.
4. `JwtAuthGuard` verifies the token; the JWT strategy re-reads the user's
   role and **re-resolves its permissions from the database**.
5. `PermissionsGuard` compares them against the route's
   `@RequirePermissions()`.
6. `ZodValidationPipe` validates the body.
7. The controller delegates to the service, which uses Prisma.

Step 4 means a permission change takes effect on the next request, with no
re-login — at the cost of one join query per authenticated request. There is
no caching.

## What is deliberately absent

- **No `middleware.ts`** — see [Setup wizard](./setup-wizard#how-visitors-get-redirected-there).
- **No reverse proxy** — the browser reaches each service directly, which is
  why CORS and the browser-facing URL matter.
- **No super-admin bypass** in either permissions guard — see
  [RBAC & permissions](/logic/rbac-permissions).
- **No public registration** — the wizard owns the first account.
