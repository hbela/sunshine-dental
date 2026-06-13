/**
 * Build/parse the RRULE subset the calendar UI supports (mirrors the API's
 * lib/recurrence.ts): FREQ=DAILY|WEEKLY, BYDAY, UNTIL. Weekday indices are
 * 0=Sun … 6=Sat to match JS `getDay()`.
 */

export type RecurrenceFreq = 'none' | 'daily' | 'weekly'
export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

export interface RecurrenceParts {
  freq: RecurrenceFreq
  byday: number[] // weekday indices, weekly only
  until: string // "YYYY-MM-DD" or ""
}

/** Build an RRULE string from UI parts. Returns null for "none". */
export function buildRrule(parts: RecurrenceParts): string | null {
  if (parts.freq === 'none') return null
  const segments: string[] = [`FREQ=${parts.freq === 'daily' ? 'DAILY' : 'WEEKLY'}`, 'INTERVAL=1']
  if (parts.freq === 'weekly' && parts.byday.length > 0) {
    const sorted = [...parts.byday].sort((a, b) => a - b)
    segments.push(`BYDAY=${sorted.map((d) => WEEKDAY_CODES[d]).join(',')}`)
  }
  if (parts.until) {
    segments.push(`UNTIL=${parts.until.replace(/-/g, '')}`)
  }
  return segments.join(';')
}

/** Parse an RRULE string into UI parts (best-effort; unknown → "none"). */
export function parseRrule(rule: string | null | undefined): RecurrenceParts {
  const empty: RecurrenceParts = { freq: 'none', byday: [], until: '' }
  if (!rule) return empty

  const map: Record<string, string> = {}
  for (const kv of rule.split(';')) {
    const [k, v] = kv.split('=')
    if (k && v) map[k.trim().toUpperCase()] = v.trim()
  }

  const freq = map.FREQ?.toUpperCase()
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return empty

  const byday = map.BYDAY
    ? map.BYDAY.split(',')
        .map((d) => WEEKDAY_CODES.indexOf(d.trim().toUpperCase() as (typeof WEEKDAY_CODES)[number]))
        .filter((i) => i >= 0)
    : []

  let until = ''
  const m = map.UNTIL?.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) until = `${m[1]}-${m[2]}-${m[3]}`

  return { freq: freq === 'DAILY' ? 'daily' : 'weekly', byday, until }
}
