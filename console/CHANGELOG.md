# Changelog

All notable changes to the console (formerly `frontend/`) are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.2.0] - 2026-11-23

### Added

- **Member screens** - the largest form in the app, on both surfaces.
  `/system/dashboard/tenant-members` and `/tenant/members`, the latter with its
  own layout wrapping TenantShell because members is a primary record, not a
  setting.
- Three cascading pickers (state -> district -> taluk) alongside position and
  industry. Each change clears everything beneath it, so the form cannot hold
  a district from one state next to a taluk from another - which the API would
  reject anyway, but far later and less legibly.
- A passport-photo uploader on the business-logo idiom, two `<input
  type="date">` fields, and an `isMarried` checkbox that reveals the wedding
  date and clears it when unticked.
- Aadhaar renders as `XXXX XXXX 1234` with a replace field. On edit the field
  starts blank, because blank is what tells the server to keep the stored
  number - it is never sent back to be re-submitted.
- Nav: Members leads the Tenants section in the system sidebar, and sits
  beside Users in the tenant portal.

## [3.1.0] - 2026-11-23

### Added

- **Association Positions screens**, cloned from the Places pages with the map
  stripped out.
  - `/system/dashboard/tenant-association-positions` — cross-business list with
    status filter, sort, soft-delete and restore.
  - `/tenant/settings/association-positions` — the caller's own, with the
    business auto-selected when they map to exactly one. No restore: that is a
    system-admin act.
- A **Tamil name** field and column on all four existing places and streets
  screens, and on both new ones. A blank field sends `undefined` rather than
  `""`, so "not recorded" stays NULL instead of becoming a row that looks
  filled in.
- Nav entries under `Tenants` (system) and `Business` (tenant settings), placed
  adjacent to their section siblings — order is the grouping, and a stray item
  would render its section header twice.

## [3.0.0] - 2026-11-22

### Fixed

- **The sidebar clipped its last nav entries and mis-aligned its footer.** The
  `aside` is `h-dvh flex-col`, but the brand header and the footer were both
  flex-shrinkable and the nav scroller lacked `min-h-0`. Once the nav outgrew
  the viewport the footer got squeezed and the bottom entries were pushed out
  of reach — so "Setting Definitions" and "Business Settings" looked absent
  from the system portal even though they rendered and passed their permission
  check. Fixed with `shrink-0` on the header and footer and `min-h-0` on the
  scroller, in `app/system/dashboard/layout.tsx` and `components/tenant-shell.tsx`.

### Removed

- **BREAKING - the customers screens.** Deleted
  `app/system/dashboard/tenant-customers/` and `app/tenant/customers/`
  (2,575 lines) and both nav entries. Their API routes are gone, so these pages
  could only 404.
- Three libs that existed only for those screens: `lib/tax-types.ts`,
  `lib/id-proof-types.ts` and `lib/countries.ts`.
- The now-unused `Contact` icon import from both nav files.

`location-picker-panel.tsx` is **kept** — the four places and streets screens
still use it.

## [2.1.0] - 2026-11-21

### Added

- **Business Settings screens**, for the new per-business settings feature.
  - `/tenant/settings/business-settings` — the tenant's own settings, grouped
    by category, with a dirty-count save button and a from → to diff table in
    the confirmation. Saved as one batch; a rejected value changes nothing.
  - `/system/dashboard/tenant-business-settings` — cross-tenant support view.
    Pick a business, edit any value row by row, and use the lock icon to grant
    or revoke *that one* tenant's access to *that one* setting.
  - `/system/dashboard/setting-definitions` — the catalogue CRUD, plus "Sync to
    all tenants" to backfill a new definition to businesses that already exist.
- **`src/components/setting-value-input.tsx`** — renders the right control from
  a setting's `valueType` and `validationRules` alone, across 15 types. This is
  what makes adding a setting a catalogue change rather than a UI change: an
  `enum` rule becomes a dropdown, a `multiEnum` a checkbox list, a `FILE` an
  upload with a thumbnail. No setting is named anywhere in the file.
- **`src/components/system-business-picker.tsx`** — one-business selector for
  system screens; selects the only business by itself when there is just one.
- **`src/components/ui/info-popover.tsx`** — the longer explanation behind a
  label, on an (i). Popover rather than a hover tooltip, so it is reachable on
  a touch screen.

### Changed

- **`ConfirmDialog` takes `children` and `confirmVariant`.** Its confirm button
  was hardcoded `destructive`, and it had no slot for showing *what* it was
  about to do. The settings save needs both: a diff table in the body, and a
  button that is not red for a non-destructive action.
- Both navs gained entries, placed adjacent to their section siblings because
  order is the grouping: "Setting Definitions" and "Business Settings" under
  `SETTINGS` in the system sidebar, and "Business Settings" under `BUSINESS` in
  the tenant settings rail.

## [2.0.0] - 2026-11-21

### Removed

- **BREAKING - five resources and their ten pages**: tax types, payment modes,
  income & expense categories, business branches and network providers
  (~3,900 lines). Deleted from `src/app/system/dashboard/` and
  `src/app/tenant/settings/`. Their API routes are gone too, so these pages
  could only 404.

### Changed

- **Both sidebars are now categorised.** The system sidebar had 18 of its 20
  items under a single "Management" heading; the 15 survivors are grouped
  **Main / Access Control / Tenants / Locations / Integrations / Settings**.
  The array stays flat - `sidebar-nav.tsx` derives headers by run length over
  it, so `command-palette.tsx` and `nav-breadcrumb.tsx` keep consuming it
  unchanged, and the sliding pill (a `motion` shared-layout `layoutId`, not an
  index calculation) still animates across sections.
- **The tenant settings rail is grouped too** - **Account / Business /
  Locations / Developer** - which it could not be before: it was a flat array
  with no `section` field. Sections are built after the permission filter, so
  a group whose every item is hidden never renders an empty header.

### Added

- `ui/select.tsx` now exports `SelectGroup` and `SelectLabel`, so the tenant
  settings nav's mobile `<Select>` shows the same categories as the desktop
  rail rather than one undifferentiated list.

## [1.8.0] - 2026-11-21

### Changed

- **Rebranded from "CRM Template" to FTTDDWA** (Federation of Tamilnadu Tent
  Dealers & Decorators Welfare Association). The `APP_NAME` fallbacks in
  `src/app/layout.tsx`, `src/app/runtime-config.js/route.ts` and
  `src/lib/runtime-config.ts` are now `FTTDDWA`, as are the setup wizard's
  initial app-name value and its placeholder. The package is
  `fttddwa-console` - its `package-lock.json` had also been left at the stale
  `crm-template-frontend` from the `frontend/` -> `console/` rename.
- Docker identifiers are `fttddwa-*`: the `fttddwa-console` and
  `fttddwa-console-gateway` containers, the `fttddwa-console` image, the
  `fttddwa-console` default compose project, and the `fttddwa-app` /
  `fttddwa-proxy` networks.

Nothing in the sidebar, page headers or login screens needed editing: they
already render `useAppSettings().appName`, which reads the DB `app.name` row
and falls back to `APP_NAME`.

## [1.7.0] - 2026-11-18

### Added

- **`src/lib/console-key.ts`**: the console sends its own `x-api-key`
  on every call, read from `GET /system/setup/status` - the setup wizard
  issues it. Nothing to configure, one mechanism in Docker and in
  `npm run dev`, and a reissued key is picked up on the next page load
  without a rebuild. It rides on the setup-status request the console
  already makes, so it costs no extra round trip.
- **`src/lib/setup-status.ts`**: the setup-status fetch, its cache and
  its invalidation moved out of `use-setup-status.ts`, because the API
  clients need the console key out of the same response and two caches
  of one endpoint would mean two requests and two things to invalidate.
  `invalidateSetupStatus()` after the wizard therefore also picks up
  the key it just issued.
- **`src/middleware.ts`**, the dev-mode stand-in for the nginx gateway:
  it forwards `/api` and `/uploads` to `API_PROXY_TARGET`. This
  **replaces the `next.config.ts` rewrites**, which is where Next
  expects request-level proxying; production returns immediately, since
  nginx owns those paths in the container.
- **API Keys** (System -> API Keys) and **API Key Scope Templates**
  (System -> API Key Scope Templates) pages, plus a business's own keys
  under Settings -> API Keys.
  - `ApiKeySecretDialog` **refuses to close** until the operator has
    copied the key or confirmed they stored it, and it opens before the
    list refreshes. This is the only moment the secret exists outside
    the caller's memory, so a stray click on the overlay must not
    discard it.
  - `ApiKeyScopePicker` offers only the operator's **own** permissions
    on the key form, since the server refuses to grant a scope the
    issuer does not hold - the rest would just be options that fail on
    save. Template buttons replace the selection and **say** how many
    scopes they could not grant.
  - The tenant form is **templates only**, no raw scope checkboxes: the
    person issuing a key should be choosing "Billing export", not
    assembling a bundle out of permission keys they have no reason to
    understand. A template their role cannot fully grant renders
    disabled with the reason, rather than vanishing.
  - The console's own key is listed as *System Console*, so it is
    recognisable before someone revokes the credential their own
    session depends on.
- **Business Domains** page (System -> Business Domains), and `/` is now
  a client component that asks `public/site/resolve` which portal this
  hostname serves, falling back to the system login. Only the database
  knows which hostnames are tenant domains, so reading `Host`
  server-side could not answer it.
- `Label` accepts `required`, rendering a red asterisk. The asterisk is
  `aria-hidden` and the control keeps its own `required` /
  `aria-required`, so a screen reader announces the requirement from
  the field rather than reading out "star".


## [1.6.0] - 2026-11-17

### Changed

- **Renamed `frontend/` to `console/`**, and the package from
  `crm-template-frontend` to `crm-template-console`.
- **Configuration is now resolved at run time, not build time.**
  `next build` inlines every `process.env.NEXT_PUBLIC_*` read into the
  client bundles, which pinned a built Docker image to whichever API URL
  it was built with — compose `environment:` had no effect on it. The
  server now publishes the real values at `/runtime-config.js`
  (`src/app/runtime-config.js/route.ts`, `force-dynamic`), loaded with
  `beforeInteractive`, and `src/lib/runtime-config.ts` exposes them as
  lazy getters. One image now runs in any environment, and changing the
  API URL is a restart rather than a rebuild.
- `UPLOADS_ORIGIN` is replaced by `uploadUrl(path)`, collapsing 9
  repetitions of `` `${UPLOADS_ORIGIN}/uploads/${x}` `` across 6 files.
- **The app name now comes from the database.** The four visible brand
  sites read `useAppSettings().appName` instead of the build-time
  `APP_NAME` constant, and `use-app-settings.ts` prefers the DB row over
  the env var (it previously did the reverse, so the env value always
  won and the setting was unusable). `src/lib/app-name.ts` is deleted,
  and the root layout uses `generateMetadata()` so the tab title reflects
  the live value.
- `next.config.ts` adds `output: "standalone"` for a lean runtime image.

### Added

- **First-run setup wizard** at `/setup` — a five-step flow (welcome and
  reachability check, administrator account, branding with optional logo
  upload, options, review) that collects everything client-side and
  submits a single request, so a failure cannot half-initialize the
  instance. Built entirely from installed primitives: no new dependency
  and no new shadcn component.
- **Setup gating**: `useSetupStatus()` plus redirects in both session
  providers and both login pages send visitors to `/setup` until the
  instance is initialized, and `/setup` redirects back to sign-in once it
  is. Only a definite `false` redirects — an unreachable backend leaves
  the status unknown and changes nothing, so a hiccup cannot eject
  signed-in users into the installer.
- `setupUploadLogo()` and `setupInitialize()` clients, plus a small
  `Stepper` component.
- **Docker**: multi-stage `Dockerfile` (`dev` and `prod` targets) on
  `node:22-alpine`, its own `docker-compose.yml` stack, `.dockerignore`,
  and the `APP_*` runtime keys in `.env.example`.

### Removed

- **`/system/register`** and the "No account? Register" link on the login
  page. The page existed for unauthenticated first-admin creation, which
  the setup wizard now owns; authenticated creation already lives at
  `/system/dashboard/users`.


## [1.5.0] - 2026-07-13

### Added

- **DQ12 custom QR test screen** (`/tenant/settings/qr-devices`): the
  composer now also passes the receiver name through to
  `renderQrScreen()`, drawn on the generated preview/test canvas beneath
  the amount — previously only the amount and UPI ID were shown.

### Fixed

- **Mail Config** (`/tenant/settings/mail-config`): the "Add Mail Config"
  button now hides once the tenant already has one config, instead of
  just being permission-gated — mirrors the backend's new one-config-
  per-account limit so the button no longer opens a create dialog that's
  guaranteed to fail with a 400.

## [1.4.0] - 2026-07-09

### Added

- **Tenant Customers** pages, both surfaces: `/system/dashboard/tenant-customers`
  (all businesses, with a Business filter) and `/tenant/customers`
  (top-level nav item, like Users — not under Settings). A cascading
  Business → Place → Street `Combobox` chain feeds the map picker's
  reference circle; picture and ID-proof file inputs upload via the new
  generic upload endpoints and store just the returned path. Toolbar adds
  CSV Export/Import buttons (Import shows a results dialog listing
  per-row errors) and a "Change Status" row action separate from Edit/
  Delete/Restore. A "View Deleted" toggle (tenant side) / a "Deleted"
  status-filter option (system side) switches to the dedicated
  soft-deleted list, gated by the new `view_deleted` permission.
- **App Settings** admin page (`/system/dashboard/app-settings`): generic
  list/create/edit/delete/restore for the redesigned key-value config
  store, with a Value input that switches control per selected Data Type
  (text/textarea/number/Yes-No select/date-time pickers) and Key/Data
  Type locked once a row is created.

### Changed

- **Customization page** now reads/writes the `app.name`/`app.logo_path`
  keys through the new App Settings API instead of the old singleton
  endpoint — same UI, same behavior, permission checks moved from
  `system-settings:*` to `app-settings:*`.

## [1.3.0] - 2026-07-08

A tenant-facing portal alongside the existing system console, plus a full
set of tenant self-service settings pages mirroring their system-admin
counterparts.

### Added

- **Tenant portal**: `/tenant/login`, `/tenant/dashboard`, and a
  `TenantShell` layout (sidebar + top navbar + mobile drawer) parallel to
  the system dashboard shell. `useTenantSession()` (Context provider) and
  a namespaced `tenantApi` client keep a tenant session and a system-admin
  session independent in the same browser.
- **Tenant Settings** (`/tenant/settings/*`), permission-gated via a
  dedicated sub-nav: Account Settings (profile/phone/avatar), Business
  Information, Business Branches, Network Providers, Tax Types, Payment
  Modes, Income & Expense Categories, Mail Config, Places, Streets.
- **`/tenant/users`**: tenant admins manage the team members mapped to
  their own business (list/create/edit/delete/view), sidebar-linked from
  the tenant portal.
- **System dashboard admin pages** for every new resource: Tenant
  Business, Tenant Mapped Business, Tenant Tax Types, Tenant Payment
  Modes, Tenant Income & Expense Categories, Tenant Business Branches,
  Tenant Network Providers, Tenant Mail Config, Tenant Places, Tenant
  Streets, plus a Customization page (SaaS branding: app name/logo) under
  a new "Settings" sidebar section.
- **OpenStreetMap/Leaflet location picker** (`location-picker-panel.tsx`,
  `location-picker/leaflet-map.tsx`): address search via Nominatim, a
  draggable marker, and a live radius circle, swapped into the existing
  create/edit dialog instead of a nested `Dialog` (avoids a Radix
  dialog-stacking conflict). Streets additionally frames the parent
  Place's location/radius as a reference circle.
- **Searchable `Combobox`** (Popover + Command): replaces every plain
  scrollable `Select` used for business/tenant-user/role pickers across
  system and tenant-settings pages.
- **`RowActionsMenu`**: collapses per-row action buttons into a single
  "..." dropdown across every resource table (Edit/Delete/Restore/Login
  as/View, filtered to whichever the row and caller's permissions allow).
- **Row-detail "View" modals** (read-only, with an Edit shortcut),
  permission-gated by a dedicated `*:view` key: Tenant Business, Tenant
  Mapped Business, and both Tenant Users pages (system admin + tenant
  self-service).
- Role permission picker now groups permissions by module, with a
  per-module select-all (indeterminate when partially selected) and a
  search filter.
- `useAppSettings()` shows the configured app name as an eyebrow label
  above every `ResourceTable` title.
- System-admin "Login as" action opens the tenant portal in a new tab,
  signed in as the selected tenant user.

### Changed

- `useSession()`/`useTenantSession()` converted to Context providers so
  `/system/me`/`/tenant/me` are fetched once per navigation instead of
  once per consuming component (layout, nav, and page each used to fire
  their own request).
- `useResourceList` accepts an optional fetcher argument, so tenant-facing
  pages can point it at `tenantApi` instead of the system API client.
- Tenant Mapped Business simplified to one business per tenant user: a
  single searchable business picker instead of a multi-select checklist,
  and the admin table is now one row per mapping instead of grouped by
  user.

### Fixed

- Searchable `Combobox` didn't receive clicks or keystrokes while open
  inside a `Dialog` — a Radix Popover/Dialog focus-scope conflict caused
  by two divergent resolved versions of `@radix-ui/react-focus-scope`;
  fixed by setting the Popover's `modal` prop and deduping the package
  version.
- Hydration mismatch warning caused by browser extensions (e.g.
  Colorzilla) injecting attributes onto `<body>` before React hydrates.

## [1.2.0] - 2026-07-06

### Added

- Animated UI throughout via `motion` (Framer Motion): crossfade page
  transitions between dashboard sections, a sliding active-indicator in
  the sidebar nav, staggered dashboard stat cards, animated resource-table
  row enter/exit and loading/error/empty state crossfades, and entrance +
  shake-on-error animations on the login/register cards. Respects the OS
  "reduce motion" preference via `MotionConfig`.
- New `Skeleton` UI primitive (`components/ui/skeleton.tsx`).
  `ResourceTable`'s loading state now renders skeleton rows (desktop) or
  skeleton cards (mobile) matching the real layout instead of a bare
  spinner, and the dashboard's auth-guard loading state is a skeleton of
  the whole shell (sidebar, header, stat cards) instead of a spinner too.
- `ResourceTable` is mobile-responsive: below the `sm` breakpoint, System
  Users, Roles, and Permissions render as stacked cards instead of a
  horizontally-scrolling table.
- New Tenant Business admin page (`/system/dashboard/tenant-business`):
  full create/edit/delete/restore UI with status/country filters and
  column sorting, permission-gated like every other admin page. Includes
  a logo upload control — the first file-upload widget in the frontend,
  backed by the existing `/system/uploads` endpoint.

### Changed

- Default dialog width increased (`sm:max-w-lg` → `sm:max-w-2xl`) for
  create/edit modals; the Roles dialog widened further to `sm:max-w-3xl`
  for its permissions checklist. The delete-confirmation dialog keeps the
  previous compact width.
- Buttons show a subtle press/scale animation on click.
- `useResourceList` now accepts an optional second `filters` argument
  merged into the list query string (used by the Tenant Business page's
  status/country filters and sorting); existing callers are unaffected.

### Fixed

- Two-column form grids in the Users/Roles/Permissions create/edit
  dialogs didn't collapse on mobile (`grid-cols-2` with no `sm:`
  breakpoint), cramping fields on small screens.

## [1.1.0] - 2026-07-06

### Added

- Full create / edit / delete UI for System Users, Roles, and Permissions,
  each gated by the signed-in user's actual permission set (no create
  button, edit action, or delete action renders unless the backend grants
  that permission key).
- Sidebar navigation filters itself to only the sections the user has
  `*:read` access to.
- New shadcn/ui primitives: `Dialog`, `Select`, `Checkbox`, `Textarea`.
- `useSession().hasPermission(key)` helper for permission checks in
  components.
- `useResourceList` hook: pagination, search, and manual refresh for any
  list endpoint.
- Role edit form: scrollable multi-select checklist of all permissions.
- User edit form: role dropdown, optional password field, status control.
- Guardrails mirrored from the backend in the UI: system records
  (`isSystem: true`) lock their key fields and disable delete; a role
  with active users, or your own account, cannot be deleted from the UI.

### Changed

- `ResourceTable` is now a presentational component (rows/pagination/search
  passed in as props) with an optional toolbar action slot and per-row
  actions column, decoupled from data fetching.

## [1.0.0] - 2026-07-06

### Added

- Initial Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui scaffold.
- `/system/login` and `/system/register` pages; login redirects to
  `/system/dashboard`.
- Dashboard shell: responsive top navbar + sidebar (mobile slide-out
  `Sheet`) + main content area, with a stats overview page.
- Read-only, paginated, searchable list pages for System Users, Roles,
  and Permissions.
- Light / dark / system theme toggle via `next-themes`.
- API client (`src/lib/api.ts`): attaches the JWT bearer token and the
  mandatory `x-device-type` header, and transparently refreshes the
  access token once on a 401 using the CSRF-protected refresh endpoint.
- Client-side auth guard (`useSession`) that loads `/system/me` and
  redirects unauthenticated visitors to the login page.

[Unreleased]: ../../compare/frontend-v1.5.0...HEAD
[1.5.0]: ../../compare/frontend-v1.4.0...frontend-v1.5.0
[1.4.0]: ../../compare/frontend-v1.3.0...frontend-v1.4.0
[1.3.0]: ../../compare/frontend-v1.2.0...frontend-v1.3.0
[1.2.0]: ../../compare/frontend-v1.1.0...frontend-v1.2.0
[1.1.0]: ../../compare/frontend-v1.0.0...frontend-v1.1.0
[1.0.0]: ../../releases/tag/frontend-v1.0.0
