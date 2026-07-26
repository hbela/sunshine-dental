import { describe, it, expect } from 'vitest';
import { generateSlots } from './calendar.service.js';

/**
 * Slot arithmetic, pinned.
 *
 * This walk used to be inlined in `getAvailableSlots` with a hardcoded 30-minute
 * stride. Extracting it made the stride configurable (R3) — these tests exist to
 * prove that with the default interval the output is byte-identical to the old
 * behaviour, and that a smaller interval only ever *adds* start times.
 */

/** A Sunshine weekday: 09:00–13:00, lunch, 14:00–17:00 (from the seed config). */
const WORKDAY = [
  { start: 9 * 60, end: 13 * 60 },
  { start: 14 * 60, end: 17 * 60 },
];

describe('generateSlots at the historical 30-minute stride', () => {
  it('lays a 30-minute service on every half hour that fits', () => {
    expect(generateSlots(WORKDAY, [], 30, 30)).toEqual([
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    ]);
  });

  it('stops a 60-minute service early enough to finish inside the window', () => {
    const slots = generateSlots(WORKDAY, [], 60, 30);
    expect(slots.at(0)).toBe('09:00');
    // 12:30 would end at 13:30, past the morning window.
    expect(slots).not.toContain('12:30');
    expect(slots).toContain('12:00');
    expect(slots.at(-1)).toBe('16:00');
  });

  it('never offers a 90-minute service a start it cannot complete', () => {
    for (const slot of generateSlots(WORKDAY, [], 90, 30)) {
      const [h, m] = slot.split(':').map(Number);
      const start = h! * 60 + m!;
      const window = WORKDAY.find((w) => start >= w.start && start < w.end)!;
      expect(start + 90).toBeLessThanOrEqual(window.end);
    }
  });

  it('drops only the slots that overlap an existing appointment', () => {
    // A 30-minute booking at 10:00 blocks 09:30 (ends 10:30) and 10:00.
    const slots = generateSlots(WORKDAY, [{ start: 600, end: 630 }], 60, 30);
    expect(slots).not.toContain('09:30');
    expect(slots).not.toContain('10:00');
    expect(slots).toContain('09:00');
    expect(slots).toContain('10:30');
  });

  it('treats ranges as half-open — a slot may start exactly when a block ends', () => {
    // Lunch 13:00–14:00 must not eat the 14:00 start.
    const slots = generateSlots(WORKDAY, [{ start: 13 * 60, end: 14 * 60 }], 30, 30);
    expect(slots).toContain('14:00');
    expect(slots).toContain('12:30');
  });

  it('returns nothing when the service is longer than every window', () => {
    expect(generateSlots(WORKDAY, [], 8 * 60, 30)).toEqual([]);
  });
});

describe('configurable stride (R3)', () => {
  it('a 15-minute interval is a strict superset of the 30-minute one', () => {
    const coarse = generateSlots(WORKDAY, [], 30, 30);
    const fine = generateSlots(WORKDAY, [], 30, 15);
    for (const slot of coarse) expect(fine).toContain(slot);
    expect(fine).toContain('09:15');
    expect(fine.length).toBeGreaterThan(coarse.length);
  });

  it('lets a 45-minute service start off the half hour', () => {
    // The reason R3 exists: at a 30-minute stride these could only ever be
    // offered on the hour or half hour, wasting 15 minutes each time.
    expect(generateSlots(WORKDAY, [], 45, 15)).toContain('09:45');
    expect(generateSlots(WORKDAY, [], 45, 30)).not.toContain('09:45');
  });
});
