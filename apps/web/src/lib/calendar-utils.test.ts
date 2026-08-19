import { describe, it, expect } from 'vitest'
import { isoToWall, wallToIso, wallToDateTimeParts, inputValueToWall, rangeForView } from './calendar-utils'

// 2026-08-12 is a Wednesday; 2026-08-16 is a Sunday.
const WEDNESDAY = new Date(2026, 7, 12)
const SUNDAY = new Date(2026, 7, 16)

describe('isoToWall / wallToIso', () => {
  it('round-trips a UTC instant through wall-clock space', () => {
    const iso = '2026-08-12T09:30:00.000Z'
    expect(wallToIso(isoToWall(iso))).toBe(iso)
  })

  it('maps UTC components to local wall-clock parts', () => {
    const wall = isoToWall('2026-08-12T09:30:00.000Z')
    expect(wallToDateTimeParts(wall)).toEqual({ date: '2026-08-12', time: '09:30' })
  })

  it('inputValueToWall parses datetime-local values', () => {
    const wall = inputValueToWall('2026-08-12T09:30')
    expect(wallToDateTimeParts(wall)).toEqual({ date: '2026-08-12', time: '09:30' })
  })
})

// Note on `to` values: wallToIso is minute-granular (seconds/ms are zeroed),
// so end-of-day/week bounds come out as 23:59:00.000Z — the whole app works
// in minute precision, nothing schedules inside the final minute of a day.
describe('rangeForView', () => {
  it('week view with Monday start (hu/de) spans Mon–Sun', () => {
    const { from, to } = rangeForView(WEDNESDAY, 'week', 1)
    expect(from).toBe('2026-08-10T00:00:00.000Z') // Monday
    expect(to).toBe('2026-08-16T23:59:00.000Z') // Sunday end-of-day
  })

  it('week view with Sunday start (en) spans Sun–Sat', () => {
    const { from, to } = rangeForView(WEDNESDAY, 'week', 0)
    expect(from).toBe('2026-08-09T00:00:00.000Z') // Sunday
    expect(to).toBe('2026-08-15T23:59:00.000Z') // Saturday end-of-day
  })

  // Regression: with the buggy Sunday default, a Sunday anchor produced a
  // fetch window starting ON that Sunday, so hu/de week view (Mon–Sun)
  // silently missed everything before it — and every trailing Sunday event.
  it('a Sunday anchor with Monday start covers the whole displayed week', () => {
    const { from, to } = rangeForView(SUNDAY, 'week', 1)
    expect(from).toBe('2026-08-10T00:00:00.000Z') // the PRECEDING Monday
    expect(to).toBe('2026-08-16T23:59:00.000Z') // that Sunday itself
  })

  it('month view with Monday start covers the full displayed grid', () => {
    // August 2026: 1st is a Saturday, 31st a Monday — the Monday-start grid
    // runs Mon Jul 27 → Sun Sep 6 (the week containing Aug 31 ends then).
    const { from, to } = rangeForView(new Date(2026, 7, 15), 'month', 1)
    expect(from).toBe('2026-07-27T00:00:00.000Z')
    expect(to).toBe('2026-09-06T23:59:00.000Z')
  })

  it('day and agenda views ignore weekStartsOn', () => {
    for (const start of [0, 1] as const) {
      const day = rangeForView(WEDNESDAY, 'day', start)
      expect(day.from).toBe('2026-08-12T00:00:00.000Z')
      expect(day.to).toBe('2026-08-12T23:59:00.000Z')
      const agenda = rangeForView(WEDNESDAY, 'agenda', start)
      expect(agenda.from).toBe('2026-08-12T00:00:00.000Z')
    }
  })
})
