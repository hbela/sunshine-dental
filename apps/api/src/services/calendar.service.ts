import { prisma } from '../lib/prisma.js';
import { defaultServiceCode, durationFor, slotInterval } from '@repo/shared';
import { clinic } from '../lib/clinic.js';
import { decryptOrPlaceholder } from '../lib/crypto.js';
import { dateToStr, timeToStr } from '../lib/datetime.js';
import { expandRecurrence } from '../lib/recurrence.js';
import { providerNameWhere } from '../lib/name.js';

type CalendarEventRow = Awaited<ReturnType<typeof prisma.calendarEvent.findMany>>[number];

/** A half-open [start, end) span of a day, in minutes since midnight. */
export interface MinuteRange {
  start: number;
  end: number;
}

/**
 * Walk each availability window on `interval` boundaries and keep every start
 * where a `duration`-long appointment fits without running past the window or
 * colliding with an unavailable range.
 *
 * Pure and exported so slot behaviour can be tested without a database — this
 * is the arithmetic every booking depends on.
 */
export function generateSlots(
  windows: readonly MinuteRange[],
  unavailable: readonly MinuteRange[],
  duration: number,
  interval: number,
): string[] {
  const slots: string[] = [];

  for (const window of windows) {
    for (let start = window.start; start < window.end; start += interval) {
      const end = start + duration;
      if (end > window.end) continue;

      const collides = unavailable.some((range) => start < range.end && end > range.start);
      if (collides) continue;

      const hh = Math.floor(start / 60).toString().padStart(2, '0');
      const mm = (start % 60).toString().padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }

  return slots;
}

/** A concrete occurrence of a (possibly recurring) calendar event. */
interface ExpandedEvent {
  event: CalendarEventRow;
  start: Date;
  end: Date;
}

/**
 * Fetch a provider's calendar events overlapping [rangeStart, rangeEnd],
 * expanding any recurring series into concrete occurrences. Non-recurring
 * events are returned as a single occurrence.
 */
async function expandedEventsInRange(
  providerId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ExpandedEvent[]> {
  const events = await prisma.calendarEvent.findMany({
    where: {
      providerId,
      OR: [
        // non-recurring: must overlap the window
        { recurrence: null, start: { lte: rangeEnd }, end: { gte: rangeStart } },
        // recurring: series must have started by the window end; occurrences filtered below
        { recurrence: { not: null }, start: { lte: rangeEnd } },
      ],
    },
    orderBy: { start: 'asc' },
  });

  const out: ExpandedEvent[] = [];
  for (const e of events) {
    if (e.recurrence) {
      for (const occ of expandRecurrence(e.start, e.end, e.recurrence, rangeStart, rangeEnd)) {
        out.push({ event: e, start: occ.start, end: occ.end });
      }
    } else {
      out.push({ event: e, start: e.start, end: e.end });
    }
  }
  return out;
}

// Helper: convert time string "HH:MM" to minutes from midnight
function timeToMinutes(timeStr: string) {
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

// Helper: extract HH:MM from a Date (using UTC)
function dateToTimeString(date: Date) {
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

// Helper: extract HH:MM from prisma @db.Time field
function prismaTimeToTimeString(date: Date | null) {
  if (!date) return null;
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export class CalendarService {
  /**
   * Get available appointment slots for a given date.
   * Availability is based on CalendarEvent records of type AVAILABLE,
   * minus BLOCKED/VACATION events and existing appointments.
   */
  static async getAvailableSlots(dateString: string, type: string, providerId?: string, providerName?: string) {
    let provider;

    if (providerId) {
      provider = await prisma.provider.findUnique({ where: { id: providerId }, include: { user: true } });
    } else if (providerName) {
      // Token-aware, order-independent match so "Nagy Ibolya" and
      // "Ibolya Nagy" resolve to the same doctor.
      provider = await prisma.provider.findFirst({
        where: providerNameWhere(providerName),
        include: { user: true },
      });
    } else {
      provider = await prisma.provider.findFirst({ include: { user: true } }); // Fallback
    }

    if (!provider) {
      throw new Error('Provider not found');
    }

    const duration = durationFor(clinic, type);

    // Build date range for the requested day (full UTC day)
    const dayStart = new Date(`${dateString}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateString}T23:59:59.999Z`);

    // Expand recurring events too, then partition by type for this day.
    const occurrences = await expandedEventsInRange(provider.id, dayStart, dayEnd);

    const availableEvents = occurrences.filter((o) => o.event.type === 'AVAILABLE');

    if (availableEvents.length === 0) {
      return { slots: [], duration, provider_name: provider.user.name };
    }

    const blockedRanges = occurrences
      .filter((o) => o.event.type === 'BLOCKED' || o.event.type === 'VACATION')
      .map((o) => ({
        start: timeToMinutes(dateToTimeString(o.start)),
        end: timeToMinutes(dateToTimeString(o.end)),
      }));

    // 3. Get existing appointments for this date
    const appointments = await prisma.appointment.findMany({
      where: {
        providerId: provider.id,
        date: dayStart,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    });

    const appointmentRanges = appointments.map(a => {
      const start = timeToMinutes(prismaTimeToTimeString(a.startTime)!);
      return { start, end: start + a.durationMinutes };
    });

    // Merge all unavailable ranges
    const allUnavailableRanges = [...blockedRanges, ...appointmentRanges];

    // 4. Generate slots within each AVAILABLE window
    const availableSlots = generateSlots(
      availableEvents.map((event) => ({
        start: timeToMinutes(dateToTimeString(event.start)),
        end: timeToMinutes(dateToTimeString(event.end)),
      })),
      allUnavailableRanges,
      duration,
      slotInterval(clinic),
    );

    return { slots: availableSlots, duration, provider_name: provider.user.name };
  }

  /**
   * Get all active providers that have at least one bookable slot on a given date.
   * Used by the Retell list_available_providers function.
   */
  static async getAvailableProviders(dateString: string, type?: string) {
    const dayStart = new Date(`${dateString}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateString}T23:59:59.999Z`);

    // Find active providers with at least one AVAILABLE event on this date
    const providers = await prisma.provider.findMany({
      where: {
        isActive: true,
        calendarEvents: {
          some: {
            type: 'AVAILABLE',
            start: { lte: dayEnd },
            end: { gte: dayStart },
          },
        },
      },
      include: { user: true },
    });

    // For each provider count actual bookable slots (respects blocks + appointments)
    const results = await Promise.all(
      providers.map(async (p) => {
        const { slots } = await CalendarService.getAvailableSlots(
          dateString,
          type ?? defaultServiceCode(clinic),
          p.id,
        );
        return { provider_id: p.id, provider_name: p.user.name, available_slots: slots.length };
      })
    );

    return results.filter(r => r.available_slots > 0);
  }

  /**
   * Get a unified event stream for a provider within a date range
   * (for react-big-calendar): availability/blocked/vacation CalendarEvents
   * merged with appointments. Each item is tagged with `kind` so the client
   * can colour it and decide click behaviour.
   */
  static async getEvents(providerId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // 1. CalendarEvents overlapping the range — recurring series expanded into
    //    concrete occurrences. Occurrences carry the series definition
    //    (recurrence + seriesStart/seriesEnd) so the editor can edit the whole
    //    series rather than the clicked instance.
    const occurrences = await expandedEventsInRange(providerId, fromDate, toDate);

    const calendarEvents = occurrences.map(({ event: e, start, end }) => ({
      id: e.id,
      kind: 'availability' as const,
      title: e.title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: e.allDay,
      eventType: e.type,
      notes: e.notes,
      recurrence: e.recurrence,
      seriesStart: e.recurrence ? e.start.toISOString() : undefined,
      seriesEnd: e.recurrence ? e.end.toISOString() : undefined,
    }));

    // 2. Appointments in the same date range (date is a @db.Date column)
    const dayStart = new Date(`${dateToStr(fromDate)}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateToStr(toDate)}T23:59:59.999Z`);

    const appointments = await prisma.appointment.findMany({
      where: { providerId, date: { gte: dayStart, lte: dayEnd } },
      orderBy: { date: 'asc' },
    });

    // PII fields degrade to a placeholder while the keyring is locked so the
    // staff calendar stays usable (times/types stay visible, names don't).
    const appointmentEvents = appointments.map((a) => {
      const ds = dateToStr(a.date);
      const patientName = decryptOrPlaceholder(a.patientName);
      return {
        id: `appt_${a.id}`,
        kind: 'appointment' as const,
        appointmentId: a.id,
        title: `${patientName} · ${a.appointmentType}`,
        start: new Date(`${ds}T${timeToStr(a.startTime)}:00.000Z`).toISOString(),
        end: new Date(`${ds}T${timeToStr(a.endTime)}:00.000Z`).toISOString(),
        allDay: false,
        status: a.status,
        appointmentType: a.appointmentType,
        patientName,
        patientPhone: a.patientPhone === null ? null : decryptOrPlaceholder(a.patientPhone),
        notes: a.notes === null ? null : decryptOrPlaceholder(a.notes),
      };
    });

    return [...calendarEvents, ...appointmentEvents];
  }

  /**
   * Create a calendar event.
   */
  static async createEvent(data: {
    providerId: string;
    title: string;
    start: string;
    end: string;
    allDay?: boolean;
    type?: string;
    recurrence?: string;
    notes?: string;
    createdBy?: string;
  }) {
    const event = await prisma.calendarEvent.create({
      data: {
        providerId: data.providerId,
        title: data.title,
        start: new Date(data.start),
        end: new Date(data.end),
        allDay: data.allDay ?? false,
        type: (data.type as any) ?? 'AVAILABLE',
        recurrence: data.recurrence || null,
        notes: data.notes || null,
        createdBy: data.createdBy || null,
      },
    });

    return {
      ...event,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  /**
   * Update a calendar event.
   */
  static async updateEvent(id: string, data: Record<string, any>) {
    const updateData: Record<string, any> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.start !== undefined) updateData.start = new Date(data.start);
    if (data.end !== undefined) updateData.end = new Date(data.end);
    if (data.allDay !== undefined) updateData.allDay = data.allDay;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.recurrence !== undefined) updateData.recurrence = data.recurrence;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: updateData,
    });

    return {
      ...event,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  /**
   * Delete a calendar event.
   */
  static async deleteEvent(id: string) {
    await prisma.calendarEvent.delete({ where: { id } });
  }
}
