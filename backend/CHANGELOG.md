# Changelog

All notable changes to the backend are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.6.0] - 2026-11-23

### Added

- **Shapes.** Nine of them - rectangle, ellipse, triangle, diamond, pentagon,
  hexagon, star, arrow, chevron - each an SVG path in a UNIT SQUARE, listed in
  `id-card-shapes.ts` and served by `GET …/id-card-templates/shapes`. The
  designer draws the path with `viewBox="0 0 1 1"` and the renderer scales the
  same one, so adding a shape is a change to that single file and the console
  holds no copy to drift.

  The discriminator stays `type: 'rect'` with the shape in a separate field
  defaulting to `'rect'`, which is what makes every 3.5.0 layout parse
  unchanged.

- **Lines** as their own element type, since a line is a stroke with no fill:
  horizontal, vertical or diagonal within its box, solid/dashed/dotted.

- **Gradient fills**, linear and radial, for shape fills and side backgrounds.
  A fill is `string | { type, angle, stops[] }` - keeping the plain hex string
  as one arm of the union is what lets stored templates stay valid with no
  migration. Gradients are anchored to the element's own box, so the same fill
  reads the same on a 5mm dot and on a whole card.

- **`hidden` and `locked` on every element.** Hidden elements are skipped by
  the RENDERER, not just the canvas - a preview that disagreed with the PDF
  would be worse than no preview.

### Fixed

- **A shape drawn from a path did not appear in the PDF at all.** The first
  implementation scaled the canvas around `doc.path()`, but PDF requires path
  construction to be followed directly by a painting operator, so changing the
  CTM in between produced a stream renderers silently discard - no error, no
  log, just a missing shape. `scaleUnitPath()` rewrites the coordinates
  instead, which also keeps stroke widths uniform and gradient coordinates in
  page space. Caught by rasterising a test card and looking at it.

## [3.5.0] - 2026-11-23

### Added

- **Member ID cards.** A business designs its own card and the server renders
  one PDF per member. Two tables (migration 0010): `tenant_id_card_templates`
  holds the design, `tenant_member_id_cards` holds the generated file.

  A template stores TOKENS, never values - `member.memberNameTamil`, not a
  name - so one design renders every member and resolution happens at
  generation time, against the member and the association settings.

- **A private storage area, because /uploads is not private.** `main.ts`
  serves LOCAL_STORAGE_DIR through `useStaticAssets()` OUTSIDE the guard
  pipeline and the gateway proxies it, which is what lets an `<img src>` show
  a logo - and equally what makes everything there readable by anyone holding
  the URL. A card carries a photo, a phone number, an address and an Aadhaar's
  last four digits, so:
  - `PRIVATE_STORAGE_DIR` (default `storage/private`) is served by nothing.
  - `StorageService` takes a `scope: 'public' | 'private'`, and gained
    `readBuffer()` - it previously could not read a file back at all, which
    the renderer needs for logos, signatures and photos. Stored paths now
    reach `readFile` and `rm`, so they are checked for traversal rather than
    trusted from the database.
  - `GET .../member-id-cards/:id/download` is the ONLY way a card leaves the
    server, behind `tenant-member-id-cards:view`.
  - Its own Docker volume, since the api container is `read_only: true`,
    created and chowned before `USER node` like the upload tree.

- **The field catalogue is server-owned** (`id-card-fields.ts`), served by
  `GET .../id-card-templates/fields`, so the designer renders its palette from
  the server rather than a hardcoded list. For `association.*` the token IS
  the settingKey, so there is no second mapping to keep in step. An unknown
  token renders EMPTY - never the token text, never a throw - because a
  template outlives the catalogue.

- **Bulk generation**: explicit member ids (so the operator can see how many
  cards they are about to produce), capped at 250, returning one multi-page
  PDF for the print run while also storing each member's own card. The
  combined file is not stored - it is a disposable artefact of one run.

### Notes

- Fonts are bundled in `backend/assets/fonts` (Noto, OFL) and copied by the
  Dockerfile, because the prod filesystem is read-only and `nest build` emits
  only compiled TypeScript.
- Tamil shaping was verified before any of this was built: `க` + `ொ` emits
  `[ெ, க, ா]` and `ஸ்ரீ` collapses to one glyph. **Noto Sans Tamil has no
  Latin letters**, so the renderer splits text into same-script runs and picks
  the font per run - one font cannot draw "Member: ரமேஷ்".
- `pdf-lib` would NOT work here: it uses fontkit only to embed and subset, so
  it does no shaping at all.
- Permissions 122 -> 132 across 28 modules. `generate` is its own action for
  the reason `change_status` is.

## [3.4.0] - 2026-11-23

### Added

- **The rest of the association's address** - five settings at sortOrder
  251-255, between `association.stateId` and `association.officeAddress`:
  `districtId`, `talukId`, `placeId`, `streetId` and `pincode`. Broadest first,
  so the block reads as a hierarchy and fills top-down. No migration, no new
  permission.

  They slot into the gap rather than renumbering their neighbours because
  `syncSettingDefinitions()` only CREATES definitions the database lacks, and
  `tenant_business_settings` copies `sortOrder` at creation - so editing the
  sortOrder of a shipped row changes nothing on an instance that already seeded
  it.

- **`refParent`, so a `ref` picker narrows by another setting.**
  `listRefOptions()` takes a `parentId` and gains four cases beside `states`:
  `districts` (by state), `taluks` (by district), `places` (no parent) and
  `streets` (by PLACE). Both options routes take `?parentId=`.

  **A ref that needs a parent and is given none returns `[]`, never the
  unfiltered list.** Falling back to everything is the exact failure this
  prevents - it is what lets a Coimbatore district be filed under Kerala, and
  nothing downstream would reject the pair, since `ref` is a rendering hint and
  deliberately not a write rule.

  Note the chain forks: TenantPlace has no `talukId` - it is a geofence hanging
  off the business - and TenantStreet belongs to a PLACE. So Place is a second
  root and Street narrows by place, not by the taluk above it on screen.

- `association.pincode` is a STRING with `^[1-9][0-9]{5}$`, not an INTEGER: a
  PIN is an identifier, not a quantity.

## [3.3.0] - 2026-11-23

### Added

- **Association settings** - 25 per-business settings in three new categories.
  `Association` holds the name, short name, registration number, tagline,
  contact details, office address and four logos, each text field with a Tamil
  twin; `Signatures` holds one image per office-bearer; `Member Register`
  holds one flag. All of it is catalogue data, so there is **no migration** and
  **no new permission** - `npm run seed` creates the definitions and backfills
  every existing business.
- **`ref`, a setting that points at another record.** `association.stateId`
  holds a `tenant_states` UUID in a plain STRING, and the new
  `GET {tenant,system}/…/business-settings/options/:ref` serves the choices so
  the screen can render a picker instead of a UUID box. The server owns the
  ref-name-to-table mapping in `listRefOptions()`; an unknown ref returns `[]`
  rather than erroring, because `ref` is free text in the catalogue. Guarded by
  `tenant-business-settings:view` rather than reusing
  `GET /tenant/districts/states`, which would have made editing an address
  require `tenant-districts:list`.
- **`memberRegister.enabled` closes a business's own member register.** The
  tenant self-service surface refuses when it reads `'false'`; system staff are
  unaffected, because the flag is a business's choice about its own portal. An
  **unset** value means enabled, so a business whose backfill has not run is
  not locked out, and a caller mapped to several businesses sees the open ones
  rather than an error for all of them. `isSettingEnabled()` is the helper.

### Fixed

- **A blank value could not clear an optional setting.** Every submitted value
  was type-checked unconditionally, with a bypass for encrypted settings only -
  so clearing an `EMAIL` or `PHONE` failed validation (`''` fails the email
  pattern, and the phone pattern wants six characters) and, because the tenant
  screen saves a screenful in one transaction, one blanked field rolled back
  the entire form. Blank now stores `NULL` and skips the type check, which is
  safe because `isRequired` is a label here and was never enforced on any write
  path. The encrypted case still means "unchanged" and is kept deliberately
  separate.

### Changed

- Swagger examples for tenant business settings no longer reference the
  removed `customer.codeGeneration` setting.

## [3.2.0] - 2026-11-23

### Added

- **The membership register** (`tenant_members`, migration 0009). Names in
  both scripts, the business they trade as, their association position and
  industry, contact details, the full geography chain, dates of birth and
  marriage, a passport photo and a membership lifecycle.
- **Aadhaar is encrypted AND deduplicated**, which takes three columns because
  the two goals are at odds. GCM uses a random IV, so the same number encrypts
  differently every time - exactly what confidentiality wants and exactly what
  makes `@@unique` useless. So: `aadhaarNumber` holds the ciphertext,
  `aadhaarHash` an HMAC-SHA256 blind index that restores equality, and
  `aadhaarLast4` the four digits a screen shows. The first two never leave the
  server; publishing the hash would hand out an offline oracle against a 10^12
  space.
  - `@@unique([tenantBusinessId, aadhaarHash])` catches the same person
    enrolled twice. The check ignores soft-deleted rows, like the street-code
    check: a deleted member still holds their number, so restoring them cannot
    collide with someone enrolled since.
  - What this costs: a blind index answers equality and nothing else, so
    member search covers names, phone and email but never the Aadhaar.
- **`deriveSecondaryKey()`** in the encryption util - HKDF with a distinct
  label, so the index key and the encryption key are independent and neither
  can be recovered from the other.
- **`change_status` as a seventh action**, with its own endpoint. Suspending a
  member is a different act from correcting their phone number, and you would
  plausibly grant one without the other. A new member starts PENDING; a
  restored one returns to PENDING rather than ACTIVE, because a membership
  that was deleted deserves another look.

Permissions: 115 -> 122 across 26 modules.

### Notes on two decisions

- **Dates are YYYY-MM-DD strings, not epochs.** A birth date is not a moment,
  and each business picks its own timeZone setting - an epoch DOB renders as
  the previous day in a negative offset. This reuses the format the settings
  store already validates and `<input type="date">` already emits.
- **isMarried/weddingDate is enforced twice on purpose.** The create schema
  rejects a wedding date on an unmarried member; the service re-derives both
  on update, because a PATCH may carry either field or neither and only the
  stored row knows the rest. Without the second, clearing the flag would leave
  the old date behind.

## [3.1.0] - 2026-11-23

### Added

- **Tenant Association Positions** (`tenant_association_positions`) — a
  per-business lookup of the positions members hold, with an English name, an
  optional Tamil name and a remark. Built on the Tenant Places pattern: one
  model, one service, two controllers sharing the
  `tenant-association-positions:*` namespace.
  - `system/tenant-association-positions` (list/get/create/update/delete/restore)
    and `tenant/association-positions` (the same minus restore, which is
    system-only, and plus `GET businesses` for the create form's picker).
  - **6 new permissions in 1 module**, so the catalogue is now **91 keys across
    21 modules**. `SYSTEM_SUPER_ADMIN` holds 91, `TENANT_ADMIN` 39. The tenant
    grant needed only one word: `TENANT_ROLE_PERMISSION_KEYS` loops over a
    resource-name array building `tenant-${resource}:${action}`, so
    `'association-positions'` produces exactly the five non-restore keys.
  - Nothing references the table yet. It is the list an assignment will point
    at once we decide where that belongs — a tenant user is not itself
    business-scoped, reaching a business through `tenant_mapped_business` and
    possibly several, so the position cannot simply hang off the user.

- **Tamil names on places and streets** — `placeNameTamil` and
  `streetNameTamil`, both optional. With `positionNameTamil` these are the
  first localised fields in the schema, and they set the shape: same `VarChar`
  length as the English sibling (Postgres counts *characters*, not bytes, so
  100 Tamil characters fit exactly as 100 Latin ones do), nullable, and ORed
  into the list search so either spelling finds the record.

- Migration `0007_tenant_association_positions` — one `CREATE TYPE`, one
  `CREATE TABLE` with its FK and two indexes, and two `ALTER TABLE … ADD
  COLUMN`. Both altered tables were empty and both columns are nullable, so no
  backfill.

### Changed

- `tenant-places` and `tenant-streets` now accept and persist their Tamil name
  on create as well as update. Their `create()` methods list columns
  explicitly, so the field had to be named there — unlike `update()`, which
  spreads the DTO and would have worked by accident.
- Both services search the Tamil column alongside the English one, on **both**
  the system and the tenant surface. Each service carries the clause twice;
  patching only the first is the classic half-fix here.

## [3.0.0] - 2026-11-22

### Removed

- **BREAKING - the tenant customers feature is gone.** Deleted
  `src/tenant-customers/` (7 files, 1,158 lines), its registration in
  `app.module.ts`, and both route surfaces: `system/tenant-customers` and
  `tenant/customers`, each with CRUD plus `places`, `streets`, `deleted`,
  `export`, `import`, `:id/status` and `:id/restore`. They now 404.
  - **BREAKING - migration `0006_remove_tenant_customers`** drops
    `tenant_customers`, its three foreign keys and its three enums
    (`TenantCustomerGender`, `TenantCustomerType`, `TenantCustomerStatus`).
    The table was empty.
  - **Places and streets deliberately survive.** A street still belongs to a
    place, and both keep their own CRUD, permissions and screens; only their
    customer consumer went away.
  - **9 permission keys removed**, leaving **85 across 20 modules**.
    `SYSTEM_SUPER_ADMIN` holds 85, `TENANT_ADMIN` 34. `'tenant-customers'`
    was appended to `REMOVED_PERMISSION_MODULES`, so every install drains the
    rows and their grants on the next seed.
  - The three `customer.*` setting definitions go with it, leaving **5**
    definitions across General and Tax.
  - `csv-parse` and `csv-stringify` dropped from `package.json` — the two
    deleted controllers were their only consumers.

### Added

- **`REMOVED_SETTING_DEFINITIONS`** in `src/common/constants/setting-definitions.ts`,
  drained by `cleanupRemovedSettingDefinitions()` at bootstrap. Taking a key out
  of `SETTING_DEFINITIONS` only stops it being *created* — `syncSettingDefinitions()`
  never deletes, because it must not clobber a value a business chose. Retiring
  a setting therefore has to be said out loud, exactly as
  `REMOVED_PERMISSION_MODULES` already does for permissions. It deletes the
  per-business values before the definitions, since the FK runs that way.

### Fixed

- **The sidebar clipped its last entries and squashed its footer.** The `aside`
  is `h-dvh flex-col`, but its brand header and footer were both shrinkable and
  its nav lacked `min-h-0`, so once the nav outgrew the viewport the footer was
  squeezed and the bottom entries were pushed out of reach — which is why
  "Setting Definitions" and "Business Settings" appeared to be missing from the
  system portal despite rendering correctly and passing their permission check.
  `shrink-0` on the header and footer, `min-h-0` on the scroller, in both the
  system layout and the tenant shell.

### Removed (dead code)

- `consumeSequenceNumber()` from `TenantBusinessSettingsService`. It existed to
  allocate `customer.nextCode` and **never had a caller** — the customers
  service generated codes by hand. With the setting gone, a locking-read helper
  nothing uses was a liability.

### Corrected

- A comment added in 2.1.0 claimed a tenant grant removed by hand "is not
  silently restored on the next seed". That is backwards:
  `grantMissingToRole()` targets the declared list, so a key still in
  `TENANT_ROLE_PERMISSION_KEYS` **does** come back. The comment and
  `docs/logic/rbac-permissions.md` now say so.

## [2.1.0] - 2026-11-21

### Added

- **Per-business settings**, ported from the IPTV reference project. Until now
  the only settings store was platform-wide `app_settings`, so anything a
  single business might configure needed either a hardcoded constant or a new
  column and migration.
  - **Three tables** (migration `0005_tenant_business_settings`):
    `setting_definitions` (the catalogue), `tenant_business_settings` (one row
    per business per definition) and `tenant_business_setting_sync_logs` (what
    each backfill did, including what it skipped).
  - **Nine endpoints** across three modules: `system/setting-definitions`
    (list/get/create/update - no delete, see below), system
    `tenant-business-settings` (cross-tenant list/get/update) and tenant
    `business-settings` (own list + batch update), plus `system/settings-sync`
    (run + logs).
  - **8 new permissions across 3 modules**, so the catalogue is now **94 keys
    across 21 modules**. `TENANT_ADMIN` holds
    `tenant-business-settings:view|update` but deliberately not `:list`, which
    is the system-side cross-tenant view.
  - **Eight seeded definitions** in `src/common/constants/setting-definitions.ts`,
    in three categories: `timeZone` / `dateFormat` / `currencyCode` (General),
    `customer.codeGeneration` / `codePrefix` / `nextCode` (Customers) and
    `tax.taxPerItem` / `tax.enableInclusiveTaxesByDefault` (Tax). Adding one is
    a one-line change there plus `npm run seed`; the screen renders from
    `valueType` and `validationRules`, so a setting with an `enum` rule arrives
    as a working dropdown with no UI code.
  - `getSettingsMapForBusiness()` is how application code reads settings. It
    deliberately does **not** fall back to a definition's `defaultValue` - the
    default is applied once at copy time, so a missing row reads as absent and
    each caller defaults in code.
  - `consumeSequenceNumber()` allocates read-only counters with a locking
    `SELECT … FOR UPDATE` inside the caller's transaction, so a failed insert
    does not burn a number.
  - Encrypted definitions use the existing AES-256-GCM
    `common/utils/encryption.util.ts` and are masked to an empty string in
    every response; a blank submitted value means "unchanged", never "clear
    it".

### Changed

- **`TenantBusinessService.create()` is now transactional.** It was a bare
  `prisma.tenantBusiness.create()`; it now creates the business and copies
  every ACTIVE definition's default in one transaction, so a failure to seed
  the settings takes the business with it rather than leaving one that renders
  an empty settings screen.
- **`syncPermissionsAndGrants()` now back-fills `TENANT_ADMIN` too**, from
  `TENANT_ROLE_PERMISSION_KEYS`, and reports setting-definition counts. It only
  ever back-filled `SYSTEM_SUPER_ADMIN`, so a key added to the tenant list
  after setup existed as a row nobody held and its portal screen 403'd with
  nothing to explain why. Only keys the list declares are granted, so a grant
  removed on purpose through the Roles UI is not silently restored.
- A setting definition cannot be deleted, and its `settingKey` and `valueType`
  cannot be edited: businesses hold copies keyed by the one and validated
  against the other. Retire it with `status=INACTIVE` instead.

### Notes on the port

Divergences from the reference, each deliberate: `@db.VarChar` + Prisma
`mode: 'insensitive'` instead of `@db.Citext` (and so no `::citext` cast in the
counter's raw query); no `systemCode` index suffix in bulk inserts, because
`newSystemCode()` now carries a process-local counter; no Redis cache
invalidation or channel re-ranking, neither of which exists here; `FILE`
settings validated for path shape rather than per-business folder ownership,
since there is no upload-folder subsystem; the definitions live in
`common/constants/` rather than the seed script, per this project's "catalogue
in one place" rule. The reference's `view-count-format`, `live-realtime` and
subscription-plan `ref` picker are IPTV-specific and were not ported.

## [2.0.0] - 2026-11-21

### Removed

- **BREAKING - five tenant resources are gone**: tax types, payment modes,
  income & expense categories, business branches and network providers. A tent
  dealers' and decorators' association has no use for them, and they were 5 of
  the 18 entries crowding one sidebar section.
  - Deleted `src/tenant-tax-types/`, `src/tenant-payment-modes/`,
    `src/tenant-in-ex-categories/`, `src/tenant-business-branches/` and
    `src/tenant-network-providers/` (30 files, ~2,900 lines), and their
    registrations in `app.module.ts`.
  - Gone with them: `GET/POST/PATCH/DELETE` on
    `/system/tenant-{tax-types,payment-modes,in-ex-categories,business-branches,network-providers}`
    and the tenant self-service twins at
    `/tenant/{tax-types,payment-modes,in-ex-categories,business-branches,network-providers}`.
    They now 404.
  - **32 permission keys removed**, so the catalogue is **86 keys across 18
    modules** (was 118 across 23). `SYSTEM_SUPER_ADMIN` holds 86;
    `TENANT_ADMIN` drops from 65 to 40. The five module names were appended to
    `REMOVED_PERMISSION_MODULES`, so `cleanupRemovedPermissions()` hard-deletes
    the rows **and** their `role_permissions` grants at the next bootstrap -
    every install self-heals on `npm run seed`, not just one database.
  - `delete_system` now exists on `permissions` and `roles` only; payment modes
    and in/ex categories were the other two holders.

### Changed

- **BREAKING - migration `0004_remove_unused_tenant_resources`** drops the five
  tables, their five foreign keys to `tenant_business`, and all eight of their
  Postgres enum types. No surviving model referenced them - the only coupling
  was five back-relation arrays on `TenantBusiness`, which carry no columns -
  so no other table changed. All five were empty when dropped.

### Fixed

- **The documented seed command never ran the seed.** The `migrate` service
  pins `entrypoint: ['npx', 'prisma']`, so
  `run --rm migrate node dist/prisma/seed` resolved to
  `npx prisma node dist/prisma/seed` - which prints Prisma's help and exits 0,
  seeding nothing and reporting success. It now reads
  `run --rm --entrypoint node migrate dist/prisma/seed`, corrected in
  `docker/services/api/compose.yml`, `docs/guide/docker.md` and
  `docs/guide/setup-wizard.md`.
- **`newSystemCode()` could silently drop a permission row.** It appended only
  4 hex characters of randomness to a shared `Date.now()`, and
  `syncPermissions()` inserts the whole catalogue in one
  `createMany({ skipDuplicates: true })` where `systemCode` is `@unique`. At
  118 rows per batch that is a ~10% birthday collision, and `skipDuplicates`
  turns the loser into a missing row rather than an error. It had already
  happened: `tenant-users:read` was absent from an install, so no role could
  hold it and the "Tenant Users" nav item was invisible with nothing in the
  logs. Codes now carry a process-local counter (making a single batch
  collision-proof) plus 6 hex characters instead of 4.

## [1.9.0] - 2026-11-21

### Changed

- **Rebranded from "CRM Template" to FTTDDWA** (Federation of Tamilnadu Tent
  Dealers & Decorators Welfare Association). `APP_NAME` now defaults to
  `FTTDDWA`, which is what the Swagger title, the console browser tab and the
  console sidebar render. The package is `fttddwa-backend`.
- **BREAKING - the database is renamed.** `POSTGRES_USER` is now `fttddwa` and
  `POSTGRES_DB` is `fttddwa_db` (was `crm` / `crm_template_db`). Those two are
  read only when the data volume is first initialised, so an existing
  deployment needs either `down -v` and a fresh `/setup`, or a manual
  `ALTER DATABASE ... RENAME` plus `ALTER ROLE ... RENAME` inside the
  container. No schema or migration change: every table was already mapped to
  an unbranded snake_case name.
- **BREAKING - API-key tokens have a new prefix.** `KEY_BRAND` is now
  `fttddwa`, so tokens are spelled `fttddwa_live_<8 hex>.<secret>` instead of
  `crm_live_...`. Every previously issued key stops verifying, the console's
  own included; reissue with `npm run console-key`.
- Docker identifiers are all `fttddwa-*`: compose projects (`fttddwa`,
  `fttddwa-data`, `fttddwa-backend`, `fttddwa-edge`), containers
  (`fttddwa-postgres`, `fttddwa-api`), the `fttddwa-api` image, the
  `fttddwa-app`/`fttddwa-data`/`fttddwa-proxy` networks and the
  `fttddwa-postgres-data`/`fttddwa-uploads`/`fttddwa-caddy-*` volumes.
  `docker/edge/Caddyfile` tracks the new container hostnames, which it
  hardcodes rather than interpolating.

### Added

- **`src/common/constants/key-brand.ts`**: `KEY_BRAND` moved out of
  `ApiKeysService` into a file that imports nothing. `bootstrap.ts` had been
  re-typing the `crm_live_` literal instead of reading the constant, which
  could drift from the guard that parses it; it now imports the constant. The
  neutral file is required because `bootstrap.ts` is also imported by the
  standalone `prisma/seed.ts`, which cannot load `PrismaService`.
  `ApiKeysService` re-exports it, so `ApiKeyGuard`'s import site is unchanged.

### Fixed

- `.env.example`: `POSTGRES_HOST_PORT` was `5432`, contradicting its own
  comment, the compose default (`:-5433`) and every doc, which all say `5433`.
  It and the host-native `DATABASE_URL` now both say `5433`, so `npm run dev`
  reaches the container and nothing collides with a natively installed
  Postgres on 5432.

### Unchanged on purpose

- `HKDF_INFO` / `HKDF_SALT` in `src/common/utils/encryption.util.ts` keep the
  original `crm` slug. They are key-derivation inputs, never displayed, and
  changing either would make every encrypted `app_settings` row unreadable.
- `api_key_scope_templates` and the `api-key-scope-templates` permission key:
  "template" there is the scope-set feature, not the old product name.

## [1.8.0] - 2026-11-18

### Added

- **API keys** (`src/api-keys/`): machine credentials for external
  applications, as a **fifth global guard** placed before the session
  guards so an unknown client is rejected without the cost of resolving
  a user and its role permissions. System CRUD at `/system/api-keys`
  and tenant self-service at `/tenant/api-keys` (list, view, create,
  update, rotate, revoke), six new `api-keys:*` permissions, all of
  them tenant-visible.
  - `ApiKeyGuard` **fails closed**: every route needs a valid key
    unless it carries the new `@SkipApiKey()`. Four routes do, each
    because the caller cannot present one - `system/setup/*`,
    `system/health`, `public/site/allowed` (Caddy's TLS check is a bare
    GET that cannot set headers) and `public/site/resolve`.
  - `@SkipApiKey()` and `@Public()` are **different axes**: one skips
    the key, the other the JWT.
  - Token shape `crm_<type>_<8 hex>.<secret>`, with the public prefix
    as the unique lookup column. Only a **SHA-256** hash of the secret
    is stored - deliberately not Argon2id, because the secret is 32
    bytes of CSPRNG output with no guess space for a slow KDF to
    protect, and verification runs on every request where a slow hash
    would be a CPU-exhaustion lever.
  - A key is always a **subset of its issuer**, enforced server-side
    because the scope list arrives in the request body. On a business
    key the stored scopes are also intersected with the owning role's
    *current* permissions at verify time, so revoking a permission from
    a role narrows every key that leaned on it on the next request.
  - No `EXPIRED` status member: expiry is derived from `expiresAt` and
    the clock in every response rather than stored as a second source
    of truth. Revoking scrubs the stored hash outright, so the row
    cannot authenticate again even if a future query forgets the status
    check. Usage stamps are fire-and-forget and throttled to once a
    minute per key, so `usageCount` is sampled rather than exact.
- **API key scope templates** (`src/api-key-scope-templates/`): named
  scope bundles, with five `api-key-scope-templates:*` permissions.
  System-authored only; the tenant surface is read-only and gated on
  `api-keys:create`, since that list exists only to fill the key form.
  `GET permission-catalogue` returns the catalogue unpaged, because the
  ordinary permission list caps at 100 and a silently truncated
  catalogue produces templates missing scopes nobody noticed were
  absent. Removing a template never changes a key already issued from
  it - a template is a shortcut at creation time, not a live link.
- **The setup wizard issues the console's own API key**, so there is no
  env var to configure and nothing to keep in step between two files.
  `bootstrapInstance()` creates it in the same transaction as the first
  admin - an instance with an account but no console key would sign in
  and then 401 on everything - and stores the whole token encrypted in
  `app_settings['console.api_key']`.
  `GET /system/setup/status` serves it back at run time, so a reissued
  key is picked up on the console's next load with no rebuild. It is
  served unauthenticated because the console is a public web app that
  cannot hold a secret the browser does not see: a key states which
  *application* is calling, and every console route still requires a
  session and its permissions.
- **`npm run console-key`** (`node dist/prisma/console-key.js` in the
  image) reissues it, for an instance that predates the key
  requirement, one whose console key was revoked, or one whose
  encryption key changed. `npm run seed` also issues one when missing,
  so the upgrade path is the same command as for a new permission.
- **`src/common/utils/encryption.util.ts`**: AES-256-GCM with
  `SETTINGS_ENCRYPTION_KEY` (64 hex). **Optional** - when unset the key
  is derived from `JWT_ACCESS_SECRET` by HKDF, so a fresh install needs
  no file edited before the wizard can run. Documented consequence:
  with the fallback, rotating `JWT_ACCESS_SECRET` makes every stored
  encrypted value unreadable.
- **Reserved app settings.** `console.api_key` is excluded from the App
  Settings list and single-row reads, and refused by create: it holds a
  live credential, so listing it would put one on screen and editing it
  through a text box would lock the console out of its own API.
- **Tenant business domains** (`src/site/`, `src/tenant-business-domains/`):
  the endpoint the Caddy edge was already asking for.
  `GET public/site/allowed` answers its on-demand TLS check (200/404,
  guarded by `EDGE_ASK_KEY` compared in constant time) and
  `GET public/site/resolve` tells the console's root page which portal
  a hostname serves. Hostnames are normalized on write *and* on lookup,
  the domain list is cached 15s and invalidated on save, and every
  refusal is logged with what to do about it - a refusal otherwise
  reaches the browser only as `ERR_SSL_PROTOCOL_ERROR`. Five
  `tenant-business-domains:*` permissions, system-admin only.
- **`syncPermissionsAndGrants()`** in the shared bootstrap, and
  `prisma/seed.ts` now calls it on an already-initialized instance
  instead of returning early. `npm run seed` is therefore an idempotent
  permission sync - without which a running instance would never
  receive new permission rows and every new UI would 403 with no
  obvious cause.

### Changed

- The permission catalogue is **118 keys across 23 modules**, up from
  107 across 21.
- The guard chain is now `DeviceAwareThrottlerGuard` ->
  `DeviceHeaderGuard` -> `ApiKeyGuard` -> `JwtAuthGuard` ->
  `PermissionsGuard`.
- `DeviceAwareThrottlerGuard` reads the **raw** `x-device-type` header
  rather than `request.deviceType`: it runs before `DeviceHeaderGuard`,
  so that property is not set yet. It is a capacity knob and not a
  security control - the value is client-supplied.

### Security

- `TenantBusinessDomain` is **hard-deleted**, the one documented
  exception to the soft-delete convention: a soft-deleted row would keep
  holding the unique hostname and block a legitimate re-claim.
  `enabled` covers turning one off without losing it.
- Domain CRUD is **system-admin only**, with no tenant self-service
  twin. Letting a tenant claim arbitrary hostnames would let them assert
  ownership of a name they do not control and have the edge request a
  certificate for it.
- Creating a domain refuses any hostname in `SYSTEM_PORTAL_HOSTS` -
  without that check an admin could point the console's own domain at a
  tenant portal and lock themselves out.

## [1.7.0] - 2026-11-17

### Changed

- **PostgreSQL only.** `prisma/schema.prisma` now declares
  `provider = "postgresql"`, and `AppSetting.value` moved from the
  MySQL-only `@db.LongText` to `@db.Text` — the single type that
  blocked the switch. MySQL is no longer supported, and the
  documentation-only `DATABASE_PROVIDER` env var (read by nothing) is
  gone.
- **Case-insensitive matching restored.** MySQL's default collation made
  `LIKE` and unique lookups case-insensitive; Postgres does not. All 68
  `contains:` list filters across 16 services now pass
  `mode: 'insensitive'`, as do the login lookups and the
  username/email uniqueness checks — so `Admin` and `admin` still
  cannot coexist, and searching `JOHN` still finds `john`.
- **Bootstrap creates exactly one role**, `SYSTEM_SUPER_ADMIN`, holding
  all 102 permissions, replacing the former `SUPER_ADMIN` /
  `SYSTEM_USER` / `TENANT_ADMIN` trio. A tenant-visible `TENANT_ADMIN`
  is optional and off by default. Neither guard has a super-admin
  bypass, so the role holds every grant for real.
- `getBrandingPublic()` now prefers the DB `app.name` row over the
  `APP_NAME` env var. It previously ignored the row entirely, which
  made the app name deploy-time-only and left the App Settings page
  writing a value nothing displayed.
- `main.ts` binds `0.0.0.0` explicitly, registers
  `enableShutdownHooks()` so SIGTERM from `docker stop` closes Prisma
  connections cleanly, and warns when `CORS_ORIGINS` is empty instead
  of silently disabling CORS.
- `prisma` moved from `devDependencies` to `dependencies`, so
  `prisma migrate deploy` works in an image built with
  `npm ci --omit=dev`.

### Added

- **Docker**: multi-stage `Dockerfile` (`dev` and `prod` targets) on
  `node:22-bookworm-slim`, `docker/entrypoint.sh` (composes
  `DATABASE_URL` from `POSTGRES_*` and applies migrations on boot),
  `.dockerignore`, and the Docker keys in `.env.example`. Compose is
  split into per-service stacks under `docker/data/` and
  `docker/services/`, aggregated by the repository-root
  `docker-compose.yml` via `include:`. The database name has a single
  source of truth in `POSTGRES_DB`.
- **Prisma migrations**: the project previously had no migration history
  and relied on `prisma db push`. A Postgres baseline now lives in
  `prisma/migrations/` and containers apply it with `migrate deploy`.
- **First-run setup API** (`src/setup/`): `GET /system/setup/status`,
  `POST /system/setup/logo`, `POST /system/setup/initialize`. Public but
  permanently `409` once a system user exists. `initialize` runs in one
  transaction (password hashed beforehand, so argon2 never holds it
  open), so a failure cannot leave a half-initialized instance.
- **Health endpoint**: `GET /api/v1/system/health` returning
  `{ status, db }`, backing the Docker healthcheck.
- **Boot-time env validation** (`src/config/env.validation.ts`): a Zod
  schema wired into `ConfigModule`. Rejects short or placeholder JWT
  secrets, a non-Postgres `DATABASE_URL`, an empty `CORS_ORIGINS`, and
  missing `S3_*` when `STORAGE_DRIVER=s3`.
- **Shared RBAC bootstrap**: the permission catalogue moved out of
  `prisma/seed.ts` into `src/common/constants/permissions.ts`, and the
  bootstrap itself into `src/common/bootstrap/bootstrap.ts`. The seed
  and the setup wizard now share one implementation, so they cannot
  drift.

### Removed

- **`POST /system/register`** and its DTO and service method. It was
  `@Public()` and made whoever registered first a `SUPER_ADMIN` — an
  open installer that stayed open forever. The setup wizard owns first
  admin creation, and `POST /system/users`
  (`system-users:create`) already handled authenticated creation.
- The seeded `app.logo_path` pointing at a gitignored file, which gave
  every fresh clone a broken logo. The wizard writes it only when a
  logo is actually uploaded.


## [1.6.0] - 2026-07-13

### Fixed

- **Tenant Mail Config**: tenant self-service `POST /tenant/mail-config`
  now rejects a second config with a 400 (`Only one mail config is
  allowed per account...`) if the caller's business already has a
  non-deleted one — previously nothing stopped a tenant from creating
  several, even though only one was ever actually used to send mail.
  System-admin creation (`POST /system/tenant-mail-config`) is
  unaffected and still allows multiple.

## [1.5.0] - 2026-07-09

### Added

- **Tenant Customers** (`tenant_customers`): the largest dual-surface
  resource yet — customer records scoped to a tenant business, with a
  cascading Place → Street picker (`tenantPlaceId` optional,
  `tenantStreetId` optional but must belong to the chosen place), KYC/tax
  fields, four notification/access flags, and a map-pickable
  latitude/longitude. Nine permissions (not the usual six): `create`,
  `view`, `update`, `delete`, `view_deleted`, `restore`, `export`,
  `import`, `change_status`.
  - `GET /system/tenant-customers/deleted` (and the tenant-scoped twin)
    is the only way to see soft-deleted rows — the normal `GET` list
    always excludes `DELETED` regardless of any `status` query param,
    gated by the new `view_deleted` permission instead of `view`.
  - `PATCH .../:id/status` changes status to `ACTIVE`/`INACTIVE`/`BLOCKED`
    only, kept separate from the full `PATCH` update and from
    delete/restore.
  - `GET .../export` streams a CSV of the current filtered list;
    `POST .../import` accepts a CSV upload and validates each row
    independently — a bad row is skipped and reported by row number
    rather than aborting the whole batch.
- **Tenant Uploads** (`POST /tenant/uploads`): a generic tenant-scoped
  file upload endpoint (mirrors the system `/system/uploads`), gated only
  by a valid tenant JWT (no extra permission) so any authenticated tenant
  user can upload a customer photo or ID-proof file and get back a
  storage path.
- **App Settings redesign** (`app_settings`): replaced the fixed-shape
  `AppSettings` branding singleton with a generic typed key-value store —
  `key` (unique), `dataType` (`STRING`/`TEXT`/`INTEGER`/`DECIMAL`/
  `BOOLEAN`/`JSON`/`DATE`/`DATETIME`/`TIME`), `value` (validated against
  `dataType` on write), `description`, soft-delete `status`. `key` and
  `dataType` are immutable after creation.
  - `GET /system/app-settings/public/branding` replaces the old
    `GET /system/settings` — same public, unauthenticated
    `{ appName, logoPath }` response shape, now backed by the `app.name`
    and `app.logo_path` keys internally so nothing downstream had to
    change.
  - Full CRUD + restore under `/system/app-settings`, plus
    `GET .../key/:key` (look up a setting by its key) and
    `POST .../logo` (upload/replace the app logo, upserting the
    `app.logo_path` row).
  - The existing branding row's values were carried forward as the first
    two seeded rows rather than lost in the schema change.

### Changed

- Permission module `system-settings` (`view`/`update`) replaced by
  `app-settings` (`create`/`view`/`update`/`delete`/`list`/`restore`).

## [1.4.0] - 2026-07-08

A tenant-facing portal and a full set of business-scoped resources, all
following the same dual-surface pattern established here: one Prisma
model + one shared service, exposed through a system-admin controller
(unrestricted) and a tenant self-service controller (scoped to the
caller's own mapped business), sharing one permission-key namespace.

### Added

- **Tenant portal & auth**: a parallel tenant-facing auth audience, fully
  namespaced so a tenant session and a system-admin session coexist in the
  same browser — `TenantJwtStrategy` (`jwt-tenant`), its own
  `tenant_refresh_tokens` table, distinct cookie names
  (`tenant_refresh_token`/`tenant_csrf_token`), and a separate
  `@RequireTenantPermissions`/`TenantPermissionsGuard` pair (own metadata
  key, never evaluated by the system `PermissionsGuard`). `POST
  /tenant/login`, `/tenant/refresh`, `/tenant/logout`, `GET /tenant/me`,
  `GET /tenant/dashboard`. Seeded `tenant-dashboard:view` permission and a
  default `TENANT_ADMIN` role (`visibleToTenants`).
- **"Login as" impersonation**: `POST /system/tenant-users/:id/login-as`
  issues a tenant session for a given tenant user without their password
  (`tenant-users:login-as` permission), for system-admin support use.
- **Tenant Business** (`tenant_business`): full CRUD + restore, contact/
  address fields, optional logo, `isParentBusiness` flag, filtering by
  `status`/`country`/`isParentBusiness` and sorting. Tenant self-service
  surface added later for a caller to view/update their own business
  profile (`isParentBusiness`/`status` stay system-admin-only).
- **Tenant Mapped Business** (`tenant_mapped_business`): links a tenant
  user to a business (unique per tenant user — one business at a time),
  list/view/create/update/delete/restore.
- **Tenant Account** self-service (`tenant-account:view/update`): tenant
  users manage their own name/username/email/phone/password/avatar.
- **Tenant Tax Types** (`tenant_tax_types`): `taxName`, `calculationType`
  (PERCENTAGE/FIXED), `value`, `description`.
- **Tenant Payment Modes** (`tenant_payment_modes`): adds an `isSystem`
  flag (never client-settable) that protects system-seeded rows from
  tenant edit/delete on both controllers.
- **Tenant Income & Expense Categories** (`tenant_in_ex_categories`,
  originally shipped as `tenant_expense_categories`): adds a `type`
  (INCOME/EXPENSE) and a frontend-derived `inExCode`.
- **Tenant Business Branches** (`tenant_business_branches`): branch name,
  contact, address, description.
- **Tenant Network Providers** (`tenant_network_providers`): `type` ENUM
  (CABLE_TV/ISP/IPTV/OTHERS), name, contact, address (only name/type
  required).
- **Tenant Mail Config** (`tenant_mail_config`): SMTP settings
  (`mailHost`/`mailPort`/`mailUsername`/`mailPassword`/`mailEncryption`/
  `fromMailAddress`/`fromMailName`). `mailPassword` is write-only — reads
  return a `hasPassword` boolean instead. `POST .../:id/test-email`
  (`tenant-mail-config:test`) sends a real test email via nodemailer and
  surfaces SMTP errors. No restore endpoint (soft-delete only, per spec).
- **System Settings / SaaS customization**: an `AppSettings` singleton
  (`appName`, `logoPath`) with a public unauthenticated `GET` (so the
  branding can render anywhere) and a permission-gated `PATCH` +
  logo-upload for system admins (`system-settings:view/update`).
- **Tenant Places** (`tenant_places`): `placeName`, `remark`, and
  `latitude`/`longitude`/`radiusMeters` for geofencing.
- **Tenant Streets** (`tenant_streets`): scoped to a business and a place
  within it (server-validated so a street's place must belong to its
  business); a unique 3-letter `streetCode` per business.
- **Tenant Users self-service** (`/tenant/users`): tenant admins manage
  the users mapped to their own business, reusing the existing
  `tenant-users:{create,read,update,delete}` permission keys — creating a
  user auto-maps it to the caller's business, and callers can't delete
  their own account. New `tenant-users:view` permission gates a read-only
  detail view (additive; doesn't change any existing route's required
  permission).
- `backend/scripts/free-port.js`: frees port 4000 before `npm run dev` /
  `start:dev` (wired as `predev`/`prestart:dev`), so a leftover
  `node dist/src/main` instance no longer blocks the dev server with
  `EADDRINUSE`.

### Changed

- Tenant-scoped Payment Mode / Income & Expense Category listings now
  treat `isSystem: true` rows as global defaults, visible to every tenant
  user regardless of which business they're mapped to.
- `tenant_mapped_business` restricted to one active business per tenant
  user (unique constraint changed from a composite key to `tenantUserId`
  alone); create/update simplified to a single `tenantBusinessId`.

### Fixed

- Payment Modes: `isSystem` rows could still be **edited** even though
  delete was already blocked — update is now guarded too.
- A permission-rename cleanup (`tenant-expense-categories` →
  `tenant-in-ex-categories`) left orphaned `RolePermission` rows pointing
  at deleted permission ids, crashing tenant login's nested permission
  include; removed the orphaned rows directly.
- Mail config: SMTP port 465/2465 (implicit TLS, e.g. Resend) combined
  with `mailEncryption=NONE` dropped the connection before the handshake
  — these ports now force `secure: true` regardless of the stored
  encryption value.

## [1.3.0] - 2026-07-06

### Added

- Tenant Business CRUD module (`tenant_business` table): full REST CRUD
  (`GET/POST /system/tenant-business`, `GET/PATCH/DELETE
  /system/tenant-business/:id`) plus `PATCH
  /system/tenant-business/:id/restore` — the first soft-delete
  restore/undelete capability in the codebase.
- Six granular RBAC permissions seeded for the new module:
  `tenant-business:{create,view,update,delete,list,restore}` — the first
  resource to split `list`/`view` into separate permissions instead of a
  single `read`, and the first with a `restore` action.
- The list endpoint supports `status`, `country`, and `isParentBusiness`
  filters plus `sortBy`/`sortOrder` sorting (module-local
  `TenantBusinessListQueryDto`) — the first list endpoint in the codebase
  to go beyond the shared `page`/`limit`/`search` contract.

## [1.2.0] - 2026-07-06

### Added

- `API_VERSION` environment variable drives URI-based API versioning end
  to end. `main.ts` reads it into `app.enableVersioning({ defaultVersion })`
  instead of a hardcoded `'1'`, and every controller's `@Controller()`
  decorator now omits its own `version` so they all inherit the env-driven
  default — one place to bump when a `v2` is needed.
- Every Swagger `@ApiResponse` across all six controllers now includes a
  `schema: { example: {...} }` showing the actual JSON response shape
  (built from the real service/`select` fields, not guessed), so
  `/docs` renders a concrete example for logins, CRUD reads/writes,
  dashboard stats, and uploads instead of just a status code + description.

## [1.1.0] - 2026-07-06

### Fixed

- `roles.service.ts`: role deletion and the role list's user count included
  soft-deleted (`status: DELETED`) `system_users` rows in the `_count`
  aggregation. A role could stay permanently blocked from deletion even
  after its only assigned user was removed. The relation count is now
  scoped with `where: { status: { not: 'DELETED' } }` on both `findAll`
  and `remove`.

## [1.0.0] - 2026-07-06

### Added

- Initial NestJS + Prisma + MySQL backend scaffold.
- Database schema: `permissions`, `roles`, `role_permissions`,
  `system_users`, `refresh_tokens` — UUIDv7 primary keys, unique
  human-readable `systemCode`, UNIX-timestamp audit columns, soft deletes
  via `status`. Schema is engine-portable (MySQL now, PostgreSQL-ready).
- Authentication via Passport.js: `POST /system/login`, `/system/register`,
  `/system/refresh` (rotating refresh token), `/system/logout`,
  `GET /system/me`. JWT access tokens (15 min) + httpOnly refresh cookie
  (7 days, SHA-256 hash stored server-side).
- Role-based access control: `@RequirePermissions()` decorator + global
  `PermissionsGuard`, resolved per-request from the user's role.
- Full CRUD REST endpoints for permissions, roles, and system users,
  plus `/system/dashboard` stats and `/system/uploads`.
- Zod request validation via `nestjs-zod`, surfaced in Swagger.
- Security: Argon2id password hashing, helmet security headers, CORS
  allow-list, rate limiting (global + stricter login/register throttle),
  CSRF double-submit protection on cookie-based endpoints, mandatory
  `x-device-type` header, Prisma parameterized queries.
- Driver-based file storage: `STORAGE_DRIVER=local|s3`; only the file
  path is persisted, never a URL.
- Swagger/OpenAPI documentation at `/docs` for every endpoint.
- URI-based API versioning (`/api/v1/...`).
- Seed script for system permissions, `SUPER_ADMIN`/`SYSTEM_USER` roles,
  and a default super admin account.

[Unreleased]: ../../compare/backend-v1.6.0...HEAD
[1.6.0]: ../../compare/backend-v1.5.0...backend-v1.6.0
[1.5.0]: ../../compare/backend-v1.4.0...backend-v1.5.0
[1.4.0]: ../../compare/backend-v1.3.0...backend-v1.4.0
[1.3.0]: ../../compare/backend-v1.2.0...backend-v1.3.0
[1.2.0]: ../../compare/backend-v1.1.0...backend-v1.2.0
[1.1.0]: ../../compare/backend-v1.0.0...backend-v1.1.0
[1.0.0]: ../../releases/tag/backend-v1.0.0
