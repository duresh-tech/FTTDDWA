/**
 * Shared first-run bootstrap.
 *
 * Both entry points use this one implementation so they cannot drift:
 *   - the setup wizard  (POST /api/v1/system/setup/initialize)
 *   - the seed script   (npm run seed / node dist/prisma/seed.js)
 *
 * These are plain functions with no Nest decorators, so `prisma/seed.ts` can
 * import them directly (backend/tsconfig.json includes both `src/**` and
 * `prisma/**`).
 *
 * Deliberate design notes:
 *   - "Is this instance initialized?" is `systemUser.count() > 0`, NOT a flag
 *     row in app_settings. The generic App Settings store is editable through
 *     the admin UI (app-settings:update / :delete), so a flag there could be
 *     removed to re-open the installer. A user count cannot be forged.
 *   - Password hashing happens OUTSIDE the transaction (callers pass a
 *     ready-made hash). argon2id can take ~1s on a cpu-limited container,
 *     which is long enough to matter against Prisma's transaction timeout.
 *   - SYSTEM_SUPER_ADMIN must physically hold every permission row: neither
 *     PermissionsGuard nor TenantPermissionsGuard has a super-admin bypass,
 *     and jwt.strategy.ts re-resolves permissions from role_permissions on
 *     every request.
 */
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import {
  APP_LOGO_PATH_KEY,
  APP_NAME_KEY,
  CONSOLE_API_KEY_SETTING,
  PERMISSION_CATALOGUE,
  REMOVED_PERMISSION_MODULES,
  SETUP_COMPLETED_AT_KEY,
  SYSTEM_SUPER_ADMIN_ROLE_KEY,
  SYSTEM_SUPER_ADMIN_ROLE_NAME,
  TENANT_ADMIN_ROLE_KEY,
  TENANT_ADMIN_ROLE_NAME,
  TENANT_ROLE_PERMISSION_KEYS,
} from '../constants/permissions';
import { SETTING_DEFINITIONS } from '../constants/setting-definitions';
import { newId, newSystemCode, now } from '../utils/id.util';
import { decryptValue, encryptValue } from '../utils/encryption.util';
import { KEY_BRAND } from '../constants/key-brand';

/**
 * Accepts either a PrismaClient or a `$transaction` client -- PrismaClient
 * satisfies TransactionClient structurally.
 */
export type PrismaLike = Prisma.TransactionClient;

export interface BootstrapAdminInput {
  fName: string;
  username: string;
  email: string;
  /** Pre-computed argon2id hash. Never a plaintext password. */
  passwordHash: string;
}

export interface BootstrapInput {
  admin: BootstrapAdminInput;
  appName: string;
  /** Storage-relative path, or null to leave branding logo-less. */
  logoPath?: string | null;
  /**
   * Also create a tenant-visible role. Without one, TenantUsersService has no
   * assignable role (it requires visibleToTenants=true) and the whole tenant
   * portal is unreachable.
   */
  createTenantRole?: boolean;
}

export interface BootstrapResult {
  /** The console key's public prefix. Safe to log; the secret is not. */
  consoleKeyPrefix: string;
  userId: string;
  username: string;
  email: string;
  roleKey: string;
  permissionCount: number;
  tenantRoleCreated: boolean;
}

/** Thrown when bootstrap is attempted on an already-initialized instance. */
export class AlreadyInitializedError extends Error {
  constructor() {
    super('This instance is already initialized');
    this.name = 'AlreadyInitializedError';
  }
}

/** True once at least one system user exists. */
export async function isInitialized(db: PrismaLike): Promise<boolean> {
  return (await db.systemUser.count()) > 0;
}

/**
 * Drop permission rows for modules that no longer exist.
 *
 * role_permissions are deleted explicitly rather than relying on the DB-level
 * cascade: this project spent a long time on `prisma db push`, which does not
 * reliably (re)apply ON DELETE CASCADE to an existing foreign key, so orphan
 * rows could survive and break any role -> role_permissions -> permission join.
 */
export async function cleanupRemovedPermissions(db: PrismaLike): Promise<number> {
  let removed = 0;
  for (const moduleName of REMOVED_PERMISSION_MODULES) {
    const stale = await db.permission.findMany({
      where: { moduleName },
      select: { id: true },
    });
    if (stale.length === 0) continue;
    await db.rolePermission.deleteMany({
      where: { permissionId: { in: stale.map((p) => p.id) } },
    });
    const { count } = await db.permission.deleteMany({ where: { moduleName } });
    removed += count;
  }
  return removed;
}

/**
 * Insert any missing permissions and return a key -> id map of all of them.
 * One createMany instead of 86 sequential upserts.
 */
export async function syncPermissions(db: PrismaLike): Promise<Map<string, string>> {
  const timestamp = now();

  await db.permission.createMany({
    data: PERMISSION_CATALOGUE.map((p) => ({
      id: newId(),
      systemCode: newSystemCode('PRM'),
      displayName: p.displayName,
      moduleName: p.moduleName,
      permissionKey: p.permissionKey,
      description: p.description,
      isSystem: true,
      status: 'ACTIVE' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    skipDuplicates: true,
  });

  const rows = await db.permission.findMany({
    select: { id: true, permissionKey: true },
  });
  return new Map(rows.map((r) => [r.permissionKey, r.id]));
}

/**
 * Bring an ALREADY-INITIALIZED instance up to date with the catalogue.
 *
 * `bootstrapInstance` only runs on a fresh database, so without this a
 * permission added after setup would never reach a running install: the rows
 * would be missing, SYSTEM_SUPER_ADMIN would not hold them, and every screen
 * behind a new key would 403 with nothing in the logs to explain it.
 *
 * Idempotent, so `npm run seed` doubles as a "sync permissions" command.
 */
/**
 * Apply SETTING_DEFINITIONS, then give every business the ones it lacks.
 *
 * Two halves, both idempotent and matched by `settingKey`:
 *
 *  1. Create any definition the catalogue declares and the database lacks.
 *     An existing definition is left alone - it may have been re-worded or
 *     retired through the admin screen, and the catalogue is the starting
 *     point, not a reset.
 *  2. Insert a row for every (business, definition) pair that has none, at the
 *     definition's default. An existing row is NEVER overwritten: that is a
 *     value the business chose.
 *
 * This duplicates SettingsSyncService rather than calling it, because
 * bootstrap is also imported by the standalone `prisma/seed.ts`, which cannot
 * load PrismaService or Nest's DI graph. The two must stay in step; the column
 * list below is the thing to keep identical.
 */
export async function syncSettingDefinitions(db: PrismaLike): Promise<{
  definitionsAdded: number;
  settingsAdded: number;
}> {
  const timestamp = now();

  const existing = await db.settingDefinition.findMany({ select: { settingKey: true } });
  const existingKeys = new Set(existing.map((d) => d.settingKey));
  const missingDefs = SETTING_DEFINITIONS.filter((d) => !existingKeys.has(d.settingKey));

  if (missingDefs.length > 0) {
    await db.settingDefinition.createMany({
      data: missingDefs.map((d) => ({
        id: newId(),
        systemCode: newSystemCode('SDF'),
        category: d.category,
        settingKey: d.settingKey,
        settingLabel: d.settingLabel,
        description: d.description,
        valueType: d.valueType,
        defaultValue: d.defaultValue,
        validationRules: d.validationRules,
        isRequired: d.isRequired ?? false,
        isEncrypted: d.isEncrypted ?? false,
        isReadonly: d.isReadonly ?? false,
        isVisible: d.isVisible ?? true,
        // Declared in the catalogue, so it belongs on every business, not only
        // on ones created from now on.
        autoSyncToExistingTenants: true,
        sortOrder: d.sortOrder,
        status: 'ACTIVE' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      skipDuplicates: true,
    });
  }

  // Backfill. Done per business so one business's failure cannot strand the
  // rest, and so the (businessId, settingKey) unique index does the deduping.
  const definitions = await db.settingDefinition.findMany({ where: { status: 'ACTIVE' } });
  const businesses = await db.tenantBusiness.findMany({
    where: { status: { not: 'DELETED' } },
    select: { id: true },
  });

  let settingsAdded = 0;
  for (const business of businesses) {
    const held = await db.tenantBusinessSetting.findMany({
      where: { tenantBusinessId: business.id, status: { not: 'DELETED' } },
      select: { settingKey: true },
    });
    const heldKeys = new Set(held.map((r) => r.settingKey));
    const missing = definitions.filter((def) => !heldKeys.has(def.settingKey));
    if (missing.length === 0) continue;

    // Keep this column list identical to
    // TenantBusinessSettingsService.copyDefaultsForBusiness() and to
    // SettingsSyncService.sync(), or a business configured by one path renders
    // differently from one configured by another.
    await db.tenantBusinessSetting.createMany({
      data: missing.map((def) => ({
        id: newId(),
        systemCode: newSystemCode('TBS'),
        tenantBusinessId: business.id,
        settingDefinitionId: def.id,
        category: def.category,
        subCategory: def.subCategory,
        settingKey: def.settingKey,
        settingLabel: def.settingLabel,
        valueType: def.valueType,
        settingValue: def.defaultValue,
        description: def.description,
        validationRules: def.validationRules,
        isEncrypted: def.isEncrypted,
        isReadonly: def.isReadonly,
        isVisible: def.isVisible,
        sortOrder: def.sortOrder,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      skipDuplicates: true,
    });
    settingsAdded += missing.length;
  }

  return { definitionsAdded: missingDefs.length, settingsAdded };
}

export async function syncPermissionsAndGrants(db: PrismaLike): Promise<{
  removed: number;
  added: number;
  granted: number;
  tenantGranted: number;
  definitionsAdded: number;
  settingsAdded: number;
}> {
  const removed = await cleanupRemovedPermissions(db);

  const before = await db.permission.count();
  const keyToId = await syncPermissions(db);
  const added = (await db.permission.count()) - before;

  // Back-fill the super-admin role. Without this the rows exist but nobody
  // holds them, which looks identical from the UI.
  const role = await db.role.findUnique({
    where: { roleKey: SYSTEM_SUPER_ADMIN_ROLE_KEY },
    select: { id: true },
  });

  let granted = 0;
  if (role) {
    const held = new Set(
      (
        await db.rolePermission.findMany({
          where: { roleId: role.id },
          select: { permissionId: true },
        })
      ).map((row) => row.permissionId),
    );
    const missing = [...keyToId.values()].filter((id) => !held.has(id));
    if (missing.length > 0) {
      const timestamp = now();
      await db.rolePermission.createMany({
        data: missing.map((permissionId) => ({
          roleId: role.id,
          permissionId,
          createdAt: timestamp,
        })),
        skipDuplicates: true,
      });
      granted = missing.length;
    }
  }

  // Back-fill TENANT_ADMIN from TENANT_ROLE_PERMISSION_KEYS, for the same
  // reason as the super-admin back-fill above: a key added to that list after
  // setup would otherwise exist as a row nobody holds, and the tenant portal
  // screen behind it would 403 with nothing to explain why.
  //
  // Only keys the list declares, so a grant deliberately removed from a tenant
  // role through the Roles UI is not silently restored on the next seed.
  const tenantGranted = await grantMissingToRole(db, TENANT_ADMIN_ROLE_KEY, keyToId, [
    ...TENANT_ROLE_PERMISSION_KEYS,
  ]);

  // Settings ride along with the permission sync, so one `npm run seed`
  // brings an existing instance fully up to date.
  const { definitionsAdded, settingsAdded } = await syncSettingDefinitions(db);

  return { removed, added, granted, tenantGranted, definitionsAdded, settingsAdded };
}

/**
 * Grant a role every permission in `keys` that it does not already hold.
 *
 * Returns how many were added. A role that does not exist is not an error:
 * TENANT_ADMIN is optional (`createTenantRole`), and an instance without one
 * has nothing to back-fill.
 */
async function grantMissingToRole(
  db: PrismaLike,
  roleKey: string,
  keyToId: Map<string, string>,
  keys: string[],
): Promise<number> {
  const role = await db.role.findUnique({ where: { roleKey }, select: { id: true } });
  if (!role) return 0;

  const held = new Set(
    (
      await db.rolePermission.findMany({
        where: { roleId: role.id },
        select: { permissionId: true },
      })
    ).map((row) => row.permissionId),
  );
  const missing = keys
    .map((key) => keyToId.get(key))
    .filter((id): id is string => !!id && !held.has(id));
  if (missing.length === 0) return 0;

  const timestamp = now();
  await db.rolePermission.createMany({
    data: missing.map((permissionId) => ({
      roleId: role.id,
      permissionId,
      createdAt: timestamp,
    })),
    skipDuplicates: true,
  });
  return missing.length;
}

/** Create a role and grant it the given permissions. */
async function createRole(
  db: PrismaLike,
  roleKey: string,
  displayName: string,
  permissionIds: string[],
  visibleToTenants: boolean,
): Promise<string> {
  const timestamp = now();
  const role = await db.role.create({
    data: {
      id: newId(),
      systemCode: newSystemCode('ROL'),
      roleKey,
      displayName,
      isSystem: true,
      visibleToTenants,
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });

  if (permissionIds.length > 0) {
    await db.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
        createdAt: timestamp,
      })),
      skipDuplicates: true,
    });
  }

  return role.id;
}

/**
 * Initialize a fresh instance. Run inside a transaction by the caller:
 *
 *   await prisma.$transaction((tx) => bootstrapInstance(tx, input), { timeout: 20_000 })
 *
 * Throws AlreadyInitializedError if a system user already exists.
 */
export async function bootstrapInstance(
  db: PrismaLike,
  input: BootstrapInput,
): Promise<BootstrapResult> {
  // Re-check inside the transaction: this is what closes the race between two
  // concurrent calls to the public setup endpoint.
  if (await isInitialized(db)) throw new AlreadyInitializedError();

  await cleanupRemovedPermissions(db);
  const keyToId = await syncPermissions(db);
  const allPermissionIds = [...keyToId.values()];

  const superAdminRoleId = await createRole(
    db,
    SYSTEM_SUPER_ADMIN_ROLE_KEY,
    SYSTEM_SUPER_ADMIN_ROLE_NAME,
    allPermissionIds,
    // Never tenant-visible: a tenant user holding this role would sign into
    // the tenant portal with every system-level permission.
    false,
  );

  let tenantRoleCreated = false;
  if (input.createTenantRole) {
    const tenantPermissionIds = TENANT_ROLE_PERMISSION_KEYS.map((key) => keyToId.get(key)).filter(
      (id): id is string => Boolean(id),
    );
    await createRole(
      db,
      TENANT_ADMIN_ROLE_KEY,
      TENANT_ADMIN_ROLE_NAME,
      tenantPermissionIds,
      true,
    );
    tenantRoleCreated = true;
  }

  // Lowercase the stored identity. Postgres is case-sensitive where MySQL's
  // collation was not, so normalizing here keeps `Admin` and `admin` from
  // becoming two different accounts.
  const username = input.admin.username.trim().toLowerCase();
  const email = input.admin.email.trim().toLowerCase();
  const timestamp = now();

  const user = await db.systemUser.create({
    data: {
      id: newId(),
      systemCode: newSystemCode('USR'),
      fName: input.admin.fName.trim(),
      username,
      email,
      passwordHash: input.admin.passwordHash,
      roleId: superAdminRoleId,
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });

  // The catalogue, so the first business created on this instance already has
  // its settings. No businesses exist yet, so the backfill half is a no-op.
  await syncSettingDefinitions(db);

  await upsertAppSetting(db, APP_NAME_KEY, 'STRING', input.appName.trim(), 'Name of the application');

  // Only written when a logo was actually uploaded. The old seed hardcoded a
  // path into the gitignored uploads dir, so every fresh clone or volume
  // started with a broken image.
  if (input.logoPath) {
    await upsertAppSetting(db, APP_LOGO_PATH_KEY, 'STRING', input.logoPath, 'Path to the application logo');
  }

  // The console needs a key before it can make its first call, so the wizard
  // issues one. In the same transaction: an instance with an admin but no
  // console key would sign in and then 401 on everything.
  const consoleKeyPrefix = await createConsoleKey(db, timestamp);

  // Audit record only -- never read for gating (see the header note).
  await upsertAppSetting(
    db,
    SETUP_COMPLETED_AT_KEY,
    'STRING',
    String(timestamp),
    'UNIX timestamp of first-run setup',
  );

  return {
    consoleKeyPrefix,
    userId: user.id,
    username: user.username,
    email: user.email,
    roleKey: SYSTEM_SUPER_ADMIN_ROLE_KEY,
    permissionCount: allPermissionIds.length,
    tenantRoleCreated,
  };
}

async function upsertAppSetting(
  db: PrismaLike,
  key: string,
  dataType: 'STRING',
  value: string,
  description: string,
): Promise<void> {
  const timestamp = now();
  await db.appSetting.upsert({
    where: { key },
    update: { value, updatedAt: timestamp },
    create: {
      id: newId(),
      key,
      dataType,
      value,
      description,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });
}

/** Title of the console's own key, shown in the API Keys list. */
export const CONSOLE_KEY_TITLE = 'System Console';

/**
 * Issues the console's own API key and stores the whole token, encrypted, for
 * `GET /system/setup/status` to serve.
 *
 * The console is an ordinary client of the API and needs a key like any
 * other. It is issued here rather than configured in an env file because an
 * installer that cannot run until someone edits a file and restarts is a
 * worse first experience than one that sets itself up - and because the key
 * would otherwise have to be kept in step in two places by hand.
 *
 * Platform-level and **unscoped**: on console routes the signed-in user's
 * RBAC is the authorisation, and the key only says which application is
 * calling.
 *
 * Returns the public prefix, which is safe to log. The secret is not returned
 * at all - only its SHA-256 hash is stored, and the encrypted token is read
 * back through `consoleKeyToken()`.
 */
export async function createConsoleKey(db: PrismaLike, timestamp: number): Promise<string> {
  const keyPrefix = `${KEY_BRAND}_live_${randomBytes(4).toString('hex')}`;
  const secret = randomBytes(32).toString('base64url');

  await db.apiKey.create({
    data: {
      id: newId(),
      systemCode: newSystemCode('AKY'),
      tenantBusinessId: null,
      title: CONSOLE_KEY_TITLE,
      description:
        'Identifies the web console to the API. Issued by the setup wizard and ' +
        'served to the console at run time by GET /system/setup/status.',
      keyType: 'LIVE',
      keyPrefix,
      secretHash: createHash('sha256').update(secret).digest('hex'),
      secretLast4: secret.slice(-4),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });

  // Encrypted, because app_settings is readable by anything that can read the
  // database - and this row is the one place the plaintext token survives.
  await upsertAppSetting(
    db,
    CONSOLE_API_KEY_SETTING,
    'STRING',
    encryptValue(`${keyPrefix}.${secret}`),
    "The console's API key, encrypted. Served by GET /system/setup/status.",
  );

  return keyPrefix;
}

/**
 * The console's key, or null when there is not a usable one.
 *
 * Null rather than throwing, for every reason it can be absent: before setup,
 * on an instance that predates this mechanism, or once the key has been
 * revoked, suspended, expired or deleted through the API Keys UI. The
 * recovery in each case is the same - `npm run console-key`.
 *
 * The stored row is checked against the live key, not trusted on its own: a
 * revoked key must stop being served, not keep being handed out until someone
 * notices.
 */
export async function consoleKeyToken(db: PrismaLike): Promise<string | null> {
  try {
    const setting = await db.appSetting.findUnique({ where: { key: CONSOLE_API_KEY_SETTING } });
    if (!setting || setting.status !== 'ACTIVE') return null;

    const token = decryptValue(setting.value);
    const separator = token.indexOf('.');
    if (separator < 1) return null;

    const key = await db.apiKey.findUnique({ where: { keyPrefix: token.slice(0, separator) } });
    const usable =
      key !== null &&
      key.status === 'ACTIVE' &&
      key.deletedAt === null &&
      key.secretHash !== '' &&
      (key.expiresAt === null || Number(key.expiresAt) > now());

    return usable ? token : null;
  } catch {
    // A decryption failure means the encryption key changed under us. Null is
    // the honest answer, and `npm run console-key` is the fix.
    return null;
  }
}

/**
 * Issues a console key if there is no usable one. Idempotent, so the seed can
 * call it on every run.
 *
 * Returns the new prefix, or null when an existing key was left alone.
 */
export async function ensureConsoleKey(db: PrismaLike): Promise<string | null> {
  if (await consoleKeyToken(db)) return null;
  return createConsoleKey(db, now());
}
