/**
 * Normalise a raw API URL into a valid http(s) origin, or null if it can't be.
 * Accepts values with or without a protocol (e.g. "127.0.0.1:3100").
 */
export function normalizeBaseUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  // Try as-is (must be an absolute http/https URL).
  try {
    const u = new URL(value)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin
  } catch {
    /* fall through */
  }
  // Try assuming a missing protocol (e.g. "localhost:3100", "127.0.0.1:3100").
  try {
    const u = new URL(`http://${value}`)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin
  } catch {
    /* ignore */
  }
  return null
}

/**
 * The API origin used by both the axios client and the better-auth client.
 *
 * - VITE_API_URL set to a valid absolute URL → use it (direct, e.g. production).
 * - unset/empty (default) → '' meaning same-origin, so requests go through the
 *   Vite dev proxy. This keeps the session cookie first-party and avoids CORS.
 * - set but malformed → same-origin fallback rather than crashing.
 */
export const API_BASE_URL = (() => {
  // In dev always go through the Vite proxy (same-origin). This avoids CORS,
  // keeps the session cookie first-party, and ignores any stale VITE_API_URL
  // lingering in the shell.
  if (import.meta.env.DEV) return ''
  const raw = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim()
  if (!raw) return '' // same-origin
  return normalizeBaseUrl(raw) ?? ''
})()
