import { prisma } from '../lib/prisma.js';
import { AppointmentDurations } from '@repo/shared';

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
      provider = await prisma.provider.findFirst({
        where: { user: { name: { contains: providerName, mode: 'insensitive' } } },
        include: { user: true },
      });
    } else {
      provider = await prisma.provider.findFirst({ include: { user: true } }); // Fallback
    }

    if (!provider) {
      throw new Error('Provider not found');
    }

    const duration = AppointmentDurations[type] || 30;

    // Build date range for the requested day (full UTC day)
    const dayStart = new Date(`${dateString}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateString}T23:59:59.999Z`);

    // 1. Get AVAILABLE events for this provider on this date
    const availableEvents = await prisma.calendarEvent.findMany({
      where: {
        providerId: provider.id,
        type: 'AVAILABLE',
        start: { lte: dayEnd },
        end: { gte: dayStart },
      },
      orderBy: { start: 'asc' },
    });

    if (availableEvents.length === 0) {
      return { slots: [], duration, provider_name: provider.user.name };
    }

    // 2. Get BLOCKED/VACATION events for this date
    const blockedEvents = await prisma.calendarEvent.findMany({
      where: {
        providerId: provider.id,
        type: { in: ['BLOCKED', 'VACATION'] },
        start: { lte: dayEnd },
        end: { gte: dayStart },
      },
    });

    const blockedRanges = blockedEvents.map(e => ({
      start: timeToMinutes(dateToTimeString(e.start)),
      end: timeToMinutes(dateToTimeString(e.end)),
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
    const availableSlots: string[] = [];

    for (const event of availableEvents) {
      const windowStart = timeToMinutes(dateToTimeString(event.start));
      const windowEnd = timeToMinutes(dateToTimeString(event.end));

      for (let slotStart = windowStart; slotStart < windowEnd; slotStart += 30) {
        const slotEnd = slotStart + duration;

        if (slotEnd > windowEnd) continue;

        // Check if this slot overlaps with any unavailable range
        const isOverlapping = allUnavailableRanges.some(range => {
          return slotStart < range.end && slotEnd > range.start;
        });

        if (!isOverlapping) {
          const hh = Math.floor(slotStart / 60).toString().padStart(2, '0');
          const mm = (slotStart % 60).toString().padStart(2, '0');
          availableSlots.push(`${hh}:${mm}`);
        }
      }
    }

    return { slots: availableSlots, duration, provider_name: provider.user.name };
  }

  /**
   * Get calendar events for a provider within a date range (for react-big-calendar).
   */
  static async getEvents(providerId: string, from: string, to: string) {
    const events = await prisma.calendarEvent.findMany({
      where: {
        providerId,
        start: { gte: new Date(from) },
        end: { lte: new Date(to) },
      },
      orderBy: { start: 'asc' },
    });

    return events.map(e => ({
      ...e,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
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
