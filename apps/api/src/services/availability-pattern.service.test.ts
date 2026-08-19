import { describe, expect, it } from 'vitest';
import { buildPatternCalendarProjection } from './availability-pattern.service.js';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('availability pattern calendar projection', () => {
  it('anchors each weekly range to its first matching date and preserves a finite end', () => {
    const projection = buildPatternCalendarProjection({
      effectiveFrom: date('2026-08-19'), // Wednesday
      effectiveUntil: date('2026-09-30'),
      windows: [
        { weekday: 1, ranges: [{ start: '09:00', end: '12:00' }] },
        {
          weekday: 3,
          ranges: [
            { start: '10:00', end: '13:00' },
            { start: '14:00', end: '17:00' },
          ],
        },
      ],
      exceptions: [],
    });

    expect(projection.recurring).toHaveLength(3);
    expect(projection.recurring[0]!.start.toISOString()).toBe(
      '2026-08-24T09:00:00.000Z',
    );
    expect(projection.recurring[0]!.recurrence).toBe(
      'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20260930',
    );
    expect(projection.recurring[1]!.start.toISOString()).toBe(
      '2026-08-19T10:00:00.000Z',
    );
  });

  it('excludes every recurring window and creates exact replacement windows for an exception', () => {
    const projection = buildPatternCalendarProjection({
      effectiveFrom: date('2026-08-17'),
      effectiveUntil: null,
      windows: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
      exceptions: [
        {
          id: 'exception-1',
          date: date('2026-08-24'),
          windows: [{ start: '12:00', end: '15:00' }],
          createdBy: 'user-1',
        },
      ],
    });

    expect(
      projection.recurring[0]!.excludedDates.map((value) =>
        value.toISOString(),
      ),
    ).toEqual(['2026-08-24T00:00:00.000Z']);
    expect(projection.replacements).toEqual([
      expect.objectContaining({
        exceptionId: 'exception-1',
        createdBy: 'user-1',
        start: new Date('2026-08-24T12:00:00.000Z'),
        end: new Date('2026-08-24T15:00:00.000Z'),
      }),
    ]);
  });

  it('represents a closed-day exception with exclusions and no replacement events', () => {
    const projection = buildPatternCalendarProjection({
      effectiveFrom: date('2026-08-17'),
      effectiveUntil: null,
      windows: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
      exceptions: [
        {
          id: 'closed',
          date: date('2026-08-24'),
          windows: [],
          createdBy: null,
        },
      ],
    });

    expect(projection.recurring[0]!.excludedDates).toHaveLength(1);
    expect(projection.replacements).toEqual([]);
  });
});
