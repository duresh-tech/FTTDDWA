## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when
  graphify-out/graph.json exists. These return a scoped subgraph, usually much
  smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of
  raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when
  query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current
  (AST-only, no API cost).

### Pick the narrowest command

Reaching for `query` first is usually the expensive mistake. In rough order of
cost:

| Want | Use |
| --- | --- |
| What is X, and what touches it | `graphify explain "X"` |
| How do A and B connect | `graphify path "A" "B"` |
| One section of a Markdown doc | `graphify section "docs/guide/docker.md#Volumes"` |
| An open-ended sweep | `graphify query "..."`, narrowed as below |

### `query` truncates, and says so

Its default budget is **2,000 tokens**. On this graph (~2,900 nodes) a bare
question matches hundreds of nodes and prints perhaps 60 of them, with a
`[!] TRUNCATED` line naming the budget that would show them all. **Do not
reflexively raise the budget** — narrow first:

- `--seed <file|symbol>` start from a known place instead of keyword matches
- `--depth 1` immediate neighbours only (default 2)
- `--context <edge-type>` keep one kind of edge, e.g. `call`

Only once it is narrow is `--budget N` worth spending.

### `update` will not shrink the graph

`graphify update .` refuses to write a graph with fewer nodes than the last
one, which is exactly what happens after a change that deletes code — and it
keeps the stale, larger graph instead. After removing a feature, run
`graphify update . --force` (or `GRAPHIFY_FORCE=1`), and sanity-check that the
reported node count went **down**.

`graphify label` renames communities with an LLM and **costs API calls**. It is
optional: `update` warns that community labels are stale without needing it,
and stale labels do not affect `query`, `path` or `explain`.

## Layout

```
backend/        NestJS 10 + Prisma 6 REST API  -> /api/v1  (Swagger: /docs)
backend/docker/ per-service compose stacks (data, services) + entrypoint.sh
console/        Next.js 15 App Router console  -> :3000
docs/           VitePress documentation site
docker-compose.yml   thin aggregator: `include:` of the three stacks
```

`console/` was formerly `frontend/`. Nothing imports it by path, but docs,
compose build contexts and the package name all say `console` — keep them
consistent.

## PostgreSQL only

MySQL is not supported. Do not reintroduce `DATABASE_PROVIDER`, `@db.LongText`
or any other MySQL-only native type, and do not add a "portable schema" note —
the engine is Postgres and the schema says so.

Two consequences that are easy to regress:

- **Case sensitivity.** Postgres compares text case-sensitively; MySQL's
  collation did not. Every `contains:` filter must pass
  `mode: 'insensitive' as const`, and identity lookups (login, uniqueness
  checks) must use insensitive `equals`. The `as const` is required — `mode`
  widens to `string` in a standalone `where` object and Prisma's types reject
  it. Verify with `grep -rc "contains:" src --include=*.service.ts`.
- **Migrations, not `db push`.** Schema changes go through
  `prisma migrate dev`; containers apply committed history with
  `migrate deploy`. `db push` keeps no history for them to apply, and Postgres
  enum changes need a real migration. The `prisma/migrations/` directory must
  be committed or a production container applies nothing.

## RBAC: no super-admin bypass

Authorization is data. Neither `PermissionsGuard` nor `TenantPermissionsGuard`
contains a role-name shortcut, and the JWT strategies re-resolve permissions
from `role_permissions` on every request.

So `SYSTEM_SUPER_ADMIN` works only because it holds all 122
`role_permissions` rows. **Never add a bypass**, and never grant
`visibleToTenants: true` to that role — a tenant user assigned it would hold
every system permission in the tenant portal.

- The permission catalogue lives in `backend/src/common/constants/permissions.ts`,
  and nowhere else. Adding a key means adding it there, using it in a
  decorator, and re-running bootstrap so the row exists.
- First-run bootstrap lives in `backend/src/common/bootstrap/bootstrap.ts`,
  shared by the setup wizard and `prisma/seed.ts`. Change it in one place or
  the two paths drift.
- "Is this instance initialized?" is `systemUser.count() > 0`, never a flag row
  in `app_settings` — that store is editable through the admin UI, so a flag
  there could be deleted to re-open the installer.

## Every request needs an API key

`ApiKeyGuard` is global and **fails closed**. A route with no decorator needs a
valid key; `@SkipApiKey()` is the only exemption and there are exactly four,
each because the caller cannot present one: `system/setup/*`, `system/health`,
`public/site/allowed` (Caddy issues a bare GET) and `public/site/resolve`.

**`@Public()` and `@SkipApiKey()` are different axes.** `@Public()` skips the
system JWT guard only; `@SkipApiKey()` skips the key only. A console route
declares neither. A tenant route declares `@Public()` (so the tenant guard pair
can take over) and still needs a key. Confusing the two either locks out the
console or opens every route.

- **The console's key is issued by the bootstrap, not configured.** It lives in
  `app_settings['console.api_key']`, encrypted, and `GET /system/setup/status`
  serves it back at run time. Do not reintroduce a `CONSOLE_API_KEY` env var or
  a proxy-level header injection: that was two values to keep in step, and it
  needed one mechanism for Docker and another for `npm run dev`.
- `/uploads` is served by `app.useStaticAssets()`, **outside** Nest's guard
  pipeline, so stored files need no key. That is what lets an `<img src>` work.
- Secrets are SHA-256, deliberately not Argon2id: 32 bytes of CSPRNG output has
  no guess space for a slow KDF to protect, and verification runs on every
  request where a slow hash is a CPU-exhaustion lever.
- A key is a **subset of its issuer**, checked on write, and on a business key
  intersected with the owner's current role permissions at verify time.
- `SETTINGS_ENCRYPTION_KEY` is optional and derived from `JWT_ACCESS_SECRET`
  when unset — so a fresh install needs no file edited before the wizard runs.
  Rotating `JWT_ACCESS_SECRET` without setting it makes stored encrypted values
  unreadable; `npm run console-key` reissues the console's.

## There is no public registration

`POST /system/register` was deleted: it was `@Public()`, granted `SUPER_ADMIN`
to the first caller, and never closed. The `/setup` wizard owns the first
account; later ones need `system-users:create`. Do not add an unauthenticated
account-creation route.

## Console configuration is resolved at run time

`next build` inlines every `process.env.NEXT_PUBLIC_*` read into the client
bundle, which would pin a built image to one API URL.

- Read config through the lazy getters in `console/src/lib/runtime-config.ts`.
  **Never** hoist them into module-scope constants — those modules are also
  evaluated during SSR, where `window` does not exist.
- `console/src/app/runtime-config.js/route.ts` must keep
  `export const dynamic = "force-dynamic"`, or Next statically generates it at
  build time and bakes the build-time environment back in.
- The script tag in the root layout must stay `next/script` with
  `strategy="beforeInteractive"`. A bare `<script src>` gets hoisted by React
  19 and may be made `async`, losing the ordering guarantee.
- `APP_API_URL` and `CORS_ORIGINS` are **browser-facing** addresses. A compose
  service name (`http://api:4000`) resolves only container-to-container and
  fails in the browser — as an opaque CORS error, not a log line.

## Docker

- Compose is split by lifecycle: `backend/docker/data/` (postgres) and
  `backend/docker/services/` (api, migrate) are separate stacks, so rebuilding
  the API never touches the database. The root `docker-compose.yml` is a thin
  `include:` aggregator and should stay that way.
- Each leaf service gets its own folder with its `compose.yml` beside any
  config it mounts. Aggregator files hold the group's documentation and the
  `include:` list.
- Config is one `.env` per app (`backend/.env`, `console/.env`), from the
  committed `.example` templates. `POSTGRES_DB` is the single source of the
  database name — the api stack composes `DATABASE_URL` from it.
- Health probes **must** send `x-device-type: website`. `DeviceHeaderGuard` is
  global and has exactly ONE bypass, `@SkipDeviceHeader()`, for Caddy's
  on-demand TLS check (which issues a bare GET and cannot set headers).
  Everything else sends the header, or it gets a 400 and the service looks
  permanently unhealthy. Do not widen that bypass, and never put it on a
  controller class.
- `backend/Dockerfile` keeps `prisma` as a runtime dependency (needed by
  `migrate deploy` after `npm ci --omit=dev`), and creates and `chown`s the
  upload directories **before** dropping to `node` — Docker seeds a named
  volume from the image path and inherits its ownership.
- `console/Dockerfile` must copy `.next/static` separately; standalone output
  excludes it, and omitting the copy gives an unstyled app while the container
  still reports healthy. There is no `public/` directory — do not add a COPY
  for one.
- Never bind-mount the whole `backend/` over `/app` on Windows: the host's
  `argon2` build replaces the Linux one and the container crashes.

## Docs

Keep `docs/` current in the **same change** as the code — see
`docs/guide/docs.md` for the per-change mapping and house style. New pages
must be added to the sidebar in `docs/.vitepress/config.mts`.

`cd docs && npm run docs:build` fails on dead links, so run it after editing.

Compose files carry long header comments deliberately: they are what someone
reads when a stack misbehaves. Keep them in step with the docs.

## Conventions

- UUIDv7 `CHAR(36)` primary keys generated in app code, UNIX-seconds `BIGINT`
  timestamps, soft deletes via a `status` enum plus `deletedAt` — never row
  removal. Helpers in `backend/src/common/utils/id.util.ts`.
- Every tenant-scoped resource is one Prisma model and one service behind two
  controllers: a system-admin surface and a tenant self-service surface scoped
  to the caller's own mapped business, sharing one permission-key namespace.
- Backend validation is Zod via `nestjs-zod` and the global pipe. Env is
  validated at boot in `backend/src/config/env.validation.ts`.
- The console has **no form library**. The house pattern is a plain
  `<form onSubmit>`, one `useState` object, a `saving` boolean and a `sonner`
  toast. Do not add react-hook-form.
- Bump the changed app's `package.json` version and `CHANGELOG.md`; the two
  apps do not move in lockstep.
