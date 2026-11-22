# Getting started

Everything runs in Docker. You need Docker with Compose v2 — no Node, no
database install.

## Run it

```bash
# 1. One env file per app, from the committed templates.
cp backend/.env.example backend/.env
cp console/.env.example console/.env

# 2. In backend/.env, set a database password and two JWT secrets.
#    Each secret must be at least 32 characters and differ from the other:
openssl rand -hex 32
openssl rand -hex 32

# 3. Start everything.
docker compose up -d --build
```

Then open <http://localhost:3000>.

A fresh database has no accounts, so the console redirects to
**[`/setup`](./setup-wizard)**. That wizard creates the administrator account,
the `SYSTEM_SUPER_ADMIN` role with all 115 permissions, and the branding.
**There are no default credentials** — you choose them there, and the wizard
closes itself permanently once an account exists.

## What is running

| Container | Port | From |
| --- | --- | --- |
| `fttddwa-postgres` | `127.0.0.1:5433` | `backend/docker/data/` |
| `fttddwa-api` | `:4000` | `backend/docker/services/` |
| `fttddwa-console` | `:3000` | `console/` |

The API is at <http://localhost:4000/api/v1>, with Swagger at
<http://localhost:4000/docs> when `SWAGGER_ENABLED=true`.

```bash
docker compose ps                    # health of each service
docker compose logs -f api console
docker compose down                  # stop; every volume survives
```

::: warning `down -v` at the repository root deletes everything
That includes the database and the uploaded files. On an individual stack it
only removes that stack's volumes. See [Docker](./docker).
:::

## Checking it worked

```bash
# The health endpoint must send x-device-type - a global guard requires it
# on every request, with no exemption.
curl -s -H 'x-device-type: website' http://localhost:4000/api/v1/system/health
# -> {"status":"ok","db":"up"}

# Not yet initialized, before you run the wizard:
curl -s -H 'x-device-type: website' http://localhost:4000/api/v1/system/setup/status
# -> {"initialized":false,...}

# The console's runtime configuration, as handed to the browser:
curl -s http://localhost:3000/runtime-config.js
```

That last one should show the API URL from `console/.env`. If it shows
`http://api:4000`, the browser will fail — see
[Configuration](./configuration#urls-must-be-browser-facing).

## Developing

Only the database needs to be in Docker:

```bash
docker compose up -d postgres

cd backend && npm install && npx prisma migrate deploy && npm run dev
cd console && npm install && npm run dev
```

`backend/.env` already points `DATABASE_URL` at `localhost:5433`, the port the
data stack publishes, so the same file works for both. For the console, copy
the commented `NEXT_PUBLIC_*` block from `console/.env.example` into
`console/.env.local`.

To work inside containers with hot reload instead, see
[Docker](./docker#development).

## Next

- [Setup wizard](./setup-wizard) — what first-run actually creates
- [Configuration](./configuration) — every env key, and the two that are easy to get wrong
- [Docker](./docker) — the stacks, volumes and ports
- [Database & migrations](./database) — authoring and applying schema changes
- [How it works](/logic/auth) — the decisions behind auth, RBAC and tenancy
