/**
 * Structured-name helpers shared across the API.
 *
 * A user's name is stored as three columns — `title` (honorific, e.g. "Dr."),
 * `givenName` (Keresztnév) and `familyName` (Vezetéknév) — plus the
 * better-auth-owned `name` string which we keep as a canonical Western-order
 * fallback. See apps/web/src/lib/name.ts for the locale-aware display side.
 */

export interface NameParts {
  title?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}

/** Honorific tokens ignored when matching a free-text name query. */
const HONORIFICS = /^(dr|dr\.|prof|prof\.|dr\.med|dr\.med\.)$/i;

/**
 * Canonical Western-order display string ("Dr. Ibolya Nagy"). Used to populate
 * the better-auth `name` field and any place that needs one opaque string.
 */
export function canonicalName(parts: NameParts): string {
  return [parts.title, parts.givenName, parts.familyName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Split a free-text name query into meaningful tokens (honorifics dropped). */
export function nameTokens(query: string): string[] {
  return query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !HONORIFICS.test(t));
}

/**
 * Order-independent Prisma `where` fragment for resolving a provider by a
 * free-text name. Every token must appear in the user's givenName OR familyName
 * (or the legacy `name` fallback), so "Nagy Ibolya" and "Ibolya Nagy" both
 * match the same doctor. Returns `undefined` when the query has no usable token.
 */
export function providerNameWhere(query: string) {
  const tokens = nameTokens(query);
  if (tokens.length === 0) return undefined;
  return {
    AND: tokens.map((tok) => ({
      user: {
        OR: [
          { givenName: { contains: tok, mode: 'insensitive' as const } },
          { familyName: { contains: tok, mode: 'insensitive' as const } },
          { name: { contains: tok, mode: 'insensitive' as const } },
        ],
      },
    })),
  };
}
