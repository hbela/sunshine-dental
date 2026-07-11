import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { dateToStr, timeToStr } from '../lib/datetime.js';
import { isValidPhoneNumber, normalizePhoneNumber } from '@repo/shared';
import { assertUnlocked } from '../lib/crypto.js';
import { decryptRow, decryptRows, encryptRow, phoneIndexOf } from '../lib/crypto-fields.js';

// PII fields are ciphertext in the DB, so substring search runs in memory over
// decrypted rows. Cap how many rows one search scans; at single-clinic volume
// (a few thousand patients) this covers everything for years.
const SEARCH_SCAN_CAP = 2000;

/** Reject a malformed phone number (mirrors the voice agent's shape check). */
function assertValidPhone(phone?: string | null) {
  if (phone && !isValidPhoneNumber(phone)) {
    throw new HttpError(400, `Phone number "${phone}" is not a valid format`);
  }
}

function serialize(p: any) {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email,
    reason: p.reason,
    isNewPatient: p.isNewPatient,
    callbackRequested: p.callbackRequested,
    preferredTime: p.preferredTime,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeAppointment(a: any) {
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

export interface CreatePatientInput {
  name: string;
  phone?: string;
  email?: string;
  reason?: string;
  is_new_patient?: boolean;
  callback_requested?: boolean;
  preferred_time?: string;
  call_id?: string;
}

export interface UpdatePatientInput {
  name?: string;
  phone?: string;
  email?: string;
  reason?: string;
  is_new_patient?: boolean;
  callback_requested?: boolean;
  preferred_time?: string;
  notes?: string;
}

export class PatientService {
  static async list(filters: { search?: string; page?: number; limit?: number }) {
    assertUnlocked();
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;

    if (!filters.search) {
      const patients = await prisma.patient.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return decryptRows('patient', patients).map(serialize);
    }

    // name/phone are ciphertext: fetch capped candidates, decrypt, filter in
    // memory, then paginate. Phone matches both as-typed and normalized so
    // "06 20 257" finds a patient stored as "+36202576701".
    const candidates = await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      take: SEARCH_SCAN_CAP,
    });
    const q = filters.search.toLowerCase();
    const qPhone = normalizePhoneNumber(filters.search);
    const hits = decryptRows('patient', candidates).filter((p) => {
      if (p.name?.toLowerCase().includes(q)) return true;
      if (!p.phone) return false;
      return p.phone.toLowerCase().includes(q) || (qPhone.length >= 4 && normalizePhoneNumber(p.phone).includes(qPhone));
    });

    return hits.slice((page - 1) * limit, page * limit).map(serialize);
  }

  static async findByIdWithHistory(id: string) {
    assertUnlocked();
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: { appointments: { orderBy: [{ date: 'desc' }, { startTime: 'desc' }] } },
    });
    if (!patient) throw new HttpError(404, 'Patient not found');

    return {
      ...serialize(decryptRow('patient', patient)),
      appointments: decryptRows('appointment', patient.appointments).map(serializeAppointment),
    };
  }

  static async create(input: CreatePatientInput) {
    assertUnlocked();
    assertValidPhone(input.phone);
    const patient = await prisma.patient.create({
      data: encryptRow('patient', {
        name: input.name,
        phone: input.phone ?? null,
        phoneIndex: phoneIndexOf(input.phone),
        email: input.email ?? null,
        reason: input.reason ?? null,
        isNewPatient: input.is_new_patient ?? true,
        callbackRequested: input.callback_requested ?? false,
        preferredTime: input.preferred_time ?? null,
      }),
    });
    return serialize(decryptRow('patient', patient));
  }

  static async update(id: string, input: UpdatePatientInput) {
    assertUnlocked();
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Patient not found');

    assertValidPhone(input.phone);

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) {
      data.phone = input.phone;
      data.phoneIndex = phoneIndexOf(input.phone);
    }
    if (input.email !== undefined) data.email = input.email;
    if (input.reason !== undefined) data.reason = input.reason;
    if (input.is_new_patient !== undefined) data.isNewPatient = input.is_new_patient;
    if (input.callback_requested !== undefined) data.callbackRequested = input.callback_requested;
    if (input.preferred_time !== undefined) data.preferredTime = input.preferred_time;
    if (input.notes !== undefined) data.notes = input.notes;

    const patient = await prisma.patient.update({ where: { id }, data: encryptRow('patient', data) });
    return serialize(decryptRow('patient', patient));
  }
}
