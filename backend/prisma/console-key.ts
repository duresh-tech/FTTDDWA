/**
 * Issues a new API key for the console.
 *
 *   npm run console-key                 (ts-node, host development)
 *   node dist/prisma/console-key.js     (inside the built container image)
 *
 * The setup wizard already does this on a fresh install, so this exists for
 * the cases where it cannot have:
 *
 *   - an instance that predates the key requirement
 *   - the console key was revoked, suspended or let expire under API Keys
 *   - SETTINGS_ENCRYPTION_KEY changed, so the stored token no longer decrypts
 *
 * Earlier console keys are left exactly as they are. Revoke them under API
 * Keys if you want them gone - this only issues the one the console will use
 * from now on, and the console picks it up on its next load with no restart.
 */
import { PrismaClient } from '@prisma/client';
import {
  CONSOLE_KEY_TITLE,
  consoleKeyToken,
  createConsoleKey,
} from '../src/common/bootstrap/bootstrap';
import { isEncryptionAvailable, isEncryptionKeyDerived } from '../src/common/utils/encryption.util';
import { now } from '../src/common/utils/id.util';

const prisma = new PrismaClient();

async function main() {
  if (!isEncryptionAvailable()) {
    console.error(
      'Cannot store the key: set SETTINGS_ENCRYPTION_KEY to 64 hex characters in\n' +
        'backend/.env, or JWT_ACCESS_SECRET for the derived fallback.',
    );
    process.exit(1);
  }

  const existing = await consoleKeyToken(prisma);
  const prefix = await createConsoleKey(prisma, now());

  console.log(`Issued console key ${prefix} ("${CONSOLE_KEY_TITLE}").`);
  if (existing) {
    console.log(
      'The previous console key still works. Revoke it under API Keys if you\n' +
        'want it gone - the console uses this new one from its next load.',
    );
  }
  if (isEncryptionKeyDerived()) {
    console.log(
      '\nSETTINGS_ENCRYPTION_KEY is not set, so the encryption key is derived from\n' +
        'JWT_ACCESS_SECRET. Rotating that secret will make this key unreadable and\n' +
        'you will need to run this again.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
