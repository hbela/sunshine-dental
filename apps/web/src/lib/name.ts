import { useTranslation } from 'react-i18next'

/**
 * Locale-aware name rendering. A user's name is stored as structured
 * `title` / `givenName` / `familyName` fields (plus a legacy canonical `name`
 * string). Hungarian renders family-first ("Dr. Nagy Ibolya"); English/German
 * render given-first ("Dr. Ibolya Nagy").
 */
export interface NameParts {
  title?: string | null
  givenName?: string | null
  familyName?: string | null
  /** Legacy single string — used as a fallback when structured parts are absent. */
  name?: string | null
}

/** Canonical Western-order string ("Dr. Ibolya Nagy"), used for the `name` field. */
export function canonicalName(parts: NameParts): string {
  return [parts.title, parts.givenName, parts.familyName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

/** Render a name in the given language's conventional order. */
export function displayName(parts: NameParts, lang: string): string {
  const title = (parts.title ?? '').trim()
  const given = (parts.givenName ?? '').trim()
  const family = (parts.familyName ?? '').trim()
  if (!given && !family) return (parts.name ?? '').trim()
  const ordered = lang.split('-')[0] === 'hu' ? [family, given] : [given, family]
  return [title, ...ordered].map((s) => s.trim()).filter(Boolean).join(' ')
}

/** The given name alone (Keresztnév) — for greetings. Falls back to the first non-honorific token. */
export function givenNameOf(parts: NameParts): string {
  const given = (parts.givenName ?? '').trim()
  if (given) return given
  const raw = (parts.name ?? '').trim()
  if (!raw) return ''
  const tokens = raw.split(/\s+/).filter((p) => !p.endsWith('.'))
  return tokens[0] ?? raw
}

/** Hook returning a `displayName` bound to the active UI language. */
export function useDisplayName() {
  const { i18n } = useTranslation()
  const lang = i18n.language ?? 'en'
  return (parts: NameParts) => displayName(parts, lang)
}
