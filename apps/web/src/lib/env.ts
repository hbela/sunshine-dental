const FALLBACK_API_URL = 'http://localhost:3000'

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
 * Resolved once from VITE_API_URL, with a safe fallback so a malformed value
 * can never crash the app with "Failed to construct 'URL': Invalid base URL".
 */
export const API_BASE_URL =
  normalizeBaseUrl((import.meta.env.VITE_API_URL as string | undefined) ?? '') ?? FALLBACK_API_URL
