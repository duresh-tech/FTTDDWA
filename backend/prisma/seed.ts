/**
 * Development seed: initializes a fresh instance non-interactively.
 *
 *   npm run seed                 (ts-node, host development)
 *   node dist/prisma/seed.js     (inside the built container image)
 *
 * This is a thin wrapper over the SAME shared bootstrap the setup wizard uses
 * (src/common/bootstrap/bootstrap.ts), so a seeded instance and a
 * wizard-initialized one are byte-for-byte equivalent. It creates exactly one
 * role -- SYSTEM_SUPER_ADMIN, holding every permission.
 *
 * Idempotent: a no-op once any system user exists.
 *
 * In production, prefer the setup wizard at /setup. It asks for real
 * credentials instead of using the well-known defaults below. Override these
 * with SEED_ADMIN_USERNAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD /
 * SEED_ADMIN_NAME / SEED_APP_NAME / SEED_TENANT_ROLE.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  bootstrapInstance,
  ensureConsoleKey,
  isInitialized,
  syncPermissionsAndGrants,
} from '../src/common/bootstrap/bootstrap';

const prisma = new PrismaClient();

async function main() {
  if (await isInitialized(prisma)) {
    // Already set up, so there is no account to create - but the permission
    // catalogue may have grown since. Sync it and back-fill the super-admin
    // role, otherwise a permission added after setup never reaches this
    // instance and every screen behind it 403s with nothing to explain why.
    console.log('Instance already initialized - syncing the catalogues...');
    const { removed, added, granted, tenantGranted, definitionsAdded, settingsAdded } =
      await syncPermissionsAndGrants(prisma);
    console.log(`  - removed ${removed} legacy permission(s)`);
    console.log(`  + added ${added} new permission(s)`);
    console.log(`  + granted ${granted} permission(s) to SYSTEM_SUPER_ADMIN`);
    console.log(`  + granted ${tenantGranted} permission(s) to TENANT_ADMIN`);
    console.log(`  + added ${definitionsAdded} setting definition(s)`);
    console.log(`  + gave ${settingsAdded} setting(s) to existing business(es)`);

    // An instance set up before the API key requirement has no console key,
    // and without one the console 401s on every call. Issuing it here means
    // the upgrade path is `npm run seed`, same as for a new permission.
    const consoleKey = await ensureConsoleKey(prisma);
    console.log(
      consoleKey
        ? `  + issued console key ${consoleKey}`
        : '  = console key already present',
    );

    console.log(
      added === 0 && granted === 0 && !consoleKey
        ? 'Nothing to change. To start over: drop the database volume, then re-run.'
        : 'Done. Signed-in users pick this up on their next request - no re-login needed.',
    );
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  // Hashed before opening the transaction - argon2id is slow enough to risk
  // the transaction timeout on a cpu-limited container.
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  console.log('Bootstrapping a fresh instance...');
  const result = await prisma.$transaction(
    (tx) =>
      bootstrapInstance(tx, {
        admin: {
          fName: process.env.SEED_ADMIN_NAME ?? 'System Administrator',
          username: process.env.SEED_ADMIN_USERNAME ?? 'admin',
          email: process.env.SEED_ADMIN_EMAIL ?? 'admin@system.local',
          passwordHash,
        },
        appName: process.env.SEED_APP_NAME ?? 'FTTDDWA',
        logoPath: null,
        createTenantRole: process.env.SEED_TENANT_ROLE !== 'false',
      }),
    { timeout: 20_000 },
  );

  console.log(`  + ${result.permissionCount} permissions`);
  console.log(`  + role ${result.roleKey} (all permissions)`);
  if (result.tenantRoleCreated) console.log('  + role TENANT_ADMIN (tenant portal)');
  console.log(`  + user ${result.username} (password: ${password})`);
  console.log(`  + console key ${result.consoleKeyPrefix}`);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
