/**
 * Hungarian number in the shape the voice agent enforces: +36 / 0036 / domestic
 * 06 trunk, then a Budapest "1" landline (eight national digits) or a
 * 20/30/31/50/70 mobile (nine national digits — the 2-digit prefix plus a 3+4
 * subscriber number). Grouping spaces/dashes are stripped before this runs, so
 * the pattern matches the compacted string. e.g. "+36 20 257 6701" is valid but
 * "+36 20 257 67001" (ten national digits) is not.
 */
const HUNGARIAN_PHONE = /^(?:\+36|0036|06)(?:1\d{7}|(?:20|30|31|50|70)\d{7})$/;

/**
 * Normalize a phone number to a canonical compact form so the same number
 * always produces the same string regardless of how it was typed. Used for
 * the encrypted-data blind index (HMAC) and dedupe lookups, so equal numbers
 * MUST normalize identically: grouping characters are stripped, a "00"
 * international trunk becomes "+", and the Hungarian domestic "06" trunk
 * becomes "+36". e.g. "+36 20 257 6701", "0036202576701" and "06-20/257-6701"
 * all normalize to "+36202576701". Numbers without any trunk prefix are left
 * as bare digits.
 */
export function normalizePhoneNumber(raw: string): string {
  const compact = raw.trim().replace(/[\s()./-]/g, '');
  if (compact.startsWith('06')) return '+36' + compact.slice(2);
  if (compact.startsWith('00')) return '+' + compact.slice(2);
  return compact;
}

/**
 * Validate the *shape* of a phone number.
 *
 * Hungarian numbers (+36 / 0036 / 06) are held to the strict national shape the
 * agent enforces, so an
 * over- or under-typed local number is rejected. Any other number is accepted as
 * a generic international one (E.164 length bounds) — the clinic also serves
 * English/German-speaking patients whose numbers aren't Hungarian.
 *
 * Returns `false` for empty input; callers that treat the phone as optional
 * should skip validation when the field is blank.
 */
export function isValidPhoneNumber(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;

  // Only digits and common grouping characters are allowed (no letters).
  if (!/^\+?[\d\s()./-]+$/.test(s)) return false;

  // Canonical compact form: grouping stripped, 00→+, 06→+36 (see above).
  const normalized = normalizePhoneNumber(s);

  // Hungarian numbers get the strict rule (and are NOT rescued by the generic
  // fallback below when malformed).
  if (normalized.startsWith('+36')) return HUNGARIAN_PHONE.test(normalized);

  // Other international numbers: E.164 length bounds.
  if (normalized.startsWith('+')) return /^\+\d{8,15}$/.test(normalized);

  // A bare local number with no country code: accept 7–12 digits so patients
  // outside Hungary who type a national number without a prefix still pass.
  return /^\d{7,12}$/.test(normalized);
}
