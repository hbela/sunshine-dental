import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { dateToStr, timeToStr, strToDate, strToTime, addMinutes } from '../lib/datetime.js';
import { AppointmentDurations, isValidPhoneNumber } from '@repo/shared';
import { CalendarService } from './calendar.service.js';
import { providerNameWhere } from '../lib/name.js';

const ACTIVE_STATUSES = ['CONFIRMED', 'COMPLETED'] as const;

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
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;

    const where: any = {};
    if (filters.date) where.date = strToDate(filters.date);
    if (filters.providerId) where.providerId = filters.providerId;
    if (filters.status) where.status = filters.status;
    if (filters.patientName) {
      where.patientName = { contains: filters.patientName, mode: 'insensitive' };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });

    return appointments.map(serialize);
  }

  static async findById(id: string) {
    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new HttpError(404, 'Appointment not found');
    return serialize(appointment);
  }

  static async patientHistory(patientId: string) {
    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });
    return appointments.map(serialize);
  }

  static async book(input: BookInput) {
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

    // 3. Find or create the patient record
    let patient = null;
    if (input.phone) {
      patient = await prisma.patient.findFirst({ where: { phone: input.phone } });
    }
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name: input.patient_name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          isNewPatient: input.is_new_patient ?? false,
        },
      });
    }

    // 4. Create the appointment
    const endTime = addMinutes(input.time, duration);
    const appointment = await prisma.appointment.create({
      data: {
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
      },
    });

    return serialize(appointment);
  }

  static async cancelById(id: string, reason?: string) {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Appointment not found');

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${existing.notes ? existing.notes + '\n' : ''}Cancelled: ${reason}` : existing.notes,
      },
    });
    return serialize(appointment);
  }

  /** n8n cancel flow: look up by patient name + date (+ optional time). */
  static async cancelBySearch(search: CancelSearch) {
    const where: any = {
      patientName: { contains: search.patient_name, mode: 'insensitive' },
      date: strToDate(search.date),
      status: 'CONFIRMED',
    };
    if (search.time) where.startTime = strToTime(search.time);

    const match = await prisma.appointment.findFirst({
      where,
      orderBy: { startTime: 'asc' },
    });

    if (!match) return { found: false as const };

    const appointment = await prisma.appointment.update({
      where: { id: match.id },
      data: {
        status: 'CANCELLED',
        notes: search.reason
          ? `${match.notes ? match.notes + '\n' : ''}Cancelled: ${search.reason}`
          : match.notes,
      },
    });

    return { found: true as const, appointment: serialize(appointment) };
  }

  static async complete(id: string) {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Appointment not found');

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
    return serialize(appointment);
  }
}

export { ACTIVE_STATUSES };
