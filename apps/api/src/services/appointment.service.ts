import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { dateToStr, timeToStr, strToDate, strToTime, addMinutes } from '../lib/datetime.js';
import { AppointmentDurations, isValidPhoneNumber } from '@repo/shared';
import { CalendarService } from './calendar.service.js';
import { providerNameWhere } from '../lib/name.js';
import { assertUnlocked, decryptString, encryptString } from '../lib/crypto.js';
import { decryptRow, decryptRows, encryptRow, phoneIndexOf } from '../lib/crypto-fields.js';

const ACTIVE_STATUSES = ['CONFIRMED', 'COMPLETED'] as const;

// patientName is ciphertext, so name filtering happens in memory; cap the scan
// when no date/provider/status prunes the query (see PatientService).
const SEARCH_SCAN_CAP = 2000;

/**
 * Append a cancellation reason to existing notes. Accepts notes in either
 * state (ciphertext from a raw row, plaintext from a decrypted one) and always
 * returns ciphertext — encryptString is a no-op on already-encrypted values.
 */
function cancelledNotes(existingNotes: string | null, reason?: string): string | null {
  if (!reason) return existingNotes === null ? null : encryptString(existingNotes);
  const plain = existingNotes ? decryptString(existingNotes) + '\n' : '';
  return encryptString(`${plain}Cancelled: ${reason}`);
}

function serialize(a: any) {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: a.patientName,
    patientPhone: a.patientPhone,
    patientEmail: a.patientEmail,
    providerId: a.providerId,
    providerName: a.providerName,
    appointmentType: a.appointmentType,
    date: dateToStr(a.date),
    startTime: timeToStr(a.startTime),
    endTime: timeToStr(a.endTime),
    durationMinutes: a.durationMinutes,
    status: a.status,
    isNewPatient: a.isNewPatient,
    notes: a.notes,
    callId: a.callId,
  };
}

export interface BookInput {
  patient_name: string;
  phone?: string;
  email?: string;
  appointment_type: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  provider_id?: string;
  provider_name?: string;
  is_new_patient?: boolean;
  notes?: string;
  call_id?: string;
}

export interface CancelSearch {
  patient_name: string;
  date: string;
  time?: string;
  reason?: string;
}

export class AppointmentService {
  static async list(filters: {
    date?: string;
    providerId?: string;
    status?: string;
    patientName?: string;
    page?: number;
    limit?: number;
  }) {
    assertUnlocked();
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;

    // Structured filters stay in SQL — they prune hard. The name filter moves
    // in memory because patientName is ciphertext.
    const where: any = {};
    if (filters.date) where.date = strToDate(filters.date);
    if (filters.providerId) where.providerId = filters.providerId;
    if (filters.status) where.status = filters.status;

    if (!filters.patientName) {
      const appointments = await prisma.appointment.findMany({
        where,
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      });
      return decryptRows('appointment', appointments).map(serialize);
    }

    const candidates = await prisma.appointment.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      // Only cap when nothing else prunes the query.
      ...(Object.keys(where).length === 0 ? { take: SEARCH_SCAN_CAP } : {}),
    });
    const q = filters.patientName.toLowerCase();
    const hits = decryptRows('appointment', candidates).filter((a) =>
      a.patientName.toLowerCase().includes(q),
    );
    return hits.slice((page - 1) * limit, page * limit).map(serialize);
  }

  static async findById(id: string) {
    assertUnlocked();
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new HttpError(404, 'Appointment not found');
    return serialize(decryptRow('appointment', appointment));
  }

  static async patientHistory(patientId: string) {
    assertUnlocked();
    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });
    return decryptRows('appointment', appointments).map(serialize);
  }

  static async book(input: BookInput) {
    assertUnlocked();
    if (input.phone && !isValidPhoneNumber(input.phone)) {
      throw new HttpError(400, `Phone number "${input.phone}" is not a valid format`);
    }

    const type = input.appointment_type;
    const duration = AppointmentDurations[type] ?? 30;

    // 1. Resolve provider
    let provider;
    if (input.provider_id) {
      provider = await prisma.provider.findUnique({
        where: { id: input.provider_id },
        include: { user: true },
      });
    } else if (input.provider_name) {
      provider = await prisma.provider.findFirst({
        where: providerNameWhere(input.provider_name),
        include: { user: true },
      });
    } else {
      // Auto-assign: first active provider with the requested slot available
      const available = await CalendarService.getAvailableProviders(input.date, type);
      if (available.length === 0) {
        throw new HttpError(409, 'No provider has availability on the requested date');
      }
      provider = await prisma.provider.findUnique({
        where: { id: available[0]!.provider_id },
        include: { user: true },
      });
    }

    if (!provider) throw new HttpError(404, 'Provider not found');

    // 2. Validate the requested time is actually bookable
    const { slots } = await CalendarService.getAvailableSlots(input.date, type, provider.id);
    if (!slots.includes(input.time)) {
      throw new HttpError(409, `Slot ${input.time} is not available for the selected provider`);
    }

    // 3. Find or create the patient record (dedupe by phone blind index —
    //    phone itself is ciphertext, so equality runs on the HMAC column)
    let patient = null;
    const phoneIndex = phoneIndexOf(input.phone);
    if (phoneIndex) {
      patient = await prisma.patient.findFirst({ where: { phoneIndex } });
    }
    if (!patient) {
      patient = await prisma.patient.create({
        data: encryptRow('patient', {
          name: input.patient_name,
          phone: input.phone ?? null,
          phoneIndex,
          email: input.email ?? null,
          isNewPatient: input.is_new_patient ?? false,
        }),
      });
    }

    // 4. Create the appointment
    const endTime = addMinutes(input.time, duration);
    const appointment = await prisma.appointment.create({
      data: encryptRow('appointment', {
        patientId: patient.id,
        patientName: input.patient_name,
        patientPhone: input.phone ?? null,
        patientEmail: input.email ?? null,
        providerId: provider.id,
        providerName: provider.user.name,
        appointmentType: type as any,
        date: strToDate(input.date),
        startTime: strToTime(input.time),
        endTime: strToTime(endTime),
        durationMinutes: duration,
        status: 'CONFIRMED',
        isNewPatient: input.is_new_patient ?? false,
        notes: input.notes ?? null,
        callId: input.call_id ?? null,
      }),
    });

    return serialize(decryptRow('appointment', appointment));
  }

  static async cancelById(id: string, reason?: string) {
    assertUnlocked();
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Appointment not found');

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: cancelledNotes(existing.notes, reason),
      },
    });
    return serialize(decryptRow('appointment', appointment));
  }

  /** n8n cancel flow: look up by patient name + date (+ optional time). */
  static async cancelBySearch(search: CancelSearch) {
    assertUnlocked();
    // date + status prune to a handful of rows; the name match runs in memory
    // because patientName is ciphertext.
    const where: any = {
      date: strToDate(search.date),
      status: 'CONFIRMED',
    };
    if (search.time) where.startTime = strToTime(search.time);

    const candidates = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
    const q = search.patient_name.toLowerCase();
    const match = decryptRows('appointment', candidates).find((a) =>
      a.patientName.toLowerCase().includes(q),
    );

    if (!match) return { found: false as const };

    const appointment = await prisma.appointment.update({
      where: { id: match.id },
      data: {
        status: 'CANCELLED',
        // match.notes is plaintext here (row was decrypted for the name match);
        // cancelledNotes always returns ciphertext.
        notes: cancelledNotes(match.notes, search.reason),
      },
    });

    return { found: true as const, appointment: serialize(decryptRow('appointment', appointment)) };
  }

  static async complete(id: string) {
    assertUnlocked();
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Appointment not found');

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
    return serialize(decryptRow('appointment', appointment));
  }
}

export { ACTIVE_STATUSES };
