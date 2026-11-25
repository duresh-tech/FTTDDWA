# Mobile clients

Everything a native app has to do to talk to this API, and the one thing about
it that is not obvious.

The reference implementation is [`member-app/`](../logic/member-portal#the-native-app),
a Flutter app for members. Nothing here is Flutter-specific.

## The entry point

```
https://<association-domain>/api/v1
```

The same address a browser uses, spelled absolutely. There is no separate API
hostname and no mobile-only gateway: the console's nginx gateway serves the
console and forwards `/api` and `/uploads` to the API, so a native client and
the browser hit one origin. See [Tenant domains](./domains).

## Every request needs three headers

| Header | Value | Why |
| --- | --- | --- |
| `x-device-type` | `androidApp` or `iosApp` | `DeviceHeaderGuard`, global |
| `x-api-key` | the app's key | `ApiKeyGuard`, global, fails closed |
| `Origin` | `https://<association-domain>` | which association this is |

### `x-device-type`

`src/common/guards/device-header.guard.ts` accepts exactly four values:

```
website | androidApp | iosApp | desktopApp
```

They are checked with `Array.includes` and no normalisation, so they are
**case-sensitive**. `android`, `ios` and `mobile` all return 400 with the
allowed list in the message. There is one exemption in the whole codebase,
`@SkipDeviceHeader()` on `public/site/allowed`, for Caddy's TLS check.

An app device type also raises the **global** throttle from `THROTTLE_LIMIT`
(100/min) to `THROTTLE_LIMIT_APP` (1000/min), via
`DeviceAwareThrottlerGuard`. Per-route limits are not widened: login, apply
and password stay at 5/min.

### `x-api-key`

Not `Authorization: Bearer` — the member's JWT occupies that header, and the
guard only reads a key from there when the value starts with `fttddwa_`.

Four controllers are exempt via `@SkipApiKey()`, so in member terms:

| Routes | Key needed? |
| --- | --- |
| `public/member/*` | no |
| `public/site/*`, `system/setup/*`, `system/health` | no |
| `member/auth/*`, `member/id-card*` | **yes**, including login |

See [API keys](./api-keys) for issuing one.

::: warning Give the app its own key
Do not ship `console.api_key`. A key states which *application* is calling, so
a shared one makes the app and the console indistinguishable — and revoking
the mobile key would lock out the console too.
:::

## The part that is not obvious: `Origin`

**The API resolves which association a request belongs to from the hostname.**
There is no business id in any request body, deliberately — one in the body
would let anyone file against any association. A mobile app has no hostname of
its own, so this looks like a dead end.

It is not, because `SiteService.hostOf` in `src/site/site.service.ts` reads
three sources in order:

```ts
const origin = req.headers.origin;                 // 1
if (origin && origin !== 'null') return normalizeHost(origin);
const forwarded = req.headers['x-forwarded-host']; // 2
…
return normalizeHost(req.hostname);                // 3
```

So a native client sends `Origin: https://<association-domain>` and resolution
works unchanged. The scheme and any port are stripped server-side, so the
header does not have to match how the API is actually reached — which is what
makes development against `10.0.2.2` or a tunnel work.

The value must match a `tenant_business_domains.hostname` row exactly, and that
business must be ACTIVE with the domain enabled.

::: tip CORS is not in the way
CORS is a browser mechanism. The `cors` middleware does not reject a
non-matching origin, it only omits the `Access-Control-Allow-*` response
headers — which a native HTTP client ignores. So the `Origin` above works
whether or not it appears in `CORS_ORIGINS`, and `x-api-key` works despite not
being in `allowedHeaders`. That list constrains browsers only.
:::

### Which routes need it

Only the **host-resolving** ones: `member/auth/login` and all of
`public/member/*`. Everything else reads the business out of the JWT. Sending
it everywhere is harmless.

### When it is wrong

Every host-resolving route answers:

```
404 This address does not serve a member portal
```

In an app that almost always means the configured domain is wrong, not that the
member mistyped something. Worth saying so in the UI.

::: danger Flutter web, and browsers generally, cannot do this
In a browser the `Origin` header is set by the browser and cannot be
overridden. A web build can therefore only ever address the association it is
served from. Native targets only.
:::

## Sessions

Members are a third authentication surface beside system and tenant users —
see [Authentication](../logic/auth) and
[The member portal](../logic/member-portal).

- **Login** takes `{ memberIdNumber, password }`. The membership number, not an
  email, and it is unique per association rather than globally — which is the
  other reason login needs `Origin`.
- **The response** is `{ member, accessToken, refreshToken, csrfToken }`. There
  is **no `expiresIn`**: decode the JWT `exp`, or just refresh reactively on
  the first 401.
- **Refresh rotates.** `POST member/auth/refresh` revokes the token presented
  as it issues the new one, so the client must store what comes back. A second
  concurrent refresh presents a token the first just revoked.
- **`csrfToken` can be discarded.** The CSRF guards are not global — they sit
  on four staff handlers — and member routes set no cookies, so there is
  nothing for one to protect.
- **Logout** with the refresh token revokes that session; omitting it revokes
  **every** session the member has.
- **A password change revokes every refresh token.** Force a re-login after
  one.

## Wire format

- Timestamps (`issuedAt`, `expiryAt`, `createdAt`, `submittedAt`) are **UNIX
  seconds as JSON numbers** — `main.ts` patches `BigInt.prototype.toJSON`.
- `dateOfBirth` and `weddingDate` are **`YYYY-MM-DD` strings**, not epochs, and
  are validated against both a pattern and a real-date parse.
- Errors are `{ statusCode, message }`, or, from the global Zod pipe,
  `{ statusCode: 400, message: 'Validation failed', errors: [{ path, message }] }`.
  Flatten `errors` with its `path` — "email: Invalid email" is actionable where
  "Validation failed" is not.
- `POST` returns **201**, Nest's default. Treat any 2xx as success.
- `GET member/id-card` answers **200 with a literal `null`** when no card has
  been issued. That is a legitimate result, not an error.

### Two field names that bite

| Where | Expected | Actual |
| --- | --- | --- |
| `public/member/options` → `rtos[]` | `districtId` | **`tenantDistrictId`** |
| `member/auth/me` | `position` | **`associationPosition`** |

Every other lookup in `options` names its parent with the short form, so
cascading RTOs off `districtId` yields a silently empty picker rather than an
error.

### `isMarried` must be a real boolean

The schema is `z.coerce.boolean()`, under which the **string** `"false"` is
truthy. A stringified value marks every applicant married.

## Files

`/uploads/<path>` is served by `app.useStaticAssets()`, **outside** Nest's
guard pipeline: no key, no token, no device header. That is what lets a plain
image request work for a logo or a passport photo. The base is the API URL
minus its `/api/vN` suffix.

The ID card PDF is the opposite — `member/id-card/download` is a guarded
stream, so it needs the token and the key like any other request, and it cannot
be fetched as a bare URL.

## What is not available

- **No public file upload.** `system/uploads` and `tenant/uploads` are both
  behind staff guards, so a public applicant cannot send a passport photo. Staff
  attach one at approval.
- **No member self-service edits.** There is no endpoint for a member to change
  their own record.
- **No public business directory.** Nothing lists associations or their domains,
  so an app cannot offer a picker — it is configured with one domain. That is
  deliberate: claiming a hostname is a trust boundary.

## Development

The API is reached at an address that is not a business domain, which is
exactly what `Origin` is for:

```bash
APP_API_URL=http://10.0.2.2:3000/api/v1     # the host, from an Android emulator
APP_ASSOCIATION_HOST=acme.localhost          # must exist in tenant_business_domains
```

`10.0.2.2` is the host machine as seen from an Android emulator; `localhost`
there is the emulator itself. An iOS simulator shares the host's network, so
`localhost` works. `acme.localhost` never has to resolve as DNS — it is only
ever a header value.

::: warning Both platforms block cleartext HTTP
**Android**, since API 28, fails with `CLEARTEXT_NOT_PERMITTED`, which reads
like a server fault. `member-app` solves it with a **debug-only**
`network_security_config.xml` naming `10.0.2.2`, `localhost` and `127.0.0.1`
and nothing else, so release builds stay HTTPS-only. A blanket
`android:usesCleartextTraffic="true"` would also permit cleartext to real
hosts.

**iOS** blocks it through App Transport Security, and has no per-build-type
plist merging to scope an exception to debug. `member-app` therefore ships
`NSAllowsLocalNetworking`, which permits cleartext to local destinations
*only* — `localhost`, link-local and `.local`. Production traffic stays
HTTPS-only, which is what makes a shipped key acceptable where
`NSAllowsArbitraryLoads` would not be.
:::

Flutter also puts `INTERNET` only in the **debug** manifest, for its hot-reload
channel. An app that makes API calls needs it in the main manifest too, or a
release build has no network at all and nothing in development reveals it.
