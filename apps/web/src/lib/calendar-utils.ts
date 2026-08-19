import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
} from 'date-fns'
import type { View } from 'react-big-calendar'

/**
 * The API stores times as "clinic wall-clock" on the UTC instant (e.g. 09:00Z
 * means 9am at the clinic). To keep the calendar consistent regardless of the
 * browser timezone, we map a UTC instant to a local Date whose Y/M/D/H/M equal
 * the UTC components, and back. The calendar therefore operates entirely in
 * "wall-clock space".
 */
export function isoToWall(iso: string): Date {
  const d = new Date(iso)
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    0,
    0,
  )
}

/** Inverse of {@link isoToWall}: treat a wall-clock Date's local parts as UTC. */
export function wallToIso(d: Date): string {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0),
  ).toISOString()
}

const pad = (n: number) => n.toString().padStart(2, '0')

/** A wall-clock Date → { date: "YYYY-MM-DD", time: "HH:MM" } for the appointments API. */
export function wallToDateTimeParts(d: Date): { date: string; time: string } {
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** A wall-clock Date → "YYYY-MM-DDTHH:MM" for <input type="datetime-local">. */
export function wallToInputValue(d: Date): string {
  const { date, time } = wallToDateTimeParts(d)
  return `${date}T${time}`
}

/** "YYYY-MM-DDTHH:MM" (from datetime-local) → wall-clock Date. */
export function inputValueToWall(value: string): Date {
  const [datePart, timePart] = value.split('T')
  const [y, m, day] = (datePart ?? '').split('-').map(Number)
  const [hh, mm] = (timePart ?? '').split(':').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, 0, 0)
}

/** Compute the visible [from, to] ISO range for a given calendar date + view. */
export function rangeForView(
  date: Date,
  view: View,
  // MUST match the week-start the calendar renders for the active locale
  // (Monday for hu/de, Sunday for en) — otherwise the fetch window is
  // misaligned with the displayed week and events at its edges (e.g. Sunday
  // for hu/de) silently go missing. date-fns defaults to Sunday (0).
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): { from: string; to: string } {
  let start: Date
  let end: Date
  switch (view) {
    case 'day':
      start = startOfDay(date)
      end = endOfDay(date)
      break
    case 'month':
      start = startOfWeek(startOfMonth(date), { weekStartsOn })
      end = endOfWeek(endOfMonth(date), { weekStartsOn })
      break
    case 'agenda':
      start = startOfDay(date)
      end = endOfDay(addDays(date, 30))
      break
    case 'week':
    case 'work_week':
    default:
      start = startOfWeek(date, { weekStartsOn })
      end = endOfWeek(date, { weekStartsOn })
      break
  }
  return { from: wallToIso(start), to: wallToIso(end) }
}
