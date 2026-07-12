import { normalizePhoneNumber } from '@repo/shared';
import { blindIndex, decryptString, encryptString } from './crypto.js';

/**
 * Which string fields hold patient PII per model — the single source of truth
 * for what gets encrypted at rest. better-auth models (User/Session/Account/
 * Verification) are deliberately absent: they must stay plaintext so staff can
 * log in while the keyring is locked. `ChatConversation.token` stays plaintext
 * too (it is an equality-lookup secret, not PII).
 */
export const ENCRYPTED_FIELDS = {
  patient: ['name', 'phone', 'email', 'reason', 'notes'],
  appointment: ['patientName', 'patientPhone', 'patientEmail', 'notes'],
  callLog: ['fromNumber', 'toNumber', 'transcript', 'summary'],
  chatMessage: ['content'],
  chatConversation: ['summary'],
  provider: ['phone', 'bio'],
} as const;

export type EncryptedModel = keyof typeof ENCRYPTED_FIELDS;

/**
 * Encrypt the in-scope fields of a create/update payload. Only fields that are
 * present and non-null are touched, so partial updates work unchanged.
 */
export function encryptRow<T extends Record<string, unknown>>(model: EncryptedModel, data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const field of ENCRYPTED_FIELDS[model]) {
    const value = out[field];
    if (typeof value === 'string' && value !== '') {
      out[field] = encryptString(value);
    }
  }
  return out as T;
}

/**
 * Decrypt the in-scope fields of a row read from the DB. Tolerant of plaintext
 * values (pre-migration rows pass through unchanged).
 */
export function decryptRow<T extends Record<string, unknown> | null>(model: EncryptedModel, row: T): T {
  if (!row) return row;
  const out: Record<string, unknown> = { ...row };
  for (const field of ENCRYPTED_FIELDS[model]) {
    const value = out[field];
    if (typeof value === 'string' && value !== '') {
      out[field] = decryptString(value);
    }
  }
  return out as T;
}

export function decryptRows<T extends Record<string, unknown>>(model: EncryptedModel, rows: T[]): T[] {
  return rows.map((r) => decryptRow(model, r));
}

/**
 * Blind index for exact phone-number lookups (`Patient.phoneIndex`). The phone
 * is normalized first so every input format of the same number ("06 20 …",
 * "+36-20-…", "003620…") produces the same index.
 */
export function phoneIndexOf(phone: string | null | undefined): string | null {
  if (!phone || !phone.trim()) return null;
  return blindIndex(normalizePhoneNumber(phone));
}
