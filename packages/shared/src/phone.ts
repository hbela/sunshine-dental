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
 * Validate the *shape* of a phone number.
 *
 * Hungarian numbers (+36 / 0036 / 06) are held to the strict national shape the
 * voice agent enforces (see `workflows/scripts/retell-add-language.mjs`), so an
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

  // Strip grouping (spaces, dashes, parens, dots) so the rules below see the
  // compact "+<country><national>" or bare-digit form.
  const compact = s.replace(/[\s()./-]/g, '');

  // Hungarian numbers get the strict rule (and are NOT rescued by the generic
  // fallback below when malformed).
  if (/^(?:\+36|0036|06)/.test(compact)) return HUNGARIAN_PHONE.test(compact);

  // Other international numbers: normalize a "00" trunk to "+" and bound length.
  const intl = compact.startsWith('00') ? '+' + compact.slice(2) : compact;
  if (intl.startsWith('+')) return /^\+\d{8,15}$/.test(intl);

  // A bare local number with no country code: accept 7–12 digits so patients
  // outside Hungary who type a national number without a prefix still pass.
  return /^\d{7,12}$/.test(compact);
}
