import type {
  AvailabilityDay,
  AvailabilityPatternInput,
  AvailabilityRange,
} from '@repo/shared';
import { Prisma } from '../generated/prisma-client/index.js';
import { prisma } from '../lib/prisma.js';
import { dateToStr, strToDate } from '../lib/datetime.js';
import { HttpError } from '../lib/errors.js';

type Tx = Prisma.TransactionClient;

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

function minutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (mins ?? 0);
}

function previousDate(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

function firstWeekdayOnOrAfter(start: Date, isoWeekday: number): Date {
  const result = new Date(start);
  const current = result.getUTCDay() === 0 ? 7 : result.getUTCDay();
  result.setUTCDate(result.getUTCDate() + ((isoWeekday - current + 7) % 7));
  return result;
}

function atTime(date: Date, time: string): Date {
  return new Date(`${dateToStr(date)}T${time}:00.000Z`);
}

function validateRanges(
  ranges: readonly AvailabilityRange[],
  label: string,
): void {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i]!;
    if (minutes(range.end) <= minutes(range.start)) {
      throw new HttpError(400, `${label}: end must be after start`);
    }
    if (i > 0 && minutes(range.start) < minutes(sorted[i - 1]!.end)) {
      throw new HttpError(400, `${label}: availability ranges cannot overlap`);
    }
  }
}

function normalizeWindows(
  windows: readonly AvailabilityDay[],
): AvailabilityDay[] {
  const seen = new Set<number>();
  const normalized = windows
    .filter((day) => day.ranges.length > 0)
    .map((day) => {
      if (seen.has(day.weekday))
        throw new HttpError(400, `Weekday ${day.weekday} is duplicated`);
      seen.add(day.weekday);
      validateRanges(day.ranges, `Weekday ${day.weekday}`);
      return {
        weekday: day.weekday,
        ranges: [...day.ranges].sort((a, b) => a.start.localeCompare(b.start)),
      };
    })
    .sort((a, b) => a.weekday - b.weekday);
  if (normalized.length === 0)
    throw new HttpError(400, 'At least one availability range is required');
  return normalized;
}

function parseWindows(value: Prisma.JsonValue): AvailabilityDay[] {
  return value as unknown as AvailabilityDay[];
}

function parseExceptionWindows(value: Prisma.JsonValue): AvailabilityRange[] {
  return value as unknown as AvailabilityRange[];
}

export interface PatternCalendarProjection {
  recurring: Array<{
    start: Date;
    end: Date;
    recurrence: string;
    excludedDates: Date[];
  }>;
  replacements: Array<{
    exceptionId: string;
    createdBy: string | null;
    start: Date;
    end: Date;
  }>;
}

/** Pure projection used by the transactional reconciler and its unit tests. */
export function buildPatternCalendarProjection(pattern: {
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  windows: Prisma.JsonValue;
  exceptions: Array<{
    id: string;
    date: Date;
    windows: Prisma.JsonValue;
    createdBy: string | null;
  }>;
}): PatternCalendarProjection {
  const recurring: PatternCalendarProjection['recurring'] = [];
  const replacements: PatternCalendarProjection['replacements'] = [];
  const excludedDates = pattern.exceptions.map((exception) => exception.date);

  for (const day of parseWindows(pattern.windows)) {
    const firstDate = firstWeekdayOnOrAfter(pattern.effectiveFrom, day.weekday);
    if (pattern.effectiveUntil && firstDate > pattern.effectiveUntil) continue;
    for (const range of day.ranges) {
      recurring.push({
        start: atTime(firstDate, range.start),
        end: atTime(firstDate, range.end),
        recurrence: [
          'FREQ=WEEKLY',
          'INTERVAL=1',
          `BYDAY=${WEEKDAYS[day.weekday - 1]}`,
          ...(pattern.effectiveUntil
            ? [`UNTIL=${dateToStr(pattern.effectiveUntil).replace(/-/g, '')}`]
            : []),
        ].join(';'),
        excludedDates,
      });
    }
  }
  for (const exception of pattern.exceptions) {
    for (const range of parseExceptionWindows(exception.windows)) {
      replacements.push({
        exceptionId: exception.id,
        createdBy: exception.createdBy,
        start: atTime(exception.date, range.start),
        end: atTime(exception.date, range.end),
      });
    }
  }
  return { recurring, replacements };
}

function serializeException(exception: any) {
  return {
    id: exception.id,
    patternId: exception.patternId,
    date: dateToStr(exception.date),
    windows: parseExceptionWindows(exception.windows),
    createdAt: exception.createdAt.toISOString(),
    updatedAt: exception.updatedAt.toISOString(),
  };
}

function serializePattern(pattern: any) {
  return {
    id: pattern.id,
    providerId: pattern.providerId,
    effectiveFrom: dateToStr(pattern.effectiveFrom),
    effectiveUntil: pattern.effectiveUntil
      ? dateToStr(pattern.effectiveUntil)
      : null,
    windows: parseWindows(pattern.windows),
    createdAt: pattern.createdAt.toISOString(),
    updatedAt: pattern.updatedAt.toISOString(),
    exceptions: (pattern.exceptions ?? []).map(serializeException),
  };
}

async function assertNoOverlap(
  tx: Tx,
  providerId: string,
  from: Date,
  until: Date | null,
  excludeId?: string,
): Promise<void> {
  const overlap = await tx.availabilityPattern.findFirst({
    where: {
      providerId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      effectiveFrom: { lte: until ?? new Date('9999-12-31T00:00:00.000Z') },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: from } }],
    },
  });
  if (overlap) throw new HttpError(409, 'Availability patterns cannot overlap');
}

async function reconcilePattern(tx: Tx, patternId: string): Promise<void> {
  const pattern = await tx.availabilityPattern.findUnique({
    where: { id: patternId },
    include: { exceptions: { orderBy: { date: 'asc' } } },
  });
  if (!pattern) return;

  await tx.calendarEvent.deleteMany({
    where: { availabilityPatternId: patternId },
  });

  const projection = buildPatternCalendarProjection(pattern);
  for (const recurring of projection.recurring) {
    const event = await tx.calendarEvent.create({
      data: {
        providerId: pattern.providerId,
        title: 'Availability',
        start: recurring.start,
        end: recurring.end,
        type: 'AVAILABLE',
        recurrence: recurring.recurrence,
        availabilityPatternId: pattern.id,
        createdBy: pattern.createdBy,
      },
    });
    if (recurring.excludedDates.length > 0) {
      await tx.calendarEventExclusion.createMany({
        data: recurring.excludedDates.map((date) => ({
          eventId: event.id,
          date,
        })),
        skipDuplicates: true,
      });
    }
  }

  for (const replacement of projection.replacements) {
    await tx.calendarEvent.create({
      data: {
        providerId: pattern.providerId,
        title: 'Availability exception',
        start: replacement.start,
        end: replacement.end,
        type: 'AVAILABLE',
        availabilityPatternId: pattern.id,
        availabilityExceptionId: replacement.exceptionId,
        createdBy: replacement.createdBy,
      },
    });
  }
}

export class AvailabilityPatternService {
  static async list(providerId: string) {
    const patterns = await prisma.availabilityPattern.findMany({
      where: { providerId },
      include: { exceptions: { orderBy: { date: 'asc' } } },
      orderBy: { effectiveFrom: 'asc' },
    });
    return patterns.map(serializePattern);
  }

  static async create(
    providerId: string,
    input: AvailabilityPatternInput,
    createdBy?: string,
  ) {
    const from = strToDate(input.effectiveFrom);
    const until = input.effectiveUntil ? strToDate(input.effectiveUntil) : null;
    if (until && until < from)
      throw new HttpError(400, 'Effective end must not precede start');
    const windows = normalizeWindows(input.windows);

    let id: string;
    try {
      id = await prisma.$transaction(
        async (tx) => {
          const previousOpen = await tx.availabilityPattern.findFirst({
            where: {
              providerId,
              effectiveUntil: null,
              effectiveFrom: { lt: from },
            },
            orderBy: { effectiveFrom: 'desc' },
          });
          if (previousOpen) {
            const closedUntil = previousDate(from);
            await tx.availabilityPattern.update({
              where: { id: previousOpen.id },
              data: { effectiveUntil: closedUntil },
            });
            // Exceptions in the superseded portion belong to the old pattern and
            // cannot remain outside its newly shortened effective range.
            await tx.availabilityException.deleteMany({
              where: { patternId: previousOpen.id, date: { gte: from } },
            });
            await reconcilePattern(tx, previousOpen.id);
          }
          await assertNoOverlap(tx, providerId, from, until);
          const created = await tx.availabilityPattern.create({
            data: {
              providerId,
              effectiveFrom: from,
              effectiveUntil: until,
              windows,
              createdBy,
            },
          });
          await reconcilePattern(tx, created.id);
          return created.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new HttpError(
          409,
          'Availability changed concurrently; please try again',
        );
      }
      throw error;
    }
    return this.get(id);
  }

  static async get(id: string) {
    const pattern = await prisma.availabilityPattern.findUnique({
      where: { id },
      include: { exceptions: { orderBy: { date: 'asc' } } },
    });
    if (!pattern) throw new HttpError(404, 'Availability pattern not found');
    return serializePattern(pattern);
  }

  static async update(id: string, input: AvailabilityPatternInput) {
    const from = strToDate(input.effectiveFrom);
    const until = input.effectiveUntil ? strToDate(input.effectiveUntil) : null;
    if (until && until < from)
      throw new HttpError(400, 'Effective end must not precede start');
    const windows = normalizeWindows(input.windows);

    try {
      await prisma.$transaction(
        async (tx) => {
          const existing = await tx.availabilityPattern.findUnique({
            where: { id },
            include: { exceptions: true },
          });
          if (!existing)
            throw new HttpError(404, 'Availability pattern not found');
          if (
            existing.exceptions.some(
              (exception) =>
                exception.date < from || (until && exception.date > until),
            )
          ) {
            throw new HttpError(
              409,
              'Remove exceptions outside the new effective range first',
            );
          }
          await assertNoOverlap(tx, existing.providerId, from, until, id);
          await tx.availabilityPattern.update({
            where: { id },
            data: { effectiveFrom: from, effectiveUntil: until, windows },
          });
          await reconcilePattern(tx, id);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new HttpError(
          409,
          'Availability changed concurrently; please try again',
        );
      }
      throw error;
    }
    return this.get(id);
  }

  static async remove(id: string): Promise<void> {
    const result = await prisma.availabilityPattern.deleteMany({
      where: { id },
    });
    if (result.count === 0)
      throw new HttpError(404, 'Availability pattern not found');
  }

  static async upsertException(
    patternId: string,
    input: { date: string; windows: AvailabilityRange[] },
    createdBy?: string,
  ) {
    const date = strToDate(input.date);
    validateRanges(input.windows, input.date);
    const windows = [...input.windows].sort((a, b) =>
      a.start.localeCompare(b.start),
    );

    const exceptionId = await prisma.$transaction(async (tx) => {
      const pattern = await tx.availabilityPattern.findUnique({
        where: { id: patternId },
      });
      if (!pattern) throw new HttpError(404, 'Availability pattern not found');
      if (
        date < pattern.effectiveFrom ||
        (pattern.effectiveUntil && date > pattern.effectiveUntil)
      ) {
        throw new HttpError(
          400,
          'Exception date must be inside the pattern effective range',
        );
      }
      const exception = await tx.availabilityException.upsert({
        where: { patternId_date: { patternId, date } },
        create: { patternId, date, windows, createdBy },
        update: { windows },
      });
      await reconcilePattern(tx, patternId);
      return exception.id;
    });
    const exception = await prisma.availabilityException.findUnique({
      where: { id: exceptionId },
    });
    return serializeException(exception);
  }

  static async removeException(
    patternId: string,
    exceptionId: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const result = await tx.availabilityException.deleteMany({
        where: { id: exceptionId, patternId },
      });
      if (result.count === 0)
        throw new HttpError(404, 'Availability exception not found');
      await reconcilePattern(tx, patternId);
    });
  }
}
