# Security

## Authentication and sessions

- **Argon2id** password hashing throughout.
- **Access tokens** are short-lived JWTs (15 minutes by default) sent as
  `Authorization: Bearer`.
- **Refresh tokens** are httpOnly cookies, rotated on use, with only a
  SHA-256 hash stored in `refresh_tokens`. Scoped to
  `path=/api/v1/system` (and the tenant equivalent).
- **CSRF** uses double-submit: a readable `csrf_token` cookie plus an
  `x-csrf-token` header, required on the cookie-based refresh and logout
  endpoints.
- Cookies are `sameSite=strict` with no explicit domain. See
  [Configuration](./configuration#cookies-and-deployment-domains) for the
  domain constraint this imposes in production.
- Login verifies against a dummy hash for unknown users, so the response time
  does not reveal whether an account exists.

Two fully separate audiences — system and tenant — each with their own JWT
strategy, refresh-token table and cookie names, so one session can never pass
for the other. See [Authentication](/logic/auth).

## Authorization

Permissions are **data**, not role checks: 115 keys resolved from
`role_permissions` on every request.

There is **no super-admin bypass** in either guard. Nothing anywhere reads
"is this user an admin?" — so `SYSTEM_SUPER_ADMIN` only works because it
genuinely holds all 115 grants, and a role with 114 of them is exactly one
permission short. See [RBAC & permissions](/logic/rbac-permissions).

The console gates its own UI on the same keys, but that mirrors the backend
rather than replacing it — the API is the only authority.

### API keys authenticate the application

A separate axis from RBAC. Every request needs an API key, and the guard
**fails closed**, with four exemptions for callers that cannot present one.
The console has one of its own, issued by the setup wizard and served back to
it at run time, so there is nothing to configure.

Two decorators, two guards, and they are easy to confuse:

| Decorator | Skips | Does not skip |
| --- | --- | --- |
| `@Public()` | the system JWT guard | the API key, or a tenant guard added with `@UseGuards` |
| `@SkipApiKey()` | the API key | the JWT, or RBAC |

A key is always a **subset of its issuer**, and on a business key the stored
scopes are intersected with the owning role's *current* permissions at verify
time — so revoking a permission from a role narrows every key that leaned on it
on the next request, rather than leaving a stale credential holding a scope its
owner has lost.

Secrets are stored as SHA-256 only, never recoverable, and revoking scrubs the
hash outright. Full detail in [API keys](./api-keys).

## No public registration

The old `@Public() POST /system/register` endpoint granted `SUPER_ADMIN` to
whoever registered first, and stayed open forever. It has been **deleted**,
along with its DTO, service method and console page.

The [setup wizard](./setup-wizard) creates the first administrator and then
returns `409` permanently. Every account after that needs
`system-users:create`.

The installer's lock is `systemUser.count() > 0`, deliberately not a flag row
in the App Settings store — that store is editable through the admin UI, so a
flag there could be deleted to re-open the installer.

## Input handling

- **Zod** validates every request body through a global pipe, and the schemas
  surface in Swagger.
- **Prisma** parameterizes every query. There is no raw SQL outside the health
  check's `SELECT 1`.
- The setup wizard's `logoPath` is **pattern-pinned** to the upload folder and
  filename shape. Since `initialize` is public, an unconstrained string would
  let a caller write an arbitrary path into the `app.logo_path` setting.
- Uploads check size (5 MB) and `image/*` MIME type where images are expected,
  and `StorageService` strips unsafe characters from the folder name.

## Rate limiting

| Scope | Limit |
| --- | --- |
| Global | `THROTTLE_LIMIT` per `THROTTLE_TTL_MS` (100/min) |
| Login | 5/min |
| `setup/initialize`, `setup/logo` | 5/min |
| `setup/status` | 60/min (the console polls it) |
| `system/health` | 120/min (probes poll harder than people) |

::: warning In-memory store
`ThrottlerGuard` uses the default in-memory store, so limits are per-container
and reset on restart. Behind a reverse proxy, correct client IPs also need
Express `trust proxy`. Both matter before scaling past one API replica.
:::

## Transport and headers

- **helmet** security headers; `x-powered-by` disabled.
  `crossOriginResourcePolicy` is relaxed to `cross-origin` so the console can
  load `/uploads` images from the API's origin.
- **CORS** restricted to `CORS_ORIGINS`. An empty value used to leave
  `origin: false`, silently rejecting every cross-origin browser request —
  boot validation now refuses to start without it.
- The console sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` and a
  `Permissions-Policy` denying camera, microphone and geolocation.
- Every request must carry `x-device-type`, enforced globally.

::: tip Not configured
There is no Content-Security-Policy on the console and no HSTS. Both are
worth adding behind a real domain; CSP needs care because the
`/runtime-config.js` script and Leaflet's inline styles need allowances.
:::

## Configuration safety

`src/config/env.validation.ts` fails the boot rather than the request. With
`APP_ENV=production` it additionally:

- rejects the example placeholder JWT secrets
- requires the access and refresh secrets to differ
- requires `COOKIE_SECURE=true`

Secrets live only in the gitignored `backend/.env` and `console/.env`; the
`.dockerignore` files exclude `.env*` so nothing is baked into an image layer.
Generate secrets with `openssl rand -hex 32`.

## Container posture

Every service runs with `no-new-privileges`, `cap_drop: ALL`, a `read_only`
root filesystem, explicit resource limits, and as a non-root user. Postgres is
never published beyond `127.0.0.1`, and the `fttddwa-data` network is
`internal: true` — no route to the internet through it.

See [Docker](./docker#hardening).

## Not implemented

Worth knowing before a security review:

- **No account lockout** and no failed-login throttle beyond the 5/min
  IP-based one. A distributed attacker gets unlimited attempts per IP per
  minute.
- **No auth audit trail** — who signed in, from where, successfully or not.
- **No password rotation, history or breach checks.** The policy is 8
  characters with an uppercase, a lowercase and a digit.
- **No 2FA.**
- **No CSP or HSTS** (above).
