# syntax=docker/dockerfile:1

# Alpine is safe here, unlike the backend: no native modules (leaflet and
# qrcode are pure JS) and no next/image usage, so `sharp` is never needed.

# ---------------------------------------------------------------- base -------
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------- deps -------
FROM base AS deps
COPY package.json package-lock.json ./
# npm ci, not npm install: package.json pins an `overrides` entry for
# @radix-ui/react-focus-scope that only the committed lockfile reproduces.
RUN npm ci

# ----------------------------------------------------------------- dev -------
# Hot-reload target for docker-compose.dev.yml. Polling is required because
# inotify does not fire through a Windows bind mount.
FROM deps AS dev
ENV NODE_ENV=development \
    WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=true
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# --------------------------------------------------------------- build -------
FROM deps AS build
ENV NODE_ENV=production
COPY . .
# Produces .next/standalone thanks to `output: "standalone"` in next.config.ts.
#
# No NEXT_PUBLIC_* build args on purpose: the API URL is resolved at RUN time
# via /runtime-config.js, so this image is not pinned to one environment.
RUN npm run build

# ---------------------------------------------------------------- prod -------
FROM base AS prod
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/.next/standalone ./
# Mandatory second copy: standalone output does NOT include static assets.
# Skip this and the app serves with no CSS or JS, which only shows up in a
# browser -- the container still reports healthy.
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# NOTE: there is intentionally no `COPY /app/public` -- this project has no
# public/ directory, and adding the line would fail the build.

USER node
EXPOSE 3000

# Node 22 has global fetch, so nothing extra needs installing. Targets
# /system/login rather than / (which redirects) and needs no backend.
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD ["node","-e","fetch(`http://127.0.0.1:${process.env.PORT||3000}/system/login`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node","server.js"]
