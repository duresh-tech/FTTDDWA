# RBAC & permissions

Authorization is **data**, not code. Nothing anywhere asks "is this user an
administrator?"

## The model

```
permissions ⇄ role_permissions ⇄ roles ⇄ system_users
                                      ⇄ tenant_users
```

A user has exactly one role; a role has any number of permissions. Routes
declare the keys they need:

```ts
@RequirePermissions('roles:delete')          // system routes
@RequireTenantPermissions('tenant-members:create') // tenant routes
```

Both guards do the same thing — compare the route's required keys against the
set resolved for the caller, and throw `ForbiddenException` naming the missing
ones.

## There is no super-admin bypass

Neither `PermissionsGuard` nor `TenantPermissionsGuard` contains anything like
`if (user.roleKey === 'SYSTEM_SUPER_ADMIN') return true`.

This is the single most important thing to know about the system:

- `SYSTEM_SUPER_ADMIN` works **only** because it physically holds all 142
  `role_permissions` rows.
- A role with 106 of them is short exactly one permission, and the UI will
  quietly hide the corresponding action.
- Adding a new permission to the catalogue does **not** grant it to the
  super-admin role retroactively. Re-running bootstrap back-fills it; an
  existing instance needs the grant added.

The upside is that there is no privileged code path to audit or accidentally
widen. The cost is that "all permissions" is a fact about rows, which has to
be maintained.

## The catalogue

`backend/src/common/constants/permissions.ts` is the single source of truth:
29 modules, **142** keys of the form `${moduleName}:${action}`.

```ts
{ module: 'tenant-members', label: 'Tenant Members',
  actions: ['create','view','update','delete','list','restore',
            'change_status','position_update','password_reset'] }
```

It used to live inside `prisma/seed.ts`, which meant the seed was the only
thing that could create permissions. The setup wizard needs the same list, so
it moved here and both import it — otherwise the two bootstrap paths would
drift and a wizard-created instance would silently differ from a seeded one.

The keys must match the strings in the controllers' decorators. Most appear
in one; the rest are read off the caller inside a handler (the
`delete_system` family) or are reserved.

### Adding a permission

1. Add the action to its module in `permissions.ts`.
2. Use the key in a decorator.
3. Re-run bootstrap (`npm run seed`, or the migrate job) so the row exists and
   `SYSTEM_SUPER_ADMIN` is back-filled. On an **already initialized** instance
   the seed does not stop at "nothing to do": it syncs the catalogue and
   back-fills the missing grants, which is what makes `npm run seed` safe to
   re-run and is the only way a running instance receives a new permission.
   Signed-in users pick it up on their next request, with no re-login.
4. Grant it to any other role that needs it, through the Roles page. The sync
   back-fills `SYSTEM_SUPER_ADMIN` with everything, and `TENANT_ADMIN` with
   the keys `TENANT_ROLE_PERMISSION_KEYS` declares — nothing else. A hand-made
   role is never widened, because that would be a privilege change nobody
   asked for.

   Note the consequence for `TENANT_ADMIN`: because the declared list is the
   target, a key removed from that role by hand through the Roles page **is
   restored** on the next seed. Take it out of
   `TENANT_ROLE_PERMISSION_KEYS` if the removal is meant to stick.

Removing one means adding its module to `REMOVED_PERMISSION_MODULES`, which
deletes the stale rows so they stop appearing in the Roles UI.

## Roles created at bootstrap

Exactly one:

| Role | `isSystem` | `visibleToTenants` | Permissions |
| --- | --- | --- | --- |
| `SYSTEM_SUPER_ADMIN` | `true` | `false` | all 142 |
| `TENANT_ADMIN` *(optional)* | `true` | `true` | 84 tenant-portal keys |

This replaced an earlier trio — `SUPER_ADMIN`, `SYSTEM_USER` and
`TENANT_ADMIN`. Everything beyond the super-admin role is now created
deliberately through the Roles page, rather than appearing as a seeded default
nobody chose.

### The tenant-visible flag

`TenantUser.roleId` must reference a role with `visibleToTenants: true`.
`TenantUsersService.assertRoleAssignable()` rejects anything else, and
`listAssignableRoles()` filters on it.

So with only `SYSTEM_SUPER_ADMIN` (which is deliberately not tenant-visible),
**no tenant user can be created at all** and the `/tenant` tree is
unreachable. The wizard offers to create `TENANT_ADMIN` for exactly this
reason.

::: danger Never set visibleToTenants on SYSTEM_SUPER_ADMIN
A tenant user assigned it would sign into the tenant portal holding all 142
system-level permissions. Create a separate tenant-scoped role instead.
:::

## Two deliberate exceptions

`tenant-business-domains` breaks two house rules on purpose, and both are
worth knowing before someone "fixes" them:

- **It hard-deletes**, where everything else soft-deletes. A soft-deleted row
  would keep holding the unique hostname and block a legitimate re-claim.
  `enabled` covers turning a domain off without losing the record.
- **It has no tenant self-service twin**, where every other tenant-scoped
  resource does. Claiming a hostname is a trust boundary: a tenant could
  otherwise assert ownership of a name they do not control and have the edge
  request a public certificate for it.

See [Tenant domains](/guide/domains).

## System rows and `delete_system`

Rows flagged `isSystem: true` are bootstrap-created and refused by the normal
`delete` action.

Two modules — `permissions` and `roles` — carry a second `delete_system`
action that lifts that refusal. The delete handler reads it off the caller
and returns 403 when a system row is targeted without it.

`SYSTEM_SUPER_ADMIN` holds both. The optional `TENANT_ADMIN` deliberately
holds neither, so defaults shared across businesses cannot be removed from
the tenant portal.

## How the UI uses the same keys

`useSession()` exposes `hasPermission(key)` from the permissions returned by
`/system/me`:

```ts
const { hasPermission } = useSession();
const canCreate = hasPermission('app-settings:create');
```

`NAV_ITEMS` in `src/components/sidebar-nav.tsx` carries a `permission` per
entry and is filtered through the same function, so a section disappears
entirely rather than rendering a page that would 403. The same array feeds the
command palette and the breadcrumbs.

This **mirrors** the backend; it does not replace it. The API is the only
authority — hiding a button is a courtesy, and every route is independently
guarded.

## Bootstrap, in order

`backend/src/common/bootstrap/bootstrap.ts`, inside one transaction:

1. Re-check `systemUser.count() === 0`.
2. Delete permissions for removed modules (and their grants explicitly — a
   legacy of `prisma db push` not reliably re-applying `ON DELETE CASCADE`).
3. `createMany` all 142 permissions with `skipDuplicates`, then read back the
   id map. One statement, not 142 round trips.
4. Create `SYSTEM_SUPER_ADMIN` and `createMany` all 142 grants.
5. Optionally create `TENANT_ADMIN` with its 60.
6. Create the administrator, username and email lowercased.
7. Write `app.name`, `app.logo_path` (only if a logo was uploaded) and
   `app.setup_completed_at`.

The password is hashed *before* the transaction opens — argon2id is slow enough
to threaten the transaction timeout on a constrained container.
