# Docker

Everything runs in containers. The stacks are split by lifecycle, so
rebuilding the API never touches the database.

## The stacks

| Stack | File | Services | Ports |
| --- | --- | --- | --- |
| Root | `docker-compose.yml` | — (includes the three below) | |
| Data | `backend/docker/data/compose.yml` | `postgres` | `127.0.0.1:5433` |
| Services | `backend/docker/services/compose.yml` | `api`, `migrate` (profile `setup`) | `:4000` |
| Console | `console/docker-compose.yml` | `console` | `:3000` |

Containers: `fttddwa-postgres`, `fttddwa-api`, `fttddwa-console`.

The root file is a thin aggregator — a `name:` and an `include:`, nothing
else:

```yaml
name: fttddwa

include:
  - path: backend/docker/data/compose.yml
  - path: backend/docker/services/compose.yml
  - path: console/docker-compose.yml
    env_file: backend/.env
```

Each stack is also runnable on its own, which is what makes a split
deployment possible — the database on one host, the API on another.

### Why the layout is nested

- **Per-service folders** (`data/postgres/`, `services/api/`) keep a service's
  compose file next to any config files it mounts. Nothing has mounted config
  yet, but an nginx or Caddy service would.
- **Aggregators** (`data/compose.yml`, `services/compose.yml`) hold the group's
  documentation and the `include:` list with its `env_file:`.
- **Separate data and services stacks** mean `docker compose down` or
  `up --build` on the API never stops, recreates or rebuilds Postgres.

## Everyday commands

```bash
docker compose up -d --build        # start or rebuild everything
docker compose up -d postgres       # just the database, for npm run dev
docker compose ps                   # health of each service
docker compose logs -f api console
docker compose down                 # stop; every volume survives
```

::: danger down -v at the root deletes everything
Including the database and the uploaded files. Run on a single stack it only
removes that stack's volumes.
:::

## Development

```bash
docker compose up -d --build
docker compose logs -f api console
```

The production images are what you get. For hot reload, run the apps on the
host against the containerized database instead:

```bash
docker compose up -d postgres
cd backend && npm run dev
cd console && npm run dev
```

Both Dockerfiles do carry a `dev` target with watch mode and polling (inotify
does not fire through a Windows bind mount). To use them, point a stack's
`build.target` at `dev` and bind-mount the source.

::: warning Never bind-mount the whole backend directory
It would shadow `/app/node_modules` with the host's, replacing the
Linux-built `argon2` binary with a Windows one — which crashes on boot. Mount
`src/`, `prisma/` and the individual config files, and shadow `node_modules`
with a named volume.
:::

## Migrations

The api container applies migrations on boot via
`backend/docker/entrypoint.sh`, so a fresh database needs no manual step.

To run them deliberately — before a rollout, say — use the `migrate` job. It
is in the `setup` profile, so it never starts with `up`:

```bash
docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm --entrypoint node migrate dist/prisma/seed
```

::: tip up -d --build does not rebuild a profile service
After changing the backend image, rebuild the setup image explicitly:
`docker compose --profile setup build migrate`.
:::

See [Database & migrations](./database) for authoring them.

## Images

| Image | Base | Why |
| --- | --- | --- |
| `fttddwa-api` | `node:22-bookworm-slim` | `argon2` is a native module and musl prebuilds are unreliable; Prisma's default engine targets `debian-openssl-3.0.x` |
| `fttddwa-console` | `node:22-alpine` | No native modules and no `next/image`, so `sharp` is never needed |

Both are multi-stage with `dev` and `prod` targets and run as the non-root
`node` user.

### Backend image notes

- `prisma generate` runs in **both** the build and prod stages. The prod stage
  does its own `npm ci --omit=dev` rather than copying `node_modules` across,
  so it needs its own client — generated on the runtime architecture.
- `prisma` is a **runtime** dependency, not a devDependency. Without that,
  `prisma migrate deploy` would not exist in an image built with `--omit=dev`.
- `WORKDIR` is `/app`, because `main.ts` and `StorageService` both resolve the
  uploads directory with `process.cwd()`.
- The upload subdirectories are created and `chown`ed **before** dropping to
  `node`. Docker seeds a named volume from the image path on first mount and
  inherits its ownership — get this wrong and every upload fails `EACCES`.
- The entrypoint is `docker/entrypoint.sh`; the command is
  `node dist/src/main` (note the `dist/src/` nesting — `tsconfig` includes
  `prisma/**`, which is also why `dist/prisma/seed.js` exists). Exec form, not
  `npm start`, because npm does not forward `SIGTERM` cleanly.

### Console image notes

- `output: "standalone"` in `next.config.ts`.
- `.next/static` is copied **separately**. Standalone output does not include
  it, and omitting the copy gives an app with no CSS or JS — which only shows
  up in a browser, while the container still reports healthy.
- There is no `COPY /app/public`: this project has no `public/` directory, and
  adding the line would fail the build.
- No `NEXT_PUBLIC_*` build args. Configuration is resolved at run time — see
  [Configuration](./configuration#why-these-are-not-next-public).

## Health checks

Both services probe themselves with Node's global `fetch`, so neither image
installs `curl` or `wget`.

The API's probe **must** send `x-device-type: website`. `DeviceHeaderGuard` is
registered globally, and its single `@SkipDeviceHeader()` bypass exists only
for Caddy's on-demand TLS check, which issues a bare GET and cannot set
headers. Any other request without that header gets a `400` — a naive probe
would report the service permanently unhealthy:

```bash
curl -s -H 'x-device-type: website' http://localhost:4000/api/v1/system/health
```

The console's probe targets `/system/login` rather than `/`, which redirects,
and needs no backend.

### Startup ordering

`api` deliberately has **no** `depends_on: postgres`. Postgres is in a
different stack, which compose cannot wait on when the services stack runs on
its own — declaring it would make that stack fail outright with "service
postgres not found".

Instead, if the database is not ready the API exits and
`restart: unless-stopped` retries it. On a cold `up` you may therefore see the
api container restart once or twice while Postgres initializes; that is
expected, and `docker compose ps` settles on `healthy`.

## Hardening

Applied to every service:

- `security_opt: no-new-privileges:true` and `cap_drop: ALL`
- `read_only: true` root filesystems, with `tmpfs` for `/tmp` (and the Unix
  socket directory for Postgres)
- `deploy.resources.limits` for CPU and memory, from `backend/.env`
- `init: true` for PID 1 reaping and signal forwarding, so `docker stop`
  reaches Nest's shutdown hooks and Prisma closes connections cleanly
- `logging` with json-file rotation
- Postgres runs as `user: postgres` from the start, so it needs no
  capabilities at all; started as root, its entrypoint would need
  `CHOWN`/`SETUID`/`SETGID` to drop privileges itself

## Networks

| Network | Internal | Holds |
| --- | --- | --- |
| `fttddwa-data` | yes | `postgres`, `api` |
| `fttddwa-app` | no | `api`, `console` |
| `host-port` | no | `postgres`, only so its `127.0.0.1` port can be published |

`fttddwa-data` is `internal: true` — no route to the internet through it. Each
stack defines these identically, so whichever starts first creates them. An
internal network cannot publish a port, which is why `postgres` also joins a
small `host-port` network.

## Volumes

| Volume | Holds | Lost on |
| --- | --- | --- |
| `fttddwa-postgres-data` | the database | `down -v` |
| `fttddwa-uploads` | uploaded files | `down -v` |

Both have fixed `name:` values, so the data does not depend on the folder or
project name the stack happens to run under.

Only relative paths are stored in the database, never URLs, so the uploads
volume is freely relocatable — `UPLOADS_HOST_DIR` puts the files in an
absolute host folder instead (it must be writable by UID 1000). Setting
`STORAGE_DRIVER=s3` removes the volume entirely.

## Known limits

- `ThrottlerGuard` uses the default in-memory store, so rate limits are
  per-container and reset on restart. Behind a reverse proxy, correct client
  IPs would also need Express `trust proxy`. Both matter before scaling past
  one API replica.
- Building for a different architecture than the host (an arm64 Mac targeting
  amd64) needs `docker buildx --platform`; `prisma generate` runs in the prod
  stage so the engine matches the image, but `argon2` still has to match.
