/**
 * Minimal RRULE expansion for calendar events. Supports the subset the web UI
 * produces — `FREQ=DAILY|WEEKLY`, `INTERVAL`, `BYDAY`, and `UNTIL`/`COUNT` —
 * and operates entirely in UTC to match the clinic "wall-clock on UTC instant"
 * convention used across the API (see lib/datetime.ts, calendar-utils.ts).
 *
 * Occurrences are projected on read; only the base event + its rule are stored.
 * Single-occurrence exceptions (EXDATE / per-instance overrides) are NOT
 * supported — edits/deletes apply to the whole series.
 */

export interface Occurrence {
  start: Date
  end: Date
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

interface ParsedRule {
  freq: 'DAILY' | 'WEEKLY'
  interval: number
  byday?: number[] // UTC weekday indices (0=Sun … 6=Sat)
  until?: Date // inclusive end-of-day UTC
  count?: number
}

/** Parse an RRULE string. Returns null for unsupported/invalid rules. */
export function parseRecurrence(rule: string): ParsedRule | null {
  if (!rule) return null
  const parts: Record<string, string> = {}
  for (const kv of rule.split(';')) {
    const [k, v] = kv.split('=')
    if (k && v) parts[k.trim().toUpperCase()] = v.trim()
  }

  const freq = parts.FREQ?.toUpperCase()
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return null

  const interval = parts.INTERVAL ? Math.max(1, parseInt(parts.INTERVAL, 10) || 1) : 1

  let byday: number[] | undefined
  if (parts.BYDAY) {
    byday = parts.BYDAY.split(',')
      .map((d) => WEEKDAYS.indexOf(d.trim().toUpperCase() as (typeof WEEKDAYS)[number]))
      .filter((i) => i >= 0)
    if (byday.length === 0) byday = undefined
  }

  let until: Date | undefined
  if (parts.UNTIL) {
    const m = parts.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/)
    if (m) until = new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59.999Z`)
  }

  const count = parts.COUNT ? parseInt(parts.COUNT, 10) || undefined : undefined

  return { freq, interval, byday, until, count }
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfUTCWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() - x.getUTCDay()) // back to Sunday
  return x
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && aEnd.getTime() >= bStart.getTime()
}

/**
 * Expand a recurring event into concrete occurrences intersecting
 * [rangeStart, rangeEnd]. An unparseable rule degrades to the single base
 * occurrence. Each occurrence keeps the base event's time-of-day and duration.
 */
export function expandRecurrence(
  baseStart: Date,
  baseEnd: Date,
  rule: string,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const parsed = parseRecurrence(rule)
  if (!parsed) {
    return overlaps(baseStart, baseEnd, rangeStart, rangeEnd)
      ? [{ start: baseStart, end: baseEnd }]
      : []
  }

  const durationMs = baseEnd.getTime() - baseStart.getTime()
  const hardStop = parsed.until && parsed.until.getTime() < rangeEnd.getTime() ? parsed.until : rangeEnd
  const occurrences: Occurrence[] = []
  let emitted = 0 // count from series start (for COUNT)
  const GUARD = 20000

  const push = (occStart: Date) => {
    const occEnd = new Date(occStart.getTime() + durationMs)
    if (occEnd.getTime() >= rangeStart.getTime() && occStart.getTime() <= rangeEnd.getTime()) {
      occurrences.push({ start: occStart, end: occEnd })
    }
  }

  if (parsed.freq === 'DAILY') {
    const cursor = new Date(baseStart)
    let guard = 0
    while (cursor.getTime() <= hardStop.getTime() && guard++ < GUARD) {
      if (parsed.count !== undefined && emitted >= parsed.count) break
      push(new Date(cursor))
      emitted++
      cursor.setUTCDate(cursor.getUTCDate() + parsed.interval)
    }
  } else {
    // WEEKLY — iterate day by day, emitting on matching weekdays in active weeks.
    const days = parsed.byday && parsed.byday.length ? parsed.byday : [baseStart.getUTCDay()]
    const baseWeek = startOfUTCWeek(baseStart).getTime()
    const cursor = new Date(baseStart)
    let guard = 0
    while (cursor.getTime() <= hardStop.getTime() && guard++ < GUARD) {
      const weekIndex = Math.round((startOfUTCWeek(cursor).getTime() - baseWeek) / (7 * DAY_MS))
      const onActiveWeek = weekIndex % parsed.interval === 0
      if (onActiveWeek && days.includes(cursor.getUTCDay()) && cursor.getTime() >= baseStart.getTime()) {
        if (parsed.count !== undefined && emitted >= parsed.count) break
        push(new Date(cursor))
        emitted++
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }

  return occurrences
}
