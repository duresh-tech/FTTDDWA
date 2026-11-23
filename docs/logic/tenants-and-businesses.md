# Tenants & businesses

The system side administers everything. The tenant side is a self-service
mirror of the same resources, scoped to one business.

## The mapping

```
tenant_users ──► tenant_mapped_business ──► tenant_business
                                                 │
                        ┌────────────────────────┴────────────────────┐
                        │  members, mail config, places, streets,     │
                        │  countries, states, districts, taluks,      │
                        │  association positions, industries, domains, │
                        │  api keys                                   │
                        └─────────────────────────────────────────────┘
```

A tenant user reaches their own business through `tenant_mapped_business`.
Every tenant self-service endpoint resolves that mapping from the
authenticated caller and filters by it — the business id is never taken from
the request. A tenant cannot name someone else's business, because they never
get to name one at all.

## The dual-surface pattern

Each tenant-scoped resource is **one** Prisma model and **one** service,
exposed through two controllers:

| | System admin | Tenant self-service |
| --- | --- | --- |
| Scope | any business | the caller's own, only |
| Guard | `@RequirePermissions()` | `@RequireTenantPermissions()` |
| Business id | from the request | from the caller's mapping |

Both share one permission-key namespace, so `tenant-places:create` means the
same thing on either surface.

The benefit is that business rules are written once. The risk is that the
shared service must never be handed an unscoped query from the tenant side —
the scoping lives in the tenant controller's service methods
(`findAllForTenantUser` and friends), which resolve the caller's business ids
first.

Resources on this pattern: business, mapped business, countries, states,
districts, taluks, mail config, places, streets, and tenant users themselves.

## Tenant users manage their own team

`/tenant/users` lets a tenant administrator create and manage team members
within their own business. Two constraints hold it together:

- A new tenant user can only be assigned a role with
  `visibleToTenants: true`. See
  [RBAC & permissions](./rbac-permissions#the-tenant-visible-flag).
- The new user is mapped to the caller's business, not to one they choose.

So a tenant cannot escalate by assigning a system role, nor reach outside
their own business.

## Places and streets

`tenant_streets` reference `tenant_places`, and a street must belong to the
place chosen for it. The console enforces this with a cascading picker; the
service validates it regardless.

Both carry coordinates and a radius, picked on an OpenStreetMap/Leaflet map
(`src/components/location-picker-panel.tsx`, loaded with `next/dynamic` and
`ssr: false` because Leaflet touches `window` at import time). The tile server
is configurable via `APP_OSM_TILE_URL`.

Nothing references a place or a street today — the customers feature that did
was removed. They remain first-class resources with their own CRUD, and a
street still belongs to a place.

Both also carry an optional Tamil name — `placeNameTamil` and
`streetNameTamil` — alongside the English one, and the list search matches
either. See [Tamil names](#tamil-names).

The register itself is [Members](./members.md), which references the
position, industry and geography lookups below.

## The geography chain

`tenant_countries` → `tenant_states` → `tenant_districts` → `tenant_taluks`.
A state names its country with a required `countryId` FK; a district names its
state; a taluk names **both** its district and its state.

That redundancy is deliberate — it lets taluks be filtered by state without a
join — but the database cannot express "this district belongs to that state",
so each service walks the chain itself before writing. Skip that check and the
two ids drift apart silently.

`tenant_countries`, `tenant_states`, `tenant_districts` and `tenant_rtos` each carry a code that is
unique **per business**, enforced the way `tenant_streets` enforces
`streetCode`: by an assert that deliberately ignores soft-deleted rows, so a
code held by a deleted-but-restorable row cannot be reissued.

### RTOs hang off the district, not the taluk

`tenant_rtos` is a fourth lookup in this family, but it branches off the chain
rather than extending it: an RTO names a **district** and nothing below it.

```
tenant_countries ──> tenant_states ──> tenant_districts ──> tenant_taluks
                                              └──────────> tenant_rtos
```

This matters because the member form shows Taluk and RTO next to each other,
which makes it natural to assume RTO narrows by taluk. It does not — the picker
and the validator both key off `districtId`, and filtering by `talukId` would
quietly return nothing.

An RTO carries `rtoCode` (the registration series, like `TN38`), a name and an
optional Tamil name.

All of them, plus `tenant_industries`, are scoped per business. That duplicates
reference data — every business holds its own copy of Tamil Nadu — which is
what the spec called for. Making them global would mean dropping
`tenantBusinessId` and managing them system-side.

## Association positions

`tenant_association_positions` is a per-business lookup of the positions
members hold: President, Secretary, Treasurer. Each row carries an English
name, an optional Tamil one and a remark.

Nothing references it yet. It is the list an assignment will point at once we
decide where that assignment belongs — note that a tenant user is not itself
business-scoped, since it reaches a business through `tenant_mapped_business`
and may map to several, so the position cannot simply hang off the user.

## Tamil names

`placeNameTamil`, `streetNameTamil` and `positionNameTamil` are the first
localised fields in the schema. The shape they set:

- **Optional**, `VarChar` of the same length as the English sibling. `VarChar`
  counts *characters* in Postgres, not bytes, so 100 Tamil characters fit
  exactly as 100 Latin ones do and no length change is needed.
- **Searchable.** Each list query ORs the Tamil column in beside the English
  one, so either spelling finds the record. Tamil has no upper or lower case,
  so the `mode: 'insensitive'` the rest of the codebase uses is simply a
  substring match there — it costs nothing and keeps one idiom.
- **Never empty-string.** The console sends `undefined` rather than `""` when
  the field is blank, so "not recorded" is NULL rather than a row that looks
  filled in.

## Why some actions get their own key

`api-keys` splits `rotate` and `revoke` out from `update`: both hand out or
destroy a live secret, which is a bigger act than renaming a key. `permissions`
and `roles` split `delete_system` out from `delete`.

That is the general principle. An action gets its own permission key when it is
something you would plausibly want to grant separately, not merely because it
is a different endpoint.

## Soft deletes

Nothing is deleted. Every model carries a `status` enum and a `deletedAt`
timestamp, and "delete" sets `status = DELETED`.

Consequences worth knowing:

- Every list query filters on status. A query that forgets to is a bug that
  surfaces as deleted rows reappearing.
- Uniqueness is enforced at the database level across **all** rows, including
  deleted ones. Deleting a record does not free its unique fields for reuse.
- `restore` exists where a resource has `view_deleted`, and simply flips the
  status back.

## Mail config

One mail configuration per business, enforced in the tenant service: a second
`POST /tenant/mail-config` returns 400 if the caller's business already has a
non-deleted one. System-admin creation is unaffected and still allows several,
since an administrator may be staging a replacement.

`tenant-mail-config:test` sends a test message, kept as its own permission so
"can configure mail" and "can send mail from here" are separable.
