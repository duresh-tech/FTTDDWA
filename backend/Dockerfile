# syntax=docker/dockerfile:1

# Debian slim rather than Alpine, deliberately:
#   - `argon2` is a native module and musl prebuilds are unreliable
#   - Prisma's default engine target is debian-openssl-3.0.x
# The size saving from Alpine is not worth a native-build toolchain here.

# ---------------------------------------------------------------- base -------
FROM node:22-bookworm-slim AS base
# Prisma's query engine needs OpenSSL 3 at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# WORKDIR must be the app root: main.ts and StorageService both resolve the
# uploads directory with process.cwd(), not __dirname.
WORKDIR /app
ENV NODE_ENV=production

# ---------------------------------------------------------------- deps -------
# All dependencies, including dev (nest CLI, typescript) for the build.
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --------------------------------------------------------------- build -------
FROM deps AS build
COPY tsconfig.json nest-cli.json ./
COPY src ./src
# tsconfig includes prisma/**, so this emits BOTH dist/src/main.js and
# dist/prisma/seed.js -- the seed then runs in the image without ts-node.
RUN npx prisma generate && npm run build

# ----------------------------------------------------------------- dev -------
# Hot-reload target for docker-compose.dev.yml.
FROM deps AS dev
COPY . .
RUN npx prisma generate
ENV NODE_ENV=development
EXPOSE 4000
# `start:docker`, not `start:dev`: the latter triggers the prestart:dev hook,
# which runs the Windows-only scripts/free-port.js.
CMD ["npm", "run", "start:docker"]

# ---------------------------------------------------------------- prod -------
FROM base AS prod
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Its own install + generate rather than copying node_modules across stages,
# so the Prisma engine is built for this image's architecture. `prisma` is a
# runtime dependency (not a devDependency) so `migrate deploy` works here.
RUN npm ci --omit=dev \
 && npx prisma generate \
 && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Strip CR before chmod. A checkout on Windows can hand this image an
# entrypoint.sh with CRLF endings, and the kernel then looks for an
# interpreter literally named `/bin/sh\r`. It fails with a bare "No such
# file or directory" that names the SCRIPT, not the shebang, so the build
# succeeds and every container restart-loops on exit 127 instead.
#
# Create and chown the upload tree BEFORE dropping to `node`. Docker seeds a
# named volume from the image path on first mount and inherits its ownership,
# so getting this wrong makes every upload fail with EACCES.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p public/uploads/app-settings \
             public/uploads/app_settings_uploads \
             public/uploads/general \
             public/uploads/tenant-avatars \
 && chown -R node:node /app/public

USER node
EXPOSE 4000

# Node 22 has global fetch, so no curl/wget needs installing. The header is
# required: DeviceHeaderGuard is a global guard with no bypass, so a probe
# without x-device-type gets a 400.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD ["node","-e","const v=process.env.API_VERSION||'1';fetch(`http://127.0.0.1:${process.env.PORT||4000}/api/v${v}/system/health`,{headers:{'x-device-type':'website'}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# Note dist/src/ -- tsconfig includes prisma/**, which nests the output.
# Exec form, not `npm start`: npm does not forward SIGTERM cleanly.
CMD ["node","dist/src/main"]
