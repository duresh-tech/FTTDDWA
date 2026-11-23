# API keys

Every request to the API needs an API key, including the console's own. The
key says **which application** is calling; a JWT says **which person**.

```
x-api-key: fttddwa_live_9f3a1c72.T7mQ…
```

or, equivalently:

```
Authorization: Bearer fttddwa_live_9f3a1c72.T7mQ…
```

The guard **fails closed**: a route without a key is refused, not allowed. Four
routes are exempt, each because the caller cannot present one — see
[Exemptions](#exemptions).

## The console's key

**There is nothing to configure.** The setup wizard issues the console's key
and the console fetches it at run time:

```
wizard ──issues──▶ api_keys row  +  app_settings['console.api_key'] (encrypted)
                                               │
console ──GET /system/setup/status─────────────┘
        └──▶ every call carries  x-api-key: fttddwa_live_a1b2c3d4.<secret>
```

No env var, nothing to keep in step between two files, and a reissued key is
picked up on the next page load without a rebuild. The same mechanism serves
Docker and `npm run dev`, so there is one code path rather than a proxy-shaped
one and a dev-shaped one.

::: tip Why it is served unauthenticated
The console is a public web app and cannot hold a secret the browser does not
see. A key states which **application** is calling, not who the user is —
every console route still requires a session and the permissions behind it, so
holding this key grants nothing on its own.

The row is encrypted at rest all the same, because `app_settings` is readable
by anything that can read the database, and it is excluded from the App
Settings UI so it cannot be edited into uselessness.
:::

`/uploads/` needs no key at all: stored files are served by
`app.useStaticAssets()`, which mounts on the Express adapter **outside** Nest's
guard pipeline. That is what lets an `<img src>` work, since it cannot send a
header.

### Reissuing it

```bash
docker compose exec api node dist/prisma/console-key.js   # in Docker
npm run console-key                                       # host development
```

Needed in three cases, all of which show up as `consoleApiKey: null` and a
console that answers "Provide an API key" on every call:

- the instance predates the key requirement (`npm run seed` also fixes this)
- the console key was revoked, suspended or allowed to expire under API Keys
- `SETTINGS_ENCRYPTION_KEY` changed, so the stored token no longer decrypts

Earlier console keys are left alone; revoke them under API Keys if you want
them gone. The console uses the newest one from its next load.

The console key is an ordinary row, so it **can** be revoked through the UI —
it is listed as *System Console*. Doing so locks the console out until you
reissue, which is why the command above exists.

## Issuing a key

System → API Keys → **Issue Key**, or `POST /api/v1/system/api-keys`. A
business can issue its own under Settings → API Keys.

The secret is shown **once**, in a dialog that will not close until you have
copied it or confirmed you stored it. Only a SHA-256 hash is kept, so a lost
key is rotated, not recovered.

| Field | Notes |
| --- | --- |
| Type | `TEST` or `LIVE`. Baked into the prefix, so it cannot change later |
| Business | Empty for a platform key. A business key is confined to that business's data, from the key itself rather than from a request parameter |
| Expires on | Empty means never. A bounded life is the safer default |
| Scopes | See below. None is normal |

### Why SHA-256 and not Argon2id

Passwords use Argon2id here; API secrets deliberately do not. The secret is 32
bytes of CSPRNG output, so there is no low-entropy guess space for a slow KDF
to protect — and verification runs on **every** request, where a deliberately
slow hash would let anyone exhaust the CPU by posting garbage keys.

## Scopes

A scope is an ordinary permission key, `tenant-places:create`. Two rules hold
at all times:

1. **A key never exceeds its issuer.** The server refuses to grant a scope the
   caller does not hold, so the key form only offers your own permissions.
2. **A key never outranks its owner, later either.** On a business key the
   stored scopes are intersected with the owning role's *current* permissions
   at verify time. Revoke a permission from the role and every key that leaned
   on it narrows on the **next request** — no stale credential keeps a scope its
   owner has lost.

A key with **no scopes** is useful and normal. Scopes are only consulted on
routes that declare `@RequireApiScopes(...)`; on a console route the key
authenticates the application and the signed-in user's RBAC still decides what
may happen. The console's own key has none for exactly that reason.

### Scope templates

System → API Key Scope Templates. A named bundle — "Reporting client" — so
nobody assembles a credential out of 144 checkboxes.

A template is a **shortcut at creation time, not a live link**: editing or
removing one never changes a key already issued from it. That is what makes it
safe to re-word the catalogue.

Mark a template *offered in the tenant portal* and businesses can choose it.
Tenants read templates but cannot write them, which is what lets you publish
"Billing export" as a choice without also publishing every permission in the
system as a checkbox. A template a tenant's role cannot fully grant is shown
**disabled, with the reason**, rather than hidden — an option that quietly
vanishes leaves someone wondering why a colleague can see it.

## Status and expiry

`ACTIVE`, `SUSPENDED`, `REVOKED`. There is deliberately no `EXPIRED` member:
expiry is a function of `expiresAt` and the clock, and storing it as well would
give two sources of truth that drift. The API derives `isExpired` in every
response.

**Revoking is terminal.** It scrubs the stored hash to an empty string, so the
row cannot authenticate again even if some future query forgets to check the
status.

`lastUsedAt`, `lastUsedIp` and `usageCount` are written fire-and-forget and at
most **once a minute per key**: writing on every request would turn a read path
into a write path and make a busy key a row-lock hotspot.

::: warning usageCount is sampled, not counted
It increments at most once a minute, so it is a liveness signal — "this key is
in use, from this address" — and not a request count. Do not bill on it.
:::

## The guard chain

```
DeviceAwareThrottlerGuard → DeviceHeaderGuard → ApiKeyGuard → JwtAuthGuard → PermissionsGuard
```

`ApiKeyGuard` sits before the session guards on purpose: an unknown client is
rejected without the cost of resolving a user and its role permissions.

::: danger `@Public()` and `@SkipApiKey()` are different axes
`@Public()` skips **the JWT only**. `@SkipApiKey()` skips **the key only**. Two
metadata keys, two guards.

- A console route is key **+** JWT **+** RBAC — it declares neither.
- A tenant route is `@Public()` (to turn off the *system* JWT guard so the
  tenant guard pair can take over) and still needs a key.
- A machine route is `@Public()` **+** `@RequireApiScopes(...)`.

Confusing the two either locks out the console or opens every route.
:::

### Exemptions

Four, and no more:

| Route | Why |
| --- | --- |
| `system/setup/*` | Bootstrap: the instance has no rows yet, so no key can exist |
| `system/health` | The probe runs before anything is configured, and a container healthcheck has nowhere to read a key from |
| `public/site/allowed` | Caddy's on-demand TLS check is a bare GET that cannot set headers at all |
| `public/site/resolve` | The console's root page calls it before the gateway is necessarily in front of it |

Each of those fails in a way that looks like something else if the exemption is
missing — the Caddy ask shows up as `ERR_SSL_PROTOCOL_ERROR`, with nothing in
the browser to go on.

## Using a key from an application

```bash
curl -s https://app.example.com/api/v1/tenant/places \
  -H 'x-api-key: fttddwa_live_9f3a1c72.T7mQ…' \
  -H 'x-device-type: androidApp' \
  -H 'Authorization: Bearer <the user's JWT>'
```

Both headers: `x-device-type` is required on every request
([the guard chain](./architecture#the-guard-chain)), and the key does not
replace signing in.
A key with scopes can stand alone only on routes that declare
`@RequireApiScopes(...)`.

When both are sent as `Authorization: Bearer`, the API tells them apart by the
`fttddwa_` prefix — so a JWT in that header is never mistaken for a malformed key.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Every console request 401s with "Provide an API key" | There is no usable console key. Check `GET /system/setup/status` for `consoleApiKey: null`, then reissue |
| …and `consoleApiKey` is null right after changing `JWT_ACCESS_SECRET` | The derived encryption key moved with it, so the stored token no longer decrypts. Reissue, and set `SETTINGS_ENCRYPTION_KEY` explicitly |
| "Invalid API key" | Wrong secret, or the row was revoked — the message is deliberately the same for both, so it cannot be used to discover which prefixes are real |
| "This API key is missing the scope: …" | The key authenticated, but lacks a scope the route requires — or its owner's role has since lost it |
| "You cannot grant a key permissions you do not hold yourself" | Expected: a key is always a subset of its issuer |
| "SETTINGS_ENCRYPTION_KEY must be exactly 64 hex characters" | It is set but malformed. Either fix it or unset it to use the derived fallback |

## See also

- [Security](./security) — the guard chain in full
- [Configuration](./configuration) — `SETTINGS_ENCRYPTION_KEY` and its neighbours
- [RBAC & permissions](/logic/rbac-permissions) — where scopes come from
