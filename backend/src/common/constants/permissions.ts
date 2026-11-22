/**
 * The single source of truth for the RBAC permission catalogue.
 *
 * Previously this lived inside `prisma/seed.ts`, which meant the seed was the
 * only thing that could create permissions. The setup wizard needs the same
 * list, so it moved here and both import it -- otherwise the two bootstrap
 * paths would drift and a wizard-created instance would silently differ from
 * a seeded one.
 *
 * Permission keys are `${moduleName}:${action}` and must match the strings in
 * `@RequirePermissions()` / `@RequireTenantPermissions()` on the controllers.
 */

/** The only system role created at bootstrap. Holds every permission below. */
export const SYSTEM_SUPER_ADMIN_ROLE_KEY = 'SYSTEM_SUPER_ADMIN';
export const SYSTEM_SUPER_ADMIN_ROLE_NAME = 'System Super Administrator';

/** Optional tenant-facing role, so the tenant portal is usable on a fresh install. */
export const TENANT_ADMIN_ROLE_KEY = 'TENANT_ADMIN';
export const TENANT_ADMIN_ROLE_NAME = 'Tenant Administrator';

export interface PermissionModule {
  module: string;
  label: string;
  actions: string[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  { module: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { module: 'tenant-dashboard', label: 'Tenant Dashboard', actions: ['view'] },
  { module: 'tenant-account', label: 'Tenant Account', actions: ['view', 'update'] },
  { module: 'permissions', label: 'Permissions', actions: ['create', 'read', 'update', 'delete', 'delete_system'] },
  { module: 'roles', label: 'Roles', actions: ['create', 'read', 'update', 'delete', 'delete_system'] },
  { module: 'system-users', label: 'System Users', actions: ['create', 'read', 'update', 'delete'] },
  { module: 'tenant-users', label: 'Tenant Users', actions: ['create', 'read', 'view', 'update', 'delete', 'login-as'] },
  { module: 'tenant-business', label: 'Tenant Business', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  { module: 'tenant-mapped-business', label: 'Tenant Mapped Business', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  { module: 'tenant-places', label: 'Tenant Places', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  { module: 'tenant-association-positions', label: 'Tenant Association Positions', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  // Geography chain: a district belongs to a state, a taluk to both.
  { module: 'tenant-states', label: 'Tenant States', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  { module: 'tenant-districts', label: 'Tenant Districts', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  { module: 'tenant-taluks', label: 'Tenant Taluks', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  { module: 'tenant-industries', label: 'Tenant Industries', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  { module: 'tenant-streets', label: 'Tenant Streets', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  { module: 'tenant-mail-config', label: 'Tenant Mail Config', actions: ['create', 'view', 'update', 'delete', 'list', 'test'] },
  { module: 'app-settings', label: 'App Settings', actions: ['create', 'view', 'update', 'delete', 'list', 'restore'] },
  // System-admin only, with no tenant self-service twin: claiming a hostname
  // is a trust boundary - a tenant could otherwise assert ownership of a name
  // they do not control and have the edge request a certificate for it.
  { module: 'tenant-business-domains', label: 'Tenant Business Domains', actions: ['create', 'view', 'update', 'delete', 'list'] },
  { module: 'uploads', label: 'Uploads', actions: ['create'] },
  // Machine credentials. `rotate` and `revoke` are separate from `update`
  // on purpose: both hand out or destroy a live secret, which is a bigger
  // act than renaming a key.
  { module: 'api-keys', label: 'API Keys', actions: ['create', 'view', 'list', 'update', 'revoke', 'rotate'] },
  // Curated system-side only: tenants read templates to fill a form, but
  // writing one would let them assemble any scope bundle they liked.
  { module: 'api-key-scope-templates', label: 'API Key Scope Templates', actions: ['create', 'view', 'list', 'update', 'delete'] },
  // Per-business settings. The catalogue is system-side only: a definition is
  // shared by every business, so letting one tenant edit it would change the
  // others. There is no `delete` - businesses hold copies, so a definition is
  // retired (status INACTIVE), never removed.
  { module: 'setting-definitions', label: 'Setting Definitions', actions: ['create', 'view', 'update', 'list'] },
  // The values. `list` is system-side only (it is the cross-tenant support
  // view); the tenant surface holds view/update for its own business.
  { module: 'tenant-business-settings', label: 'Tenant Business Settings', actions: ['view', 'update', 'list'] },
  // Backfilling a new definition to businesses that already exist.
  { module: 'settings-sync', label: 'Settings Sync', actions: ['run'] },
];

export interface PermissionDefinition {
  moduleName: string;
  action: string;
  permissionKey: string;
  displayName: string;
  description: string;
}

/** Every permission the system knows about, flattened from PERMISSION_MODULES. */
export const PERMISSION_CATALOGUE: PermissionDefinition[] = PERMISSION_MODULES.flatMap(
  ({ module, label, actions }) =>
    actions.map((action) => ({
      moduleName: module,
      action,
      permissionKey: `${module}:${action}`,
      displayName: `${action.charAt(0).toUpperCase()}${action.slice(1)} ${label}`,
      // The column is VarChar(50); keep the slice so long module names cannot
      // overflow it.
      description: `${action} access for ${module}`.slice(0, 50),
    })),
);

export const PERMISSION_KEYS: string[] = PERMISSION_CATALOGUE.map((p) => p.permissionKey);

/**
 * Permissions granted to the optional TENANT_ADMIN role: the tenant portal's
 * own surface only. Deliberately excludes every system-admin module.
 */
export const TENANT_ROLE_PERMISSION_KEYS: string[] = [
  'tenant-dashboard:view',
  'tenant-account:view',
  'tenant-account:update',
  'tenant-business:view',
  'tenant-business:update',
  'tenant-users:create',
  'tenant-users:read',
  'tenant-users:view',
  'tenant-users:update',
  'tenant-users:delete',
  ...[
    'places',
    'streets',
    'association-positions',
    'states',
    'districts',
    'taluks',
    'industries',
  ].flatMap((resource) =>
    ['list', 'view', 'create', 'update', 'delete'].map(
      (action) => `tenant-${resource}:${action}`,
    ),
  ),
  // Its own settings, but NOT `:list` - that key is the system-side
  // cross-tenant view, and a tenant has only one business to read.
  'tenant-business-settings:view',
  'tenant-business-settings:update',
  'tenant-mail-config:list',
  'tenant-mail-config:view',
  'tenant-mail-config:create',
  'tenant-mail-config:update',
  'tenant-mail-config:delete',
  'tenant-mail-config:test',
  // A business manages its own keys. Scope templates are deliberately
  // absent: the tenant template route is gated on `api-keys:create`, since
  // the list exists only to fill that form.
  'api-keys:create',
  'api-keys:view',
  'api-keys:list',
  'api-keys:update',
  'api-keys:revoke',
  'api-keys:rotate',
];

/**
 * Modules that used to exist. Their permission rows are deleted at bootstrap
 * so stale keys cannot linger in the Roles UI. No-op once applied.
 */
export const REMOVED_PERMISSION_MODULES: string[] = [
  'tenant-expense-categories',
  'qr-display-templates',
  'tenant-sms',
  'tenant-counters',
  'tenant-qr-devices',
  'system-settings',
  // Retired with the FTTDDWA scope reduction. A tent dealers' and decorators'
  // association has no use for these five; their tables were dropped in
  // migration 0004_remove_unused_tenant_resources.
  'tenant-tax-types',
  'tenant-payment-modes',
  'tenant-in-ex-categories',
  'tenant-business-branches',
  'tenant-network-providers',
  // Retired with the customers feature; its table was dropped in
  // 0006_remove_tenant_customers.
  'tenant-customers',
];

/** App settings keys written at bootstrap. */
export const APP_NAME_KEY = 'app.name';
export const APP_LOGO_PATH_KEY = 'app.logo_path';
export const SETUP_COMPLETED_AT_KEY = 'app.setup_completed_at';

/**
 * The console's own API key, stored encrypted and served to the console at
 * run time by `GET /system/setup/status`.
 *
 * Written by the bootstrap, never by hand.
 */
export const CONSOLE_API_KEY_SETTING = 'console.api_key';

/**
 * App settings the generic App Settings UI must not list, change or delete.
 *
 * `console.api_key` holds a live credential: editing it through a text box
 * would lock the console out of its own API, and the row is machine-written
 * anyway. `app.name` and `app.logo_path` are deliberately NOT here - they
 * have their own UI and are meant to be edited.
 */
export const RESERVED_APP_SETTING_KEYS: string[] = [CONSOLE_API_KEY_SETTING];
