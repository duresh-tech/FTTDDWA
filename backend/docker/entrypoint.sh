#!/bin/sh
set -e

# Fallback for a bare `docker run`: compose DATABASE_URL from the canonical
# Postgres variables if it was not supplied. Under compose, the api service
# always sets it (backend/docker/services/api/compose.yml) and this is a
# no-op. Either way POSTGRES_DB stays the single source of the database name.
if [ -z "$DATABASE_URL" ]; then
  if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DB" ]; then
    echo "[entrypoint] ERROR: set DATABASE_URL, or all of POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB" >&2
    exit 1
  fi
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST:-postgres}:${DB_PORT:-5432}/${POSTGRES_DB}?schema=public&connection_limit=${DB_CONNECTION_LIMIT:-10}"
  echo "[entrypoint] DATABASE_URL composed for database '${POSTGRES_DB}' on ${DB_HOST:-postgres}:${DB_PORT:-5432}"
fi

# Apply migrations before the app opens a pool. compose already waits for
# postgres to be healthy, so this does not need its own retry loop.
echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy

exec "$@"
