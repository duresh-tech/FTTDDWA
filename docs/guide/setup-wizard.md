# Setup wizard

A fresh database has no accounts and no default password. The console's
`/setup` route creates the first administrator in the browser, and closes
itself permanently afterwards.

## Why it exists

The project used to ship a seed script with a published password
(`admin` / `Admin@12345`) and a `@Public()` register endpoint that granted
`SUPER_ADMIN` to whoever signed up first. That endpoint stayed open forever —
an installer with no lock on it. Both are gone; the wizard owns bootstrapping,
and further accounts need `system-users:create`.

## The five steps

| Step | What it collects |
| --- | --- |
| Welcome | Nothing. Shows whether the API and database are reachable. |
| Administrator | `fName`, `username`, `email`, `password` + confirmation |
| Branding | Application name, and an optional logo |
| Options | Whether to also create a tenant-visible role |
| Review | A read-only summary, then one request |

Everything is collected client-side and submitted as a **single** request at
the end, so a failure can never leave a half-initialized instance.

## What initializing creates

`POST /api/v1/system/setup/initialize` runs one transaction:

1. Re-checks that no system user exists (closing the race between two
   concurrent calls).
2. Inserts all **122 permissions** across 26 modules, in one statement.
3. Creates **`SYSTEM_SUPER_ADMIN`** (`isSystem: true`,
   `visibleToTenants: false`) and grants it every permission.
4. Optionally creates `TENANT_ADMIN` (`visibleToTenants: true`) with the
   60 tenant-portal keys.
5. Creates the administrator, with the username and email **lowercased**.
6. Writes `app.name`, `app.logo_path` (only if a logo was uploaded) and
   `app.setup_completed_at`.
7. Issues the **console's own API key** and stores it encrypted in
   `console.api_key`.

Step 7 is in the same transaction as the rest for a reason: every API route
requires a key, so an instance with an administrator but no console key would
sign in and then fail on everything. `GET /system/setup/status` serves the key
back to the console at run time — there is nothing to configure, and nothing to
keep in step between two files. See [API keys](./api-keys#the-console-s-key).

The password is hashed with argon2id *before* the transaction opens — argon2
can take around a second on a CPU-limited container, which is long enough to
threaten the transaction timeout.

The same code runs for both entry points
(`backend/src/common/bootstrap/bootstrap.ts`), so a wizard-initialized
instance and a seeded one are equivalent. See
[RBAC & permissions](/logic/rbac-permissions).

## How it locks itself

"Initialized" means **`systemUser.count() > 0`** — not a flag row.

A boolean in the App Settings store would be editable and deletable through
the admin UI (`app-settings:update` and `:delete` both exist), so an
administrator could delete it and re-open the installer. A user count cannot
be forged. `app.setup_completed_at` is written for the audit record only and
is never read for gating.

Both write endpoints check this first and return **409** once it is true.

## The endpoints

| Endpoint | Throttle | Notes |
| --- | --- | --- |
| `GET /api/v1/system/setup/status` | 60/min | `{ initialized, appName, logoPath }`. Generous, because the console polls it. |
| `POST /api/v1/system/setup/logo` | 5/min | Multipart. Images only, 5 MB max. |
| `POST /api/v1/system/setup/initialize` | 5/min | `201`, or `409` once initialized. |

All three are `@Public()` — by definition no account exists yet — and all are
permanently `409` afterwards.

### The logo, and why it has its own endpoint

Uploads normally require authentication, which the wizard cannot provide. A
dedicated public endpoint is bounded to first-run and reuses the same 5 MB and
`image/*` checks as App Settings.

The returned path is pattern-pinned in the DTO to
`^app_settings_uploads/[A-Za-z0-9-]+\.(png|jpe?g|svg|webp)$`. Without that, a
caller could write an arbitrary path into the `app.logo_path` setting.

The residual risk is an upload the user then abandons, leaving an orphan file —
capped by the size limit and the throttle, and only possible before
initialization.

::: tip The old seed hardcoded a logo path
It pointed at a file inside the gitignored uploads directory, so every fresh
clone or volume started with a broken image. The wizard writes
`app.logo_path` only when a logo was actually uploaded, and the UI already
handles a null logo.
:::

## How visitors get redirected there

Client-side, in five places — there is no `middleware.ts`:

- `src/hooks/use-session.tsx` and `use-tenant-session.tsx`, in the guard
  effect they already run
- `src/app/system/login/page.tsx` and `src/app/tenant/login/page.tsx`, on mount
- `src/app/setup/page.tsx` itself, which redirects *away* once initialized

`src/hooks/use-setup-status.ts` caches the lookup in a module-level promise, so
all of them share one request.

**Only a definite `false` redirects.** While the status is unknown — still
loading, or the call failed — nothing happens. Redirecting on unknown would
eject signed-in users into the installer whenever the backend hiccuped.

Middleware would have been the stricter option, but it would need a separate
server-reachable internal API URL and a round trip per navigation. This app
has no server-side data fetching at all, so that would make the console unable
to render whenever the backend was down.

## Seeding instead

For a scripted instance, `npm run seed` does the same thing through the same
shared code:

```bash
docker compose --profile setup run --rm --entrypoint node migrate dist/prisma/seed
```

It defaults to `admin` / `admin@system.local` / `Admin@12345` and is a no-op
once any system user exists. Override with `SEED_ADMIN_NAME`,
`SEED_ADMIN_USERNAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
`SEED_APP_NAME` and `SEED_TENANT_ROLE`.

Use the wizard in production — the seed's defaults are public knowledge.

## If you skip the tenant role

Only `SYSTEM_SUPER_ADMIN` is created, and it is deliberately **not**
tenant-visible. `TenantUsersService` rejects any role with
`visibleToTenants: false` and lists assignable roles as
`{ visibleToTenants: true }`, so with no such role **no tenant user can be
created** and the whole `/tenant` tree is unreachable.

Create one under **Roles** with "visible to tenants" enabled, or tick the box
in the wizard.

::: danger Never make SYSTEM_SUPER_ADMIN tenant-visible
A tenant user assigned it would sign into the tenant portal holding all 122
system-level permissions.
:::
