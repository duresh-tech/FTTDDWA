# App settings & branding

A generic typed key-value store backs app-wide configuration that belongs in
the database rather than in an env file.

## The model

```prisma
model AppSetting {
  id          String             @id @db.Char(36)
  key         String             @unique @db.VarChar(150)
  dataType    AppSettingDataType
  value       String             @db.Text
  description String?            @db.VarChar(255)
  status      AppSettingStatus   @default(ACTIVE)
  createdAt   BigInt
  updatedAt   BigInt
  deletedAt   BigInt?
}

enum AppSettingDataType {
  STRING TEXT INTEGER DECIMAL BOOLEAN JSON DATE DATETIME TIME FILE
}
```

`value` is always a string column; `dataType` says how to interpret it, and
`validateValueForDataType()` in `src/app-settings/dto/app-settings.dto.ts`
enforces that on write. `FILE` holds an uploaded file's storage path.

This replaced a fixed-shape branding singleton, so adding a new app-wide
setting no longer needs a migration.

::: tip `@db.Text`, not `@db.LongText`
`LongText` is MySQL-only and was the single type that blocked the Postgres
switch.
:::

## Keys written at bootstrap

| Key | Type | Written when |
| --- | --- | --- |
| `app.name` | `STRING` | always |
| `app.logo_path` | `STRING` | only if a logo was uploaded |
| `app.setup_completed_at` | `STRING` | always (audit only) |

### Why the logo path is conditional

The old seed hardcoded
`app-settings/019f3d95-8bce-704a-aa81-4e4c2149e733.png` — a real file, but one
inside the gitignored uploads directory. Every fresh clone or empty volume
therefore started with a dangling reference and a broken image. The wizard
writes the key only when a logo actually exists, and the UI already handles a
null logo.

### Why `setup_completed_at` is not the installer's lock

It is written for the audit record and **never read for gating**.

The installer locks on `systemUser.count() > 0` instead, because this store is
editable through the admin UI — `app-settings:update` and
`app-settings:delete` both exist, so an administrator could delete a flag row
here and re-open the installer. A user count cannot be forged. See
[Setup wizard](/guide/setup-wizard#how-it-locks-itself).

## Public branding

`GET /api/v1/system/app-settings/public/branding` is the one unauthenticated
read of configuration, returning `{ appName, logoPath }`. The login pages and
both shells use it, so branding appears before anyone signs in.

```ts
appName: nameRow?.value?.trim() || this.config.get('APP_NAME', DEFAULT_APP_NAME)
```

**The database row wins, with the env var as the fallback.**

This was previously the other way round. The method returned
`config.get('APP_NAME')` unconditionally and ignored the row entirely, with a
comment explaining that branding was deployment-level. The consequence was
that `app.name` was *write-only*: the App Settings page would save a new name
and nothing would ever display it.

That mattered the moment the setup wizard started collecting an application
name — the wizard would have appeared to work and changed nothing. Both sides
were corrected together:

- the backend now prefers the row
- `src/hooks/use-app-settings.ts` had its precedence inverted to match
- the four visible brand sites read `useAppSettings().appName` instead of a
  build-time constant, and `src/lib/app-name.ts` was deleted

`APP_NAME` now supplies only the fallback and the initial browser tab title
(through `generateMetadata()` in the root layout, which is async so it reads
the live value per request rather than baking one at build time).

## Reading settings in the console

`useAppSettings()` fetches once per page load and shares the result through a
module-level promise and `useSyncExternalStore`, so several components asking
for the app name produce one request.

It returns the runtime fallback immediately and re-renders when the fetch
lands. That is deliberate: the alternative — blocking render on the API —
would mean the console cannot paint when the backend is down.

Because the server-rendered HTML therefore contains the fallback and the
client re-renders with the DB value, this is the same pattern already used for
`logoPath` and introduces no new hydration mismatch class.

## Uploads

`POST /system/app-settings/upload` stores a file for a `FILE`-typed setting
(or the logo) and returns its **path**, which the caller sets as the value.
Limits: 5 MB, `image/*` for the logo. Files land in `app_settings_uploads/`.

Only the relative path is ever stored — never a URL. Resolving it is the
consumer's job: the console uses `uploadUrl(path)` from
`src/lib/runtime-config.ts`, which derives the origin by stripping `/api/vN`
from the configured API URL.

That keeps the storage driver swappable. Moving to S3 changes where files live
without rewriting a single stored value.

The [setup wizard](/guide/setup-wizard#the-logo-and-why-it-has-its-own-endpoint)
has its own public upload endpoint, because the authenticated one is
unreachable before an account exists.
