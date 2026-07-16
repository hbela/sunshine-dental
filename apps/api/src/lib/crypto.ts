import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { HttpError } from './errors.js';

/**
 * Application-level encryption-at-rest for patient PII.
 *
 * The 32-byte master key is supplied by a clinic ADMIN after every server
 * start (POST /api/admin/unlock) and held in process memory only — it is never
 * written to disk or env in production, so DB dumps/backups and direct DB
 * access expose only ciphertext. Two subkeys are derived from the single
 * master key via HKDF: one for AES-256-GCM field encryption, one for the
 * HMAC blind index used for exact phone-number lookups.
 *
 * Ciphertext format: `enc:v1:<base64(iv(12) | ciphertext | gcmTag(16))>`.
 * The prefix makes plaintext and ciphertext distinguishable, which gives us
 * idempotent encryption (migration can re-run safely) and tolerant reads
 * during the migration window.
 */

const PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HKDF_SALT = 'sunshine-dental-hkdf-v1';
const MASTER_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

export const KEYCHECK_SETTING_KEY = 'encryption.keycheck';
const KEYCHECK_PLAINTEXT = 'sunshine-keycheck-v1';
const SCHEMA_OUT_OF_DATE_CODES = new Set(['P2021', 'P2022']);

// Non-secret, short fingerprint of the master key, stored in plaintext next to
// the canary so operators can tell WHICH key a server expects (dev vs prod)
// without exposing the key. It's the first 32 bits of a domain-separated
// SHA-256 over the key — infeasible to invert, and the canary is already an
// online oracle for the key, so publishing it (e.g. on /api/health) leaks
// nothing usable while catching key mix-ups before an unlock is attempted.
export const KEYFP_SETTING_KEY = 'encryption.keyfingerprint';

export function keyFingerprint(masterKeyHex: string): string {
  return createHash('sha256').update('sunshine-keyfp-v1:' + masterKeyHex).digest('hex').slice(0, 8);
}

interface Subkeys {
  dataKey: Buffer;
  indexKey: Buffer;
}

// Module-level keyring: null = locked. Subkeys are zero-filled on lock().
let keys: Subkeys | null = null;

function deriveSubkeys(masterKeyHex: string): Subkeys {
  if (!MASTER_KEY_PATTERN.test(masterKeyHex)) {
    throw new HttpError(400, 'Encryption key must be 64 hex characters (32 bytes)', 'BAD_ENCRYPTION_KEY');
  }
  const master = Buffer.from(masterKeyHex, 'hex');
  const dataKey = Buffer.from(hkdfSync('sha256', master, HKDF_SALT, 'data-encryption', 32));
  const indexKey = Buffer.from(hkdfSync('sha256', master, HKDF_SALT, 'blind-index', 32));
  master.fill(0);
  return { dataKey, indexKey };
}

function encryptWith(dataKey: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, ct, tag]).toString('base64');
}

function decryptWith(dataKey: Buffer, value: string): string {
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Malformed ciphertext');
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(raw.length - TAG_LENGTH);
  const ct = raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', dataKey, iv);
  decipher.setAuthTag(tag);
  // GCM tag verification throws here on a wrong key or tampered data.
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

function isSchemaOutOfDateError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && SCHEMA_OUT_OF_DATE_CODES.has(code);
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function isUnlocked(): boolean {
  return keys !== null;
}

/** Zero the subkeys and return to the locked state. */
export function lock(): void {
  if (keys) {
    keys.dataKey.fill(0);
    keys.indexKey.fill(0);
    keys = null;
  }
}

export function assertUnlocked(): void {
  if (!keys) {
    throw new HttpError(
      503,
      'Patient data is locked — an administrator must unlock encryption',
      'ENCRYPTION_LOCKED',
    );
  }
}

/**
 * Verify the submitted master key against the stored key-check canary and arm
 * the keyring. If no canary exists yet (first ever unlock / fresh install) the
 * submitted key becomes THE key and the canary is written.
 *
 * Returns true when armed; false when the key does not match the canary (the
 * keyring stays locked and no data can be poisoned by a wrong key).
 *
 * `db` is a minimal Prisma-like surface so the migration script's separate
 * PrismaClient instance can reuse the exact same logic.
 */
export async function unlockWithKeyCheck(
  db: {
    appSetting: {
      findUnique(args: { where: { key: string } }): Promise<{ value: string } | null>;
      create(args: { data: { key: string; value: string } }): Promise<unknown>;
    };
  },
  masterKeyHex: string,
): Promise<boolean> {
  const candidate = deriveSubkeys(masterKeyHex);
  let existing: { value: string } | null;
  try {
    existing = await db.appSetting.findUnique({ where: { key: KEYCHECK_SETTING_KEY } });
  } catch (error) {
    candidate.dataKey.fill(0);
    candidate.indexKey.fill(0);
    if (isSchemaOutOfDateError(error)) {
      throw new HttpError(
        503,
        'Database schema is out of date. Run Prisma schema sync before unlocking patient data.',
        'DATABASE_SCHEMA_OUT_OF_DATE',
      );
    }
    throw error;
  }
  if (existing) {
    try {
      if (decryptWith(candidate.dataKey, existing.value) !== KEYCHECK_PLAINTEXT) {
        throw new Error('canary mismatch');
      }
    } catch {
      candidate.dataKey.fill(0);
      candidate.indexKey.fill(0);
      return false;
    }
  } else {
    try {
      await db.appSetting.create({
        data: { key: KEYCHECK_SETTING_KEY, value: encryptWith(candidate.dataKey, KEYCHECK_PLAINTEXT) },
      });
    } catch (error) {
      candidate.dataKey.fill(0);
      candidate.indexKey.fill(0);
      if (isSchemaOutOfDateError(error)) {
        throw new HttpError(
          503,
          'Database schema is out of date. Run Prisma schema sync before unlocking patient data.',
          'DATABASE_SCHEMA_OUT_OF_DATE',
        );
      }
      throw error;
    }
    // Advisory only: store the key fingerprint alongside the fresh canary. A
    // failure here must never block the unlock, so it's best-effort.
    try {
      await db.appSetting.create({
        data: { key: KEYFP_SETTING_KEY, value: keyFingerprint(masterKeyHex) },
      });
    } catch {
      /* fingerprint is non-essential; ignore write failures */
    }
  }
  lock();
  keys = candidate;
  return true;
}

/**
 * Read the stored (expected) key fingerprint written when the canary was
 * established. Returns null if absent (canary predates this feature) or on any
 * read error — it is advisory, so callers must tolerate null.
 */
export async function getStoredKeyFingerprint(db: {
  appSetting: { findUnique(args: { where: { key: string } }): Promise<{ value: string } | null> };
}): Promise<string | null> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: KEYFP_SETTING_KEY } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Development convenience only: arm the keyring from the ENCRYPTION_KEY env
 * var. Refused in production unless ALLOW_ENV_KEY=true is set explicitly —
 * the whole point of the custody model is that the prod server never stores
 * the key. Does NOT write/verify the canary (no DB here); the first real
 * unlock or the seed/migration path establishes it.
 */
export function tryUnlockFromEnv(): boolean {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) return false;
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ENV_KEY !== 'true') {
    return false;
  }
  lock();
  keys = deriveSubkeys(envKey);
  return true;
}

/**
 * Encrypt a field value. Idempotent: values already carrying the `enc:v1:`
 * prefix are returned unchanged, so double encryption is impossible.
 */
export function encryptString(plaintext: string): string {
  if (isEncrypted(plaintext)) return plaintext;
  assertUnlocked();
  return encryptWith(keys!.dataKey, plaintext);
}

/**
 * Decrypt a field value. Values without the `enc:v1:` prefix pass through
 * unchanged (pre-migration rows / migration window). A wrong key or tampered
 * ciphertext fails GCM verification and throws.
 */
export function decryptString(value: string): string {
  if (!isEncrypted(value)) return value;
  assertUnlocked();
  return decryptWith(keys!.dataKey, value);
}

/**
 * Like decryptString, but degrades to a placeholder instead of throwing while
 * locked — used for calendar event titles so the staff calendar stays usable
 * before the admin unlocks.
 */
export function decryptOrPlaceholder(value: string, placeholder = '••••'): string {
  if (!isEncrypted(value)) return value;
  if (!keys) return placeholder;
  return decryptWith(keys.dataKey, value);
}

/**
 * Keyed blind index over an already-normalized value (HMAC-SHA256, base64url).
 * Deterministic per key, so equality lookups work over ciphertext columns
 * without revealing the value; without the key the index is not reversible
 * or even testable against guesses.
 */
export function blindIndex(normalized: string): string {
  assertUnlocked();
  return createHmac('sha256', keys!.indexKey).update(normalized, 'utf8').digest('base64url');
}
