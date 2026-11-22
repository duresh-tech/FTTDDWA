import { createHmac } from 'crypto';
import { deriveSecondaryKey } from './encryption.util';

/**
 * A blind index: a deterministic fingerprint of a sensitive value, so rows can
 * be compared for equality without the value being readable.
 *
 * Why this exists at all. `aadhaarNumber` is stored AES-256-GCM encrypted, and
 * GCM uses a random IV, so the same number encrypts to different ciphertext
 * every time. That is exactly what you want for confidentiality and exactly
 * what makes `@@unique` useless - two rows for the same person would not
 * collide. Hashing the value deterministically alongside the ciphertext gives
 * back the one property we need: equality.
 *
 * HMAC rather than a bare SHA-256. An Aadhaar number is 12 digits, so the
 * whole input space is 10^12 - a plain hash would fall to a rainbow table in
 * minutes. Keying the hash means an attacker who steals the database still
 * needs the key to test a guess.
 *
 * What it deliberately does NOT give you: ordering, prefix search, or
 * `contains`. A blind index answers "are these the same?" and nothing else.
 */

/** Digits only, so formatting differences cannot create a second "person". */
export function normaliseAadhaar(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * 64 hex characters, matching the `Char(64)` column.
 *
 * The key is derived from the same root as the encryption key but with its own
 * label, so the index key and the encryption key are independent: neither can
 * be recovered from the other, and rotating one does not silently reinterpret
 * data protected by the other.
 */
export function blindIndex(value: string): string {
  return createHmac('sha256', deriveSecondaryKey('blind-index:v1'))
    .update(normaliseAadhaar(value))
    .digest('hex');
}
