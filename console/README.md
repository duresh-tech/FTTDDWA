# Console — System Administration UI

[![Version](https://img.shields.io/badge/version-1.6.0-blue)](./CHANGELOG.md)

Next.js system administration console. See [`CHANGELOG.md`](./CHANGELOG.md)
for release history and [`../README.md`](../README.md) for the project overview.

| | |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui (new-york style) |
| Theme | light / dark / system via `next-themes` |
| Motion | `motion` (Framer Motion); respects `prefers-reduced-motion` |
| Data | REST calls to the backend `/api/v1` |

## Setup

The supported path is Docker, from the repository root:

```bash
docker compose up -d --build
```

For hot reload, run the console on the host against the containerized
database instead (`npm run dev` below).

Host-native development still works and needs the backend running
separately (see `../backend/README.md`):

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if not localhost:4000
npm run dev                  # http://localhost:3000
```

On a fresh database the app redirects to `/setup`, a first-run wizard that
creates the administrator account and the initial branding. There are no
default credentials.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Pages

### System dashboard (`/system/...`)

| Route | Purpose |
| --- | --- |
| `/setup` | First-run wizard: administrator account, branding, options. Redirects to sign-in once initialized |
| `/system/login` | Sign in; redirects to `/system/dashboard` on success |
| `/system/dashboard` | Stats overview |
| `/system/dashboard/users` | System Users — list, create, edit, delete |
| `/system/dashboard/tenant-users` | Tenant Users — list, create, edit, delete, view, "Login as" |
| `/system/dashboard/tenant-business` | Tenant Business — list, create, edit, delete, restore, view |
| `/system/dashboard/tenant-mapped-business` | Tenant Mapped Business — assign a business to a tenant user |
| `/system/dashboard/setting-definitions` | Setting Definitions — the catalogue of per-business settings, plus "Sync to all tenants" |
| `/system/dashboard/tenant-business-settings` | Business Settings — cross-tenant support view of one business's values, with a per-setting tenant lock |
| `/system/dashboard/tenant-mail-config` | Mail Config — list, create, edit, delete, send test email |
| `/system/dashboard/tenant-association-positions` | Association Positions — list, create, edit, delete, restore |
| `/system/dashboard/tenant-states` | States — list, create, edit, delete, restore |
| `/system/dashboard/tenant-districts` | Districts — list, create, edit, delete, restore; state picker |
| `/system/dashboard/tenant-taluks` | Taluks — list, create, edit, delete, restore; cascading state → district pickers |
| `/system/dashboard/tenant-industries` | Industries — list, create, edit, delete, restore |
| `/system/dashboard/tenant-places` | Places — list, create, edit, delete, restore, map picker |
| `/system/dashboard/tenant-streets` | Streets — list, create, edit, delete, restore, map picker |
| `/system/dashboard/roles` | Roles — list, create, edit, delete, assign permissions (grouped, searchable) |
| `/system/dashboard/permissions` | Permissions — list, create, edit, delete |
| `/system/dashboard/app-settings` | App Settings — generic typed key-value config store: list, create, edit, delete, restore |

### Tenant portal (`/tenant/...`)

| Route | Purpose |
| --- | --- |
| `/tenant/login` | Tenant sign in; redirects to `/tenant/dashboard` |
| `/tenant/dashboard` | Tenant stats overview |
| `/tenant/users` | Team members mapped to the caller's business — list, create, edit, delete, view |
| `/tenant/settings/user-account` | Own profile — name, username, email, phone, password, avatar |
| `/tenant/settings/business-information` | Own business profile (view/update, per permission) |
| `/tenant/settings/business-settings` | Own business settings — grouped by category, saved as one batch with a from/to confirmation |
| `/tenant/settings/states`, `/districts`, `/taluks`, `/industries`, `/association-positions`, `/mail-config`, `/places`, `/streets`, `/api-keys` | Self-service CRUD twins of the matching system-admin pages, scoped to the caller's own business |

## Permission-gated UI

`useSession()` loads `/system/me` and exposes `hasPermission(key)`. Every
create/edit/delete action and every sidebar nav item checks this before
rendering — a user without `roles:create`, for instance, never sees an
"Add Role" button, and `/system/dashboard/roles` disappears from the
sidebar entirely without `roles:read`. This mirrors, but does not replace,
the backend's own RBAC enforcement — the API is the actual authority.

System records (`isSystem: true`) lock their key fields in edit forms and
disable the delete action in the UI, matching backend behavior.

## Animation & responsiveness

- `motion` (Framer Motion, via `motion/react`) drives page-transition
  crossfades, a sliding active-indicator in the sidebar nav, staggered
  dashboard stat cards, animated resource-table rows, button press
  feedback, and entrance/error animations on the login and setup cards.
  `MotionConfig reducedMotion="user"` in `src/app/layout.tsx` disables
  this automatically for users with the OS "reduce motion" setting on.
- `ResourceTable` renders as stacked cards below the `sm` breakpoint
  instead of a horizontally-scrolling table, so Users/Roles/Permissions
  stay usable on phones. Its loading state renders `Skeleton` rows/cards
  matching the real layout instead of a spinner.

## Key files

| File | Purpose |
| --- | --- |
| `src/lib/runtime-config.ts` | Lazy getters for the API URL, app name and tile server, read from `window.__RUNTIME_CONFIG__` at run time |
| `src/app/runtime-config.js/route.ts` | Publishes this container's config to the browser (`force-dynamic`) |
| `src/app/setup/page.tsx` | First-run setup wizard |
| `src/hooks/use-setup-status.ts` | Cached `/system/setup/status` lookup that drives the setup gate |
| `src/lib/api.ts` | System API fetch wrapper: bearer token, `x-device-type` header, auto-refresh on 401 |
| `src/lib/tenant-api.ts` | Same, namespaced for the tenant portal (own token key, CSRF cookie, refresh path) |
| `src/hooks/use-session.tsx` | System auth Context provider: fetches `/system/me` once, exposes `hasPermission()` |
| `src/hooks/use-tenant-session.tsx` | Tenant equivalent, fetches `/tenant/me` once |
| `src/hooks/use-resource-list.ts` | Paginated/searchable list state for any endpoint; accepts an optional fetcher (`api` or `tenantApi`) and filters |
| `src/components/resource-table.tsx` | Presentational table + pagination + toolbar/actions slots |
| `src/components/row-actions-menu.tsx` | Collapses per-row actions into a single "..." dropdown |
| `src/components/confirm-dialog.tsx` | Shared delete-confirmation modal |
| `src/components/sidebar-nav.tsx` | Permission-filtered system dashboard nav |
| `src/components/tenant-shell.tsx` / `tenant-settings-nav.tsx` | Tenant portal shell and settings sub-nav |
| `src/components/ui/combobox.tsx` | Searchable Popover+Command select, used for business/tenant-user/role pickers |
| `src/components/location-picker-panel.tsx` / `location-picker/leaflet-map.tsx` | OpenStreetMap/Leaflet location picker (Places, Streets) |
| `src/components/theme-provider.tsx` / `theme-toggle.tsx` | Light/dark/system theming |

## Configuration

Two separate files, depending on how you run the app:

| File | Used by | Variables |
| --- | --- | --- |
| [`.env.example`](./.env.example) → `.env` | Docker Compose | `APP_API_URL`, `APP_NAME`, `APP_OSM_TILE_URL` |
| [`.env.example`](./.env.example) → `.env.local` | host-native `npm run dev` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_OSM_TILE_URL` |

### Why two sets of names

`next build` string-replaces every `process.env.NEXT_PUBLIC_*` read into the
client bundles. A built image is therefore pinned to whatever API URL it was
built with, and setting that variable via compose `environment:` at run time
does nothing.

So the Docker path uses non-`NEXT_PUBLIC_` names, read by the Next **server**
per request and published to the browser as `window.__RUNTIME_CONFIG__` by
`src/app/runtime-config.js/route.ts`. `src/lib/runtime-config.ts` reads that,
falling back to the `NEXT_PUBLIC_*` values so host-native development is
unaffected. One image runs in any environment, and changing the API URL is a
restart rather than a rebuild.

**`APP_API_URL` must be reachable from the browser** — `http://localhost:4000/api/v1`,
never `http://backend:4000/api/v1`. Compose service names only resolve
container-to-container, and this value is handed to the browser.

The app name is DB-backed: `useAppSettings()` reads it from
`/system/app-settings/public/branding`, and these variables only supply the
fallback and the initial tab title.
