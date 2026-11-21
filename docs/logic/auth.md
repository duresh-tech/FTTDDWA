# Authentication

Two audiences sign in on their own paths, with their own token types. The
design goal is that a tenant session and a system-admin session can coexist in
the same browser, and neither can ever pass for the other.

## Two parallel stacks

| | System | Tenant |
| --- | --- | --- |
| Login | `POST /api/v1/system/login` | `POST /api/v1/tenant/login` |
| Identity | `GET /system/me` | `GET /tenant/me` |
| Table | `system_users` | `tenant_users` |
| Refresh tokens | `refresh_tokens` | `tenant_refresh_tokens` |
| JWT strategy | `src/auth/strategies/jwt.strategy.ts` | `src/tenant-auth/strategies/tenant-jwt.strategy.ts` |
| Permission decorator | `@RequirePermissions()` | `@RequireTenantPermissions()` |
| Guard | `PermissionsGuard` (global) | `TenantPermissionsGuard` (per controller) |
| Client | `src/lib/api.ts` | `src/lib/tenant-api.ts` |
| Token key | `stream_system.accessToken` | `stream_tenant.accessToken` |
| CSRF cookie | `csrf_token` | `tenant_csrf_token` |

The duplication is the point. The two permission decorators use **distinct
metadata keys**, so the global system `PermissionsGuard` never evaluates a
tenant route's requirements and vice versa. If they shared a key, a tenant
token carrying `tenant-places:create` could satisfy a system route that
happened to require the same string.

## Tokens

- **Access token** — a JWT, 15 minutes by default, sent as
  `Authorization: Bearer`. Held in `localStorage` (namespaced by
  `src/lib/storage.ts` with a `stream_` prefix).
- **Refresh token** — an httpOnly cookie, 7 days, **rotated on every use**.
  Only a SHA-256 hash is stored, so a database leak does not yield usable
  tokens. Scoped to `path=/api/v1/system` (or the tenant equivalent), so it is
  never sent to unrelated routes.

### Why the access token is in localStorage

It is readable by any script on the origin, which is the trade-off. The
mitigation is that it is short-lived and that the *refresh* token — the
long-lived credential — is httpOnly and therefore not script-readable. An XSS
foothold can use the current access token for up to 15 minutes but cannot
exfiltrate a durable session.

## CSRF

Cookie-based endpoints (refresh, logout) use double-submit: a **readable**
`csrf_token` cookie, echoed back in an `x-csrf-token` header. An attacker's
cross-site request carries the cookie automatically but cannot read it to set
the header.

This is why the CSRF cookie is deliberately *not* httpOnly, while the refresh
token is.

## Refresh, once

`api()` retries exactly once on a 401:

1. A request returns 401, and the call had `auth: true, retryOn401: true`.
2. `tryRefresh()` posts to `/system/refresh` with the CSRF header.
3. On success it stores the new access token and replays the original request
   with `retryOn401: false`.
4. On failure it clears the token and hard-navigates to `/system/login`.

That final hard redirect is why anything unauthenticated **must** pass
`auth: false` — the setup wizard does, or a 401 would eject the user
mid-install. See [Setup wizard](/guide/setup-wizard).

## Permissions are resolved per request

The JWT strategies do not trust permissions from the token. On every
authenticated request they re-read the user, their role and its
`role_permissions`, filtered to `status === 'ACTIVE'`:

```ts
const permissions = user.role.rolePermissions
  .filter((rp) => rp.permission.status === 'ACTIVE')
  .map((rp) => rp.permission.permissionKey);
```

Granting or revoking a permission therefore takes effect on the **next
request**, with no re-login and no cache to invalidate. The cost is one join
query per authenticated request, uncached.

A revoked permission also cannot survive in a still-valid token — which it
would if permissions were a JWT claim.

## Case-insensitive sign-in

The login lookup matches username **or** email, case-insensitively:

```ts
OR: [
  { username: { equals: dto.username, mode: 'insensitive' } },
  { email: { equals: dto.username, mode: 'insensitive' } },
]
```

MySQL's collation did this implicitly; Postgres does not. Without
`mode: 'insensitive'`, someone who registered as `admin` could not sign in by
typing `Admin`. The uniqueness checks match the same way, so the two cannot
become separate accounts, and bootstrap lowercases the stored values. See
[Database](/guide/database#case-sensitivity).

## "Login as" a tenant user

A system administrator holding `tenant-users:login-as` can obtain a tenant
session for any tenant user. It issues a genuine tenant token through the
tenant audience rather than special-casing a system token — so every tenant
route still sees an ordinary tenant principal, and nothing downstream needs to
know about impersonation.

## No public registration

`POST /system/register` is gone. It was `@Public()`, granted `SUPER_ADMIN` to
the first user to call it, and never closed. The
[setup wizard](/guide/setup-wizard) owns the first account; later ones need
`system-users:create` at `POST /api/v1/system/users`.

## Client-side guarding

Both session providers run one effect on mount: check for a token, call
`/system/me` (or `/tenant/me`), and redirect to the login page on failure.
They render a full-page skeleton while loading.

The setup gate hooks into that same effect — see
[Setup wizard](/guide/setup-wizard#how-visitors-get-redirected-there).

This is UX, not enforcement. Every route is independently guarded server-side;
the client guard only avoids showing a shell that would fail every request.
