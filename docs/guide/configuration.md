# Configuration

One file per app, each with a committed `.example` template and each
gitignored:

| File | Owns | Read by |
| --- | --- | --- |
| `backend/.env` | The API, the database it creates, Docker host ports and resource limits | every backend stack, and `npm run dev` |
| `console/.env` | The console's runtime config | the console stack |
| `console/.env.local` | The same three values under `NEXT_PUBLIC_*` names | host-native `npm run dev` only |

The compose stacks read `backend/.env` for their `${...}` interpolation (the
`env_file:` lines in each `include:`), and the containers load the same file
through their own `env_file`. So the configuration lives in one place per app
rather than being split between "host" and "Docker" copies.

## The two things that are easy to get wrong

### URLs must be browser-facing

```
browser ──► localhost:3000 ──► console    (HTML + /runtime-config.js)
        └─► localhost:4000 ──► api        (all data, auth, /uploads)
api     ──► postgres:5432                 (internal network, unpublished)
```

The browser talks to the API **directly**. So:

- `console/.env` → `APP_API_URL` must be an address the browser can reach.
- `backend/.env` → `CORS_ORIGINS` must be the console's browser-facing origin.

`http://api:4000` and `http://console:3000` resolve **only between
containers**. Using either fails in the browser, and it fails as an opaque
CORS or network error in the console rather than as anything in the container
logs.

Check what the browser actually receives:

```bash
curl -s http://localhost:3000/runtime-config.js
```

### One database name

`POSTGRES_DB` in `backend/.env` is the only place the database name appears.
The data stack creates that database, and
`backend/docker/services/api/compose.yml` composes the container's
`DATABASE_URL` from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`.

`DATABASE_URL` in the file is the **host** form, pointing at `localhost:5433`
for `npm run dev`; the api service overrides it with the in-network address.
Set `DOCKER_DATABASE_URL` to point the API at a different PostgreSQL entirely
(a managed one, say) — it must be a `postgresql://` URL.

::: warning POSTGRES_* only apply to a new volume
Postgres reads `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` only
when initializing an empty data directory. Changing them later does not change
the database — that needs `down -v` and a fresh setup.
:::

## Validation at boot

`backend/src/config/env.validation.ts` is a Zod schema wired into
`ConfigModule`. Anything invalid aborts startup with a readable message rather
than failing mysteriously later:

- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — required, min 32 characters
- `DATABASE_URL` — required, must be `postgresql://` or `postgres://`
- `CORS_ORIGINS` — required, non-empty
- `PORT`, `THROTTLE_TTL_MS`, `THROTTLE_LIMIT`, `API_VERSION` — coerced and bounded
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` —
  required only when `STORAGE_DRIVER=s3`

With `APP_ENV=production` it additionally rejects the example placeholder
secrets, requires the two secrets to differ, and requires
`COOKIE_SECURE=true`.

`ConfigModule` previously validated nothing, so a typo became `undefined` — and
an empty `CORS_ORIGINS` left `origin: false`, silently rejecting every
cross-origin browser request.

## backend/.env

### App

| Key | Default | Notes |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` turns on the stricter checks above |
| `PORT` | `4000` | Inside the container |
| `APP_NAME` | `FTTDDWA` | Fallback only — the DB `app.name` row wins |
| `API_VERSION` | `1` | URI versioning: `/api/v1` |

### Database

| Key | Default | Notes |
| --- | --- | --- |
| `POSTGRES_USER` | `fttddwa` | |
| `POSTGRES_PASSWORD` | — | **Required.** The stacks fail fast without it |
| `POSTGRES_DB` | `fttddwa_db` | The single source of the database name |
| `DATABASE_URL` | — | Host form, for `npm run dev` |
| `DOCKER_DATABASE_URL` | unset | Overrides the composed container URL |
| `API_DB_POOL` | `10` | Bounds Prisma's pool; its default grows with CPU count |

### Auth

| Key | Default | Notes |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | — | **Required**, min 32 chars |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_SECRET` | — | **Required**, min 32 chars, must differ |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | |
| `COOKIE_SECURE` | `false` | Required `true` in production |

### CORS, throttling, storage, Swagger

| Key | Default | Notes |
| --- | --- | --- |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated, browser-facing |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | `60000` / `100` | Global budget |
| `STORAGE_DRIVER` | `local` | or `s3` |
| `LOCAL_STORAGE_DIR` | `public/uploads` | Resolved against the container's `/app` |
| `S3_*` | — | Required when `STORAGE_DRIVER=s3` |
| `SWAGGER_ENABLED` | `true` | Turn off in production |
| `SWAGGER_PATH` | `docs` | Served outside the `/api` prefix |

### Docker: ports, images, resources

| Key | Default | Notes |
| --- | --- | --- |
| `POSTGRES_HOST_PORT` | `5433` | Always bound to `127.0.0.1` |
| `API_HTTP_PORT` / `API_HTTP_BIND` | `4000` / `0.0.0.0` | |
| `CONSOLE_HTTP_PORT` / `CONSOLE_HTTP_BIND` | `3000` / `0.0.0.0` | |
| `IMAGE_REGISTRY` / `IMAGE_TAG` | unset / `latest` | For pushing to a registry |
| `API_CPUS` / `API_MEMORY` | `1.5` / `768m` | |
| `CONSOLE_CPUS` / `CONSOLE_MEMORY` | `1` / `512m` | |
| `POSTGRES_SHM_SIZE` | `256m` | Docker's 64m default is tight for parallel queries |
| `LOG_MAX_SIZE` / `LOG_MAX_FILE` | `10m` / `5` | json-file rotation |
| `UPLOADS_HOST_DIR` | unset | An absolute host folder instead of the named volume |

Set the `*_BIND` keys to `127.0.0.1` when a reverse proxy fronts the stack —
Docker's published ports bypass a host firewall such as UFW.

### Encryption at rest

| Key | Default | Notes |
| --- | --- | --- |
| `SETTINGS_ENCRYPTION_KEY` | derived | 64 hex characters. AES-256 key for values the app must read back |

Used for the console's own API key today, and for encrypted settings later.

**Optional.** Left empty it is derived from `JWT_ACCESS_SECRET` via HKDF, so a
fresh install needs no edit here before the setup wizard can run — the wizard
issues the console's API key itself and stores it with this. The derived key
is independent of the signing secret, so neither can be recovered from the
other.

::: warning Set it explicitly on anything long-lived
With the fallback, rotating `JWT_ACCESS_SECRET` moves the encryption key with
it and makes every stored encrypted value unreadable. Recovery is
`npm run console-key` plus re-entering any encrypted settings.
:::

There is **no API key to configure**: see
[API keys](./api-keys#the-console-s-key).

### Domains and the edge

| Key | Default | Notes |
| --- | --- | --- |
| `SYSTEM_PORTAL_HOSTS` | unset | Hostnames of the system console, comma-separated, no port |
| `EDGE_ASK_KEY` | unset | Shared secret the edge sends with its TLS check. Empty accepts it |
| `ACME_EMAIL` | unset | Let's Encrypt account email, for expiry notices |
| `EDGE_TLS` | unset | `local_certs` uses Caddy's own CA for every name |
| `EDGE_HTTP_PORT` / `EDGE_HTTPS_PORT` | `80` / `443` | Let's Encrypt needs both reachable |
| `EDGE_BIND` | `0.0.0.0` | |
| `PROXY_NETWORK_SUBNET` / `PROXY_EDGE_IP` | `172.31.251.0/24` / `172.31.251.20` | Change both together, in `backend/.env` only |

`SYSTEM_PORTAL_HOSTS` is read once at construction, so changing it needs
`docker compose up -d --force-recreate api`, not a restart.

::: warning Set SYSTEM_PORTAL_HOSTS before the first HTTPS visit
The edge issues a certificate only for a hostname the API already knows. On a
fresh install there are no business domains yet, so leaving this empty means no
hostname can get one — including the console you would use to add the first
domain. The API warns at startup. See [Tenant domains](./domains).
:::

## console/.env

| Key | Default | Notes |
| --- | --- | --- |
| `APP_API_URL` | `/api/v1` | **Browser-facing**, and relative: every call is same-origin through the gateway |
| `APP_NAME` | `FTTDDWA` | Fallback and initial tab title |
| `APP_OSM_TILE_URL` | the public OSM server | Places/Streets map picker |
| `API_PROXY_TARGET` | `http://localhost:4000` | `npm run dev` only — where `src/middleware.ts` forwards `/api` and `/uploads` |

### Why these are not NEXT_PUBLIC_*

`next build` string-replaces every `process.env.NEXT_PUBLIC_*` read into the
client bundle. A built image would be permanently pinned to whichever API URL
it was built with, and setting that variable via compose at run time would do
nothing.

The `APP_*` names avoid that. They are read by the Next **server** per request
and published to the browser as `window.__RUNTIME_CONFIG__` by
`src/app/runtime-config.js/route.ts` (which is `force-dynamic` — without that,
Next would statically generate it at build time and bake the build-time
environment straight back in). `src/lib/runtime-config.ts` reads that global
through lazy getters, falling back to the `NEXT_PUBLIC_*` values so
host-native development is unaffected.

The result: one image runs in any environment, and changing the API URL is a
restart rather than a rebuild.

The getters must stay **lazy functions**, never module-scope constants —
those modules are also evaluated during SSR, where `window` does not exist.

## Cookies and deployment domains

Auth cookies are `sameSite=strict` with **no** explicit domain — `COOKIE_DOMAIN`
does not exist; it was a documentation-only key that nothing read. The refresh
cookie is scoped to `path=/api/v1/system`.

SameSite is computed per *site* and ignores ports, so `localhost:3000` →
`localhost:4000` is same-site and works in development.

**In production both services must share one registrable domain** — for
example `app.example.com` and `api.example.com`, with `COOKIE_SECURE=true`.
Split domains such as `app.vercel.app` plus `api.fly.dev` would silently break
token refresh.

If you need genuinely separate domains, add a Next `rewrites` proxy so the API
is same-origin to the browser.
