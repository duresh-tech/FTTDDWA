import { v7 as uuidv7 } from 'uuid';

/** Generate a UUIDv7 (time-ordered, so it keeps Postgres btree indexes compact). */
export function newId(): string {
  return uuidv7();
}

/** Current UNIX timestamp in seconds. */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Monotonic within this process, so two codes minted in the same millisecond
 * cannot collide. `systemCode` is @unique and the bootstrap inserts the whole
 * permission catalogue in ONE createMany({ skipDuplicates: true }) - where a
 * collision is not an error but a silently dropped row. That is exactly how
 * `tenant-users:read` went missing from an install, hiding the nav item it
 * gates with nothing in the logs.
 */
let codeCounter = 0;

/**
 * Generate a short, human-readable unique system code.
 * Ex. PRM-MBX2K1-0-4F7A2C, ROL-MBX2K1-1-9C21B8, USR-MBX2K1-2-0B3D5E
 *
 * The counter segment makes a single batch collision-proof; the 6 hex chars
 * of randomness (16.7M values, up from 65K) keep codes minted by separate
 * processes in the same millisecond from colliding either. Do not shorten
 * them back: with a 4-char tail, 118 rows in one batch collide ~10% of the
 * time. Stays well inside the VarChar(30) columns that hold it.
 */
export function newSystemCode(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase();
  const seq = (codeCounter++).toString(36).toUpperCase();
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${time}-${seq}-${rand}`;
}
