# Tenants & businesses

The system side administers everything. The tenant side is a self-service
mirror of the same resources, scoped to one business.

## The mapping

```
tenant_users ──► tenant_mapped_business ──► tenant_business
                                                 │
                        ┌────────────────────────┴────────────────────┐
                        │  mail config, places, streets, customers,   │
                        │  business domains, api keys                 │
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

Resources on this pattern: business, mapped business, branches, network
mail config,
places, streets, customers, and tenant users themselves.

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

Customers reference a place and optionally a street, so the same cascade
applies there.

## Customers

The largest resource, and the only one with import/export. Beyond ordinary
CRUD it has:

- `view_deleted` and `restore` — soft-deleted records stay queryable to anyone
  holding those keys
- `export` and `import` — CSV, handled outside the `api()` client because they
  stream
- `change_status` — separated from `update`, so someone can be allowed to edit
  a customer without being allowed to activate or block them

That last split is the general principle: actions get their own permission key
when they are things you would plausibly want to grant separately, not merely
because they are different endpoints.

## Soft deletes

Nothing is deleted. Every model carries a `status` enum and a `deletedAt`
timestamp, and "delete" sets `status = DELETED`.

Consequences worth knowing:

- Every list query filters on status. A query that forgets to is a bug that
  surfaces as deleted rows reappearing.
- Uniqueness is enforced at the database level across **all** rows, including
  deleted ones. Deleting a customer does not free their unique fields for
  reuse.
- `restore` exists where a resource has `view_deleted`, and simply flips the
  status back.

## Mail config

One mail configuration per business, enforced in the tenant service: a second
`POST /tenant/mail-config` returns 400 if the caller's business already has a
non-deleted one. System-admin creation is unaffected and still allows several,
since an administrator may be staging a replacement.

`tenant-mail-config:test` sends a test message, kept as its own permission so
"can configure mail" and "can send mail from here" are separable.
