import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  blindIndex,
  decryptOrPlaceholder,
  decryptString,
  encryptString,
  isEncrypted,
  isUnlocked,
  lock,
  tryUnlockFromEnv,
  unlockWithKeyCheck,
} from './crypto.js';
import { phoneIndexOf } from './crypto-fields.js';
import { normalizePhoneNumber } from '@repo/shared';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

/** In-memory stand-in for prisma.appSetting, enough for unlockWithKeyCheck. */
function fakeSettings() {
  const store = new Map<string, string>();
  return {
    appSetting: {
      async findUnique({ where }: { where: { key: string } }) {
        const value = store.get(where.key);
        return value === undefined ? null : { value };
      },
      async create({ data }: { data: { key: string; value: string } }) {
        store.set(data.key, data.value);
        return data;
      },
    },
  };
}

function unlockWith(key: string) {
  process.env.ENCRYPTION_KEY = key;
  process.env.NODE_ENV = 'test';
  expect(tryUnlockFromEnv()).toBe(true);
}

beforeEach(() => unlockWith(KEY_A));
afterEach(() => {
  lock();
  delete process.env.ENCRYPTION_KEY;
});

describe('encryptString / decryptString', () => {
  it('round-trips arbitrary text including unicode', () => {
    for (const s of ['hello', 'Kovács Ágnes — fájó fog 🦷', 'a'.repeat(10_000), ' ']) {
      const ct = encryptString(s);
      expect(isEncrypted(ct)).toBe(true);
      expect(decryptString(ct)).toBe(s);
    }
  });

  it('is idempotent: encrypting ciphertext returns it unchanged', () => {
    const ct = encryptString('plain');
    expect(encryptString(ct)).toBe(ct);
  });

  it('passes plaintext through decryptString unchanged (pre-migration rows)', () => {
    expect(decryptString('not encrypted')).toBe('not encrypted');
  });

  it('uses a fresh IV per call (same plaintext, different ciphertext)', () => {
    expect(encryptString('same')).not.toBe(encryptString('same'));
  });

  it('fails GCM verification under a different key', () => {
    const ct = encryptString('secret');
    lock();
    unlockWith(KEY_B);
    expect(() => decryptString(ct)).toThrow();
  });
});

describe('locked state', () => {
  it('throws ENCRYPTION_LOCKED from all key-dependent operations', () => {
    lock();
    expect(isUnlocked()).toBe(false);
    for (const fn of [() => encryptString('x'), () => decryptString('enc:v1:AAAA'), () => blindIndex('x')]) {
      expect(fn).toThrow(/locked/i);
    }
  });

  it('decryptOrPlaceholder degrades instead of throwing while locked', () => {
    const ct = encryptString('Jane Doe');
    lock();
    expect(decryptOrPlaceholder(ct)).toBe('••••');
    expect(decryptOrPlaceholder('plain name')).toBe('plain name');
    unlockWith(KEY_A);
    expect(decryptOrPlaceholder(ct)).toBe('Jane Doe');
  });
});

describe('unlockWithKeyCheck (canary)', () => {
  it('accepts the original key and rejects a different one', async () => {
    const db = fakeSettings();
    lock();
    expect(await unlockWithKeyCheck(db, KEY_A)).toBe(true); // first unlock writes canary
    lock();
    expect(await unlockWithKeyCheck(db, KEY_B)).toBe(false); // wrong key rejected
    expect(isUnlocked()).toBe(false); // stays locked after rejection
    expect(await unlockWithKeyCheck(db, KEY_A)).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it('rejects malformed keys', async () => {
    await expect(unlockWithKeyCheck(fakeSettings(), 'too-short')).rejects.toThrow(/64 hex/);
  });
});

describe('blind index', () => {
  it('is identical across phone input formats', () => {
    const a = phoneIndexOf('+36 20 257 6701');
    expect(a).toBe(phoneIndexOf('06202576701'));
    expect(a).toBe(phoneIndexOf('0036202576701'));
    expect(a).toBe(phoneIndexOf('+36-20/257-6701'));
  });

  it('differs for different numbers and is empty for blank input', () => {
    expect(phoneIndexOf('+36202576701')).not.toBe(phoneIndexOf('+36202576702'));
    expect(phoneIndexOf('')).toBeNull();
    expect(phoneIndexOf(null)).toBeNull();
    expect(phoneIndexOf('  ')).toBeNull();
  });

  it('depends on the key', () => {
    const withA = phoneIndexOf('+36202576701');
    lock();
    unlockWith(KEY_B);
    expect(phoneIndexOf('+36202576701')).not.toBe(withA);
  });
});

describe('normalizePhoneNumber', () => {
  it('canonicalizes trunk prefixes and grouping', () => {
    expect(normalizePhoneNumber('+36 20 257 6701')).toBe('+36202576701');
    expect(normalizePhoneNumber('06-20/257.6701')).toBe('+36202576701');
    expect(normalizePhoneNumber('0036 (20) 257 6701')).toBe('+36202576701');
    expect(normalizePhoneNumber('001 555 123 4567')).toBe('+15551234567');
    expect(normalizePhoneNumber('5551234')).toBe('5551234');
  });
});
