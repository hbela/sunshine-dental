/** Shared date/time helpers for serializing Prisma @db.Date / @db.Time fields (stored as UTC). */

const pad = (n: number) => n.toString().padStart(2, '0');

/** A Prisma @db.Date value → "YYYY-MM-DD". */
export function dateToStr(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** A Prisma @db.Time value → "HH:MM". */
export function timeToStr(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
export function strToDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** "HH:MM" → Date on the 1970 epoch day (for @db.Time columns). */
export function strToTime(timeStr: string): Date {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

/** Add `minutes` to a "HH:MM" string and return a new "HH:MM" string. */
export function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
