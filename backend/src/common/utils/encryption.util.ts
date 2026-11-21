import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

/**
 * AES-256-GCM for values that must come back out again - the console's API
 * key today, encrypted business settings later.
 *
 * GCM, not CBC: it authenticates as well as encrypts, so a tampered row fails
 * to decrypt instead of returning plausible garbage.
 */
const ALGORITHM = 'aes-256-gcm';

/** 12 bytes is the GCM standard; a longer IV is hashed down internally. */
const IV_LENGTH = 12;

/**
 * Derivation label, so a key derived for this purpose can never collide with
 * one derived for another. Changing it invalidates every stored value.
 *
 * These two deliberately keep the project's original `crm` slug, and were
 * left alone by the FTTDDWA rename. They are key-derivation inputs, never
 * displayed anywhere, so they carry no branding - while changing either one
 * would make every already-encrypted `app_settings` row, the console's own
 * API key included, permanently unreadable. Do not "finish" the rename here.
 */
const HKDF_INFO = 'crm:settings-encryption:v1';
const HKDF_SALT = 'crm-template';

let cached: Buffer | null = null;

/**
 * The 32-byte key, from `SETTINGS_ENCRYPTION_KEY` when set, otherwise derived
 * from `JWT_ACCESS_SECRET`.
 *
 * The fallback exists so that nothing here needs an operator to edit a file
 * before first run: the setup wizard issues the console's API key and stores
 * it encrypted, and an installer that fails because a variable is missing is
 * a worse first experience than a derived key.
 *
 * HKDF, not the secret itself: the derived key is independent of the signing
 * secret, so one cannot be recovered from the other. It is still the same
 * root secret, so **rotating `JWT_ACCESS_SECRET` without setting
 * `SETTINGS_ENCRYPTION_KEY` makes every stored encrypted value unreadable.**
 * Set it explicitly on anything long-lived - see docs/guide/configuration.
 */
function getKey(): Buffer {
  if (cached) return cached;

  const explicit = (process.env.SETTINGS_ENCRYPTION_KEY ?? '').trim();
  if (explicit) {
    if (!/^[0-9a-fA-F]{64}$/.test(explicit)) {
      throw new Error(
        'SETTINGS_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
          'Generate one with `openssl rand -hex 32`.',
      );
    }
    cached = Buffer.from(explicit, 'hex');
    return cached;
  }

  const root = (process.env.JWT_ACCESS_SECRET ?? '').trim();
  if (!root) {
    throw new Error(
      'Cannot encrypt: set SETTINGS_ENCRYPTION_KEY (64 hex characters), or ' +
        'JWT_ACCESS_SECRET for the derived fallback.',
    );
  }
  cached = Buffer.from(hkdfSync('sha256', root, HKDF_SALT, HKDF_INFO, 32));
  return cached;
}

/** Whether a value can be encrypted at all, without throwing to find out. */
export function isEncryptionAvailable(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** Whether the key is derived rather than configured. For the boot warning. */
export function isEncryptionKeyDerived(): boolean {
  return (process.env.SETTINGS_ENCRYPTION_KEY ?? '').trim() === '';
}

/**
 * Encrypts a value. Output is `base64(iv):base64(authTag):base64(ciphertext)`,
 * so the three parts travel together in one text column.
 */
export function encryptValue(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** Decrypts a value produced by {@link encryptValue}. Throws if tampered. */
export function decryptValue(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Malformed encrypted value');
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Test hook: forget the cached key so a changed env var is picked up. */
export function resetEncryptionKeyCache(): void {
  cached = null;
}
